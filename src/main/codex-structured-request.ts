import { z } from "zod"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { findCodexExecutable } from "./codex-executable"
import { startCodex, type CodexRPC } from "./codex-rpc"
import type { CodexPreferences } from "../shared/codex"

export class NeedsConnection extends Error {}

export class CodexStructuredRequest {
  private client: CodexRPC | null = null
  private disposed = false
  private readonly deps: {
    find: typeof findCodexExecutable
    start: typeof startCodex
  }
  private readonly timeout: number
  constructor(
    deps = { find: findCodexExecutable, start: startCodex },
    timeout = 120000
  ) {
    this.deps = deps
    this.timeout = timeout
  }
  dispose() {
    this.disposed = true
    this.client?.stop()
  }
  async request<T extends z.ZodType>(
    context: string,
    preferences: CodexPreferences,
    schema: T,
    instructions: string
  ): Promise<z.output<T>> {
    let directory: string | undefined
    let client: CodexRPC | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      if (this.disposed) throw new Error("작업 창이 종료되었습니다.")
      const executable = await this.deps.find()
      if (!executable)
        throw new NeedsConnection(
          "Codex를 설치하고 설정에서 ChatGPT를 연결해 주세요."
        )
      directory = await mkdtemp(join(tmpdir(), "my-hub-command-"))
      if (this.disposed) throw new Error("작업 창이 종료되었습니다.")
      client = this.deps.start(executable, directory, true)
      this.client = client
      const rpc = client
      const completion = new Promise<z.output<T>>((resolve, reject) => {
        let threadId = ""
        let turnId = ""
        let text = ""
        const queued: { method: string; params: unknown }[] = []
        let accepting = false
        const receive = (method: string, params: unknown) => {
          if (!accepting) {
            if (queued.length >= 1000) throw new Error("Too many notifications")
            queued.push({ method, params })
            return
          }
          const envelope = z
            .object({ threadId: z.string(), turnId: z.string().optional() })
            .safeParse(params)
          if (
            !envelope.success ||
            envelope.data.threadId !== threadId ||
            (envelope.data.turnId && envelope.data.turnId !== turnId)
          )
            return
          if (method === "item/completed") {
            const parsed = z
              .object({
                item: z.object({
                  type: z.string(),
                  text: z.string().optional(),
                }),
              })
              .parse(params)
            if (parsed.item.type === "agentMessage" && parsed.item.text) {
              text = parsed.item.text
            }
          }
          if (method === "turn/completed") {
            const parsed = z
              .object({
                turn: z.object({ id: z.string(), status: z.string() }),
              })
              .parse(params)
            if (parsed.turn.id !== turnId) return
            if (parsed.turn.status !== "completed") {
              reject(
                new Error("AI 작업이 완료되지 않았습니다. 다시 시도해 주세요.")
              )
              return
            }
            try {
              if (text.length > 100000) throw new Error("Response too large")
              resolve(schema.parse(JSON.parse(text)))
            } catch {
              reject(
                new Error("AI 응답 형식이 올바르지 않아 변경하지 않았습니다.")
              )
            }
          }
        }
        rpc.onNotification = (method, params) => {
          try {
            receive(method, params)
          } catch {
            reject(new Error("AI 응답을 해석하지 못했습니다."))
          }
        }
        rpc.onClose = () =>
          reject(new Error("AI 연결이 종료되었거나 시간이 초과되었습니다."))
        timer = setTimeout(() => {
          reject(
            new Error(
              "AI 응답 대기 시간이 초과되었습니다. 변경하지 않았습니다."
            )
          )
          rpc.stop()
        }, this.timeout)
        void (async () => {
          await rpc.initialize()
          const account = z
            .object({ account: z.object({ type: z.string() }).nullable() })
            .parse(await rpc.request("account/read", { refreshToken: false }))
          if (account.account?.type !== "chatgpt")
            throw new NeedsConnection("설정에서 ChatGPT 계정을 연결해 주세요.")
          const thread = z
            .object({ thread: z.object({ id: z.string() }) })
            .parse(
              await rpc.request("thread/start", {
                ephemeral: true,
                cwd: directory,
                approvalPolicy: "never",
                sandbox: "read-only",
                baseInstructions: instructions,
                ...(preferences.model ? { model: preferences.model } : {}),
              })
            )
          threadId = thread.thread.id
          const turn = z.object({ turn: z.object({ id: z.string() }) }).parse(
            await rpc.request("turn/start", {
              threadId,
              input: [{ type: "text", text: context }],
              sandboxPolicy: {
                type: "readOnly",
                networkAccess: false,
              },
              ...(preferences.model ? { model: preferences.model } : {}),
              ...(preferences.reasoningEffort
                ? { effort: preferences.reasoningEffort }
                : {}),
              outputSchema: z.toJSONSchema(schema),
            })
          )
          turnId = turn.turn.id
          accepting = true
          for (const event of queued)
            rpc.onNotification(event.method, event.params)
          queued.length = 0
        })().catch(reject)
      })
      return await completion
    } finally {
      clearTimeout(timer)
      if (client) {
        client.onClose = () => {}
        client.stop()
      }
      if (this.client === client) this.client = null
      if (directory)
        await rm(directory, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 100,
        }).catch(() => {})
    }
  }
}
