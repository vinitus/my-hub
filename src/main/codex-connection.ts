import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { z } from "zod"
import {
  CodexPreferencesSchema,
  type CodexModel,
  type CodexConnection,
} from "../shared/codex"
import { findCodexExecutable } from "./codex-executable"
import { codexEnvironment, startCodex, type CodexRPC } from "./codex-rpc"

const exec = promisify(execFile)
const AccountSchema = z.object({
  account: z
    .object({
      type: z.string(),
      email: z.string().nullable().optional(),
      planType: z.string().optional(),
    })
    .nullable(),
})
const LoginSchema = z.object({
  type: z.literal("chatgpt"),
  loginId: z.string(),
  authUrl: z.string().url(),
})
const CompletedSchema = z.object({
  loginId: z.string().nullable(),
  success: z.boolean(),
})
const ModelPageSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      model: z.string(),
      displayName: z.string(),
      hidden: z.boolean().optional(),
      isDefault: z.boolean().default(false),
      defaultReasoningEffort: z.string().nullable().default(null),
      supportedReasoningEfforts: z
        .array(
          z.object({
            reasoningEffort: z.string(),
            description: z.string().default(""),
          })
        )
        .default([]),
    })
  ),
  nextCursor: z.string().nullable().optional(),
})
const dependencies = {
  find: findCodexExecutable,
  start: startCodex,
  version: async (path: string) => {
    const { stdout } = await exec(path, ["--version"], {
      timeout: 8000,
      maxBuffer: 64 * 1024,
      windowsHide: true,
      env: codexEnvironment(),
    })
    const match = /^codex-cli\s+(\S+)/.exec(stdout.trim())
    if (!match)
      throw new Error(
        "Codex 실행 파일을 확인할 수 없습니다. 공식 CLI를 설치해 주세요."
      )
    return match[1]
  },
}

export const initialCodexConnection: CodexConnection = {
  status: "idle",
  executable: null,
  version: null,
  account: null,
  error: "",
  models: [],
  modelsError: "",
}

export class CodexConnectionService {
  private state = { ...initialCodexConnection }
  private operation: Promise<CodexConnection> | null = null
  private client: CodexRPC | null = null
  private loginId: string | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private disposed = false
  private readonly notify: (state: CodexConnection) => void
  private readonly openURL: (url: string) => Promise<unknown>
  private readonly deps: typeof dependencies
  private readonly loginTimeout: number

  constructor(
    notify: (state: CodexConnection) => void,
    openURL: (url: string) => Promise<unknown>,
    deps = dependencies,
    loginTimeout = 5 * 60 * 1000
  ) {
    this.notify = notify
    this.openURL = openURL
    this.deps = deps
    this.loginTimeout = loginTimeout
  }

  private update(patch: Partial<CodexConnection>) {
    if (this.disposed) return
    this.state = { ...this.state, ...patch }
    this.notify(this.state)
  }
  private release() {
    clearTimeout(this.timer)
    this.loginId = null
    const client = this.client
    this.client = null
    if (client) {
      client.onClose = () => {}
      client.stop()
    }
  }
  private async account(client: CodexRPC) {
    const result = AccountSchema.parse(
      await client.request("account/read", { refreshToken: false })
    )
    const account = result.account
    return account?.type === "chatgpt"
      ? { email: account.email ?? null, plan: account.planType ?? "unknown" }
      : null
  }
  private async models(client: CodexRPC) {
    try {
      const models = new Map<string, CodexModel>()
      const cursors = new Set<string>()
      let cursor: string | undefined
      do {
        const page = ModelPageSchema.parse(
          await client.request("model/list", {
            limit: 100,
            includeHidden: false,
            ...(cursor ? { cursor } : {}),
          })
        )
        for (const { hidden, ...model } of page.data) {
          if (!hidden) models.set(model.model, model)
        }
        cursor = page.nextCursor ?? undefined
        if (cursor) {
          if (cursors.has(cursor) || cursors.size >= 10)
            throw new Error("Invalid model pagination")
          cursors.add(cursor)
        }
      } while (cursor)
      if (this.client === client)
        this.update({ models: [...models.values()], modelsError: "" })
    } catch {
      // 목록 조회 실패가 이미 확인한 계정의 로그인 상태를 바꾸지는 않는다.
      if (this.client === client || this.state.account)
        this.update({
          models: [],
          modelsError: "모델 목록을 불러오지 못했습니다. 다시 확인해 주세요.",
        })
    }
  }
  private async finishLogin(client: CodexRPC, success: boolean) {
    clearTimeout(this.timer)
    try {
      const account = success ? await this.account(client) : null
      if (this.client !== client) return
      this.update(
        account
          ? { status: "connected", account, error: "" }
          : {
              status: "error",
              account: null,
              error:
                "ChatGPT 로그인을 완료하지 못했습니다. 다시 시도해 주세요.",
            }
      )
      if (account) await this.models(client)
    } catch {
      if (this.client === client)
        this.update({
          status: "error",
          account: null,
          error: "로그인 상태를 확인하지 못했습니다. 다시 확인해 주세요.",
        })
    } finally {
      if (this.client === client) this.release()
    }
  }
  private run(
    action: "check" | "connect" | "disconnect"
  ): Promise<CodexConnection> {
    if (this.operation) return this.operation
    if (this.client || this.state.status === "connecting" || this.disposed)
      return Promise.resolve(this.state)
    this.update({
      status: "checking",
      account: null,
      error: "",
      models: [],
      modelsError: "",
    })
    this.operation = (async () => {
      try {
        const executable = await this.deps.find()
        if (this.disposed) return this.state
        if (!executable) {
          this.update({ status: "missing", executable: null, version: null })
          return this.state
        }
        this.update({ executable, version: null })
        const version = await this.deps.version(executable)
        if (this.disposed) return this.state
        this.update({ version })
        const client = this.deps.start(executable)
        this.client = client
        client.onClose = () => {
          if (this.client !== client) return
          const authenticated = this.state.account !== null
          this.release()
          if (authenticated) return
          this.update({
            status: "error",
            account: null,
            error: "Codex 연결이 종료되었습니다. 다시 시도해 주세요.",
          })
        }
        client.onNotification = (method, params) => {
          if (method !== "account/login/completed") return
          const completed = CompletedSchema.safeParse(params)
          if (
            !completed.success ||
            !this.loginId ||
            completed.data.loginId !== this.loginId
          )
            return
          this.loginId = null
          void this.finishLogin(client, completed.data.success)
        }
        await client.initialize()
        const account = await this.account(client)
        if (action === "disconnect") {
          // 연결 확인 이후 외부 CLI가 API 키 계정으로 바뀐 경우 그 계정은 로그아웃하지 않는다.
          if (account) await client.request("account/logout")
          if (await this.account(client))
            throw new Error("Codex logout was not completed")
          this.update({
            status: "disconnected",
            account: null,
            models: [],
            modelsError: "",
            error: "",
          })
        } else if (account) {
          this.update({ status: "connected", account })
          await this.models(client)
        } else if (action === "check") {
          this.update({ status: "disconnected" })
        } else {
          const result = LoginSchema.parse(
            await client.request("account/login/start", { type: "chatgpt" })
          )
          const url = new URL(result.authUrl)
          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            url.port ||
            !["auth.openai.com", "chatgpt.com"].includes(url.hostname)
          )
            throw new Error("인증 주소를 확인할 수 없습니다.")
          this.loginId = result.loginId
          this.update({ status: "connecting" })
          this.timer = setTimeout(() => {
            this.release()
            this.update({
              status: "error",
              account: null,
              error: "로그인 대기 시간이 지났습니다. 다시 연결해 주세요.",
            })
          }, this.loginTimeout)
          await this.openURL(url.href)
        }
      } catch {
        this.release()
        this.update({
          status: "error",
          account: null,
          error:
            action === "disconnect"
              ? "Codex 연결을 해제하지 못했습니다. 다시 확인한 뒤 시도해 주세요."
              : "Codex에 연결하지 못했습니다. 설치 상태와 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
        })
      } finally {
        // 상태 조회 후에는 프로세스를 유지하지 않는다. 로그인 콜백 대기 중에만 살아 있다.
        if (this.state.status !== "connecting") this.release()
      }
      return this.state
    })().finally(() => {
      this.operation = null
    })
    return this.operation
  }
  check = () => this.run("check")
  connect = () => this.run("connect")
  disconnect = async () => {
    // 모델 목록 조회가 아직 끝나지 않았다면 먼저 마친 뒤 로그아웃을 실행한다.
    if (this.operation) await this.operation
    if (this.disposed || this.state.status !== "connected") return this.state
    this.release()
    return this.run("disconnect")
  }
  validatePreferences(request: unknown) {
    const preferences = CodexPreferencesSchema.parse(request)
    if (preferences.model === null) return preferences
    const model = this.state.models.find(
      (item) => item.model === preferences.model
    )
    if (this.state.status !== "connected" || !model)
      throw new Error("사용할 모델을 목록에서 다시 선택해 주세요.")
    if (
      preferences.reasoningEffort !== null &&
      !model.supportedReasoningEfforts.some(
        (item) => item.reasoningEffort === preferences.reasoningEffort
      )
    )
      throw new Error("선택한 모델이 지원하는 생각 수준을 선택해 주세요.")
    return preferences
  }
  cancel = async () => {
    const client = this.client,
      loginId = this.loginId
    if (!client || !loginId) return this.state
    this.loginId = null
    clearTimeout(this.timer)
    try {
      await client.request("account/login/cancel", { loginId })
    } catch {
      /* 종료된 로그인도 취소 처리한다. */
    }
    this.release()
    this.update({ status: "disconnected", account: null, error: "" })
    return this.state
  }
  dispose() {
    this.disposed = true
    this.release()
  }
}
