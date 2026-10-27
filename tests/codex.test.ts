import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CodexRPC, codexEnvironment } from "../src/main/codex-rpc"
import { CodexConnectionService } from "../src/main/codex-connection"
import { findCodexExecutable } from "../src/main/codex-executable"
import { registerCodex } from "../src/main/codex"
import { CodexSettings } from "../src/main/codex-settings"
import { BrowserWindow, handlers } from "./fakes/electron"
import type { CodexConnection } from "../src/shared/codex"

const models = [
  {
    id: "test-balanced",
    model: "test-balanced",
    displayName: "Balanced",
    isDefault: true,
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: [
      { reasoningEffort: "low", description: "Fast" },
      { reasoningEffort: "medium", description: "Balanced" },
    ],
  },
  {
    id: "test-deep",
    model: "test-deep",
    displayName: "Deep",
    isDefault: false,
    defaultReasoningEffort: "high",
    supportedReasoningEfforts: [
      { reasoningEffort: "high", description: "Deep" },
    ],
  },
]

// 메모리 스트림으로 공식 stdio 프로토콜을 흉내 낸다. 실제 계정/브라우저에는 접근하지 않는다.
function fakeCodex(
  options: {
    account?: "chatgpt" | "apiKey"
    url?: string
    stall?: boolean
    modelFailure?: boolean
    paginated?: boolean
  } = {}
) {
  let loggedIn = options.account === "chatgpt"
  const requests: { id?: number; method: string; params?: unknown }[] = []
  let killed = 0
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: () => {
      killed++
      child.stdout.end()
      child.stderr.end()
      child.emit("exit", 0)
      child.emit("close", 0)
      return true
    },
  })
  const send = (message: unknown) =>
    child.stdout.write(JSON.stringify(message) + "\n")
  child.stdin.on("data", (chunk) => {
    for (const line of String(chunk).trim().split("\n")) {
      const request = JSON.parse(line)
      requests.push(request)
      if (options.stall || request.id == null || request.method === "wait")
        continue
      const reply = (result: unknown) => send({ id: request.id, result })
      if (request.method === "initialize") reply({ userAgent: "test-codex" })
      else if (request.method === "account/read")
        reply({
          account: loggedIn
            ? {
                type: "chatgpt",
                email: "test@example.com",
                planType: "plus",
                accessToken: "must-not-leak",
              }
            : options.account === "apiKey"
              ? { type: "apiKey" }
              : null,
        })
      else if (request.method === "account/login/start")
        reply({
          type: "chatgpt",
          loginId: "test-login",
          authUrl:
            options.url ?? "https://auth.openai.com/oauth/authorize?state=test",
        })
      else if (request.method === "account/login/cancel")
        reply({ status: "canceled" })
      else if (request.method === "model/list" && !options.modelFailure) {
        if (options.paginated)
          reply(
            request.params.cursor
              ? {
                  data: [
                    models[1],
                    { ...models[1], model: "hidden", hidden: true },
                  ],
                  nextCursor: null,
                }
              : { data: [models[0]], nextCursor: "next-page" }
          )
        else reply({ data: models, nextCursor: null })
      } else
        send({
          id: request.id,
          error: { code: -1, message: "SECRET remote error" },
        })
    }
  })
  const rpc = new CodexRPC(child as never, 100)
  return {
    rpc,
    requests,
    child,
    get killed() {
      return killed
    },
    complete(success: boolean, loginId = "test-login") {
      loggedIn = success
      send({
        method: "account/login/completed",
        params: { loginId, success, error: "SECRET" },
      })
    },
  }
}
function setup(
  options: Parameters<typeof fakeCodex>[0] = {},
  loginTimeout = 1000
) {
  const fake = fakeCodex(options)
  const states: CodexConnection[] = []
  const opened: string[] = []
  const service = new CodexConnectionService(
    (state) => states.push(state),
    async (url) => {
      opened.push(url)
    },
    {
      find: async () => "fake-codex",
      version: async () => "0.164.0",
      start: () => fake.rpc,
    },
    loginTimeout
  )
  return { fake, service, states, opened }
}
async function until(condition: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error("Timed out waiting for login state")
}

test("기존 ChatGPT 계정 확인은 초기화 순서를 지키고 토큰을 노출하거나 추론을 시작하지 않는다", async () => {
  const { fake, service, states, opened } = setup({ account: "chatgpt" })
  try {
    const state = await service.check()
    assert.equal(state.status, "connected")
    assert.deepEqual(state.account, { email: "test@example.com", plan: "plus" })
    assert.deepEqual(
      fake.requests.map((request) => request.method),
      ["initialize", "initialized", "account/read", "model/list"]
    )
    assert.ok(!JSON.stringify(states).includes("must-not-leak"))
    assert.equal(opened.length, 0)
    assert.equal(fake.killed, 1)
  } finally {
    service.dispose()
  }
})

test("모델 목록은 모든 페이지를 읽고 숨겨진 모델을 제외하며 모델별 생각 수준을 검증한다", async () => {
  const { fake, service } = setup({ account: "chatgpt", paginated: true })
  try {
    const state = await service.check()
    assert.deepEqual(state.models, models)
    assert.equal(state.modelsError, "")
    assert.equal(
      fake.requests.filter((request) => request.method === "model/list").length,
      2
    )
    assert.deepEqual(
      service.validatePreferences({
        model: "test-balanced",
        reasoningEffort: "low",
      }),
      { model: "test-balanced", reasoningEffort: "low" }
    )
    assert.deepEqual(
      service.validatePreferences({ model: null, reasoningEffort: null }),
      { model: null, reasoningEffort: null }
    )
    assert.throws(() =>
      service.validatePreferences({ model: "unknown", reasoningEffort: null })
    )
    assert.throws(() =>
      service.validatePreferences({
        model: "test-balanced",
        reasoningEffort: "high",
      })
    )
    assert.throws(() =>
      service.validatePreferences({ model: null, reasoningEffort: "high" })
    )
    assert.throws(() =>
      service.validatePreferences({
        model: "test-deep",
        reasoningEffort: "high",
        apiKey: "secret",
      })
    )
    assert.equal(fake.killed, 1)
  } finally {
    service.dispose()
  }
})

test("모델 목록 조회 실패는 계정 연결을 유지하며 선택 저장을 거부한다", async () => {
  const { service, fake } = setup({ account: "chatgpt", modelFailure: true })
  try {
    const state = await service.check()
    assert.equal(state.status, "connected")
    assert.ok(state.account)
    assert.deepEqual(state.models, [])
    assert.match(state.modelsError, /모델 목록/)
    assert.throws(() =>
      service.validatePreferences({
        model: "test-balanced",
        reasoningEffort: null,
      })
    )
    assert.equal(fake.killed, 1)
  } finally {
    service.dispose()
  }
})

test("모델·생각 수준 설정을 복원하고 손상된 설정은 명시적 저장 전까지 보존한다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "my-hub-codex-settings-"))
  try {
    const settings = new CodexSettings(dir)
    assert.deepEqual(await settings.read(), {
      model: null,
      reasoningEffort: null,
    })
    const preferences = { model: "test-balanced", reasoningEffort: "low" }
    await settings.save(preferences)
    assert.deepEqual(await new CodexSettings(dir).read(), preferences)
    assert.deepEqual(await readdir(dir), ["codex-settings.json"])
    const path = join(dir, "codex-settings.json")
    await writeFile(path, "{broken")
    await assert.rejects(settings.read())
    assert.equal(await readFile(path, "utf8"), "{broken")
    assert.throws(() => settings.save({ model: null, reasoningEffort: "high" }))
    assert.equal(await readFile(path, "utf8"), "{broken")
    await settings.save({ model: null, reasoningEffort: null })
    assert.deepEqual(await settings.read(), {
      model: null,
      reasoningEffort: null,
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("설치되지 않은 경우 프로세스를 시작하지 않고 설치 필요 상태를 반환한다", async () => {
  const service = new CodexConnectionService(
    () => {},
    async () => {
      assert.fail("No browser")
    },
    {
      find: async () => null,
      version: async () => {
        assert.fail("No version process")
      },
      start: () => {
        assert.fail("No app-server")
      },
    }
  )
  try {
    assert.equal((await service.connect()).status, "missing")
  } finally {
    service.dispose()
  }
})

test("상태 조회는 로그인이나 브라우저를 시작하지 않으며 API 키 계정을 구독 연결로 취급하지 않는다", async () => {
  for (const options of [{}, { account: "apiKey" as const }]) {
    const { fake, service, opened } = setup(options)
    try {
      assert.equal((await service.check()).status, "disconnected")
      assert.equal(opened.length, 0)
      assert.equal(fake.killed, 1)
      assert.ok(
        !fake.requests.some(
          (request) => request.method === "account/login/start"
        )
      )
    } finally {
      service.dispose()
    }
  }
})

test("브라우저 로그인 완료 알림 이후 계정을 다시 확인하고 프로세스를 종료한다", async () => {
  const { fake, service, states, opened } = setup()
  try {
    assert.equal((await service.connect()).status, "connecting")
    assert.equal(opened.length, 1)
    assert.equal(fake.killed, 0)
    fake.complete(true, "different-login")
    assert.equal(states.at(-1)?.status, "connecting")
    fake.complete(true)
    await until(() => states.at(-1)?.status === "connected")
    assert.equal(fake.killed, 1)
    assert.ok(!JSON.stringify(states).includes("SECRET"))
  } finally {
    service.dispose()
  }
})

test("실패한 로그인은 연결 성공으로 표시하지 않는다", async () => {
  const { fake, service, states } = setup()
  try {
    await service.connect()
    fake.complete(false)
    await until(() => states.at(-1)?.status === "error")
    assert.equal(states.at(-1)?.account, null)
    assert.equal(fake.killed, 1)
  } finally {
    service.dispose()
  }
})

test("로그인 취소와 창 종료는 자기 프로세스만 종료하고 전역 로그아웃을 호출하지 않는다", async () => {
  for (const cancel of [true, false]) {
    const { fake, service } = setup()
    await service.connect()
    if (cancel) assert.equal((await service.cancel()).status, "disconnected")
    service.dispose()
    assert.equal(fake.killed, 1)
    assert.equal(
      fake.requests.some(
        (request) => request.method === "account/login/cancel"
      ),
      cancel
    )
    assert.ok(
      !fake.requests.some((request) => request.method === "account/logout")
    )
  }
})

test("중복 연결은 프로세스나 브라우저를 추가로 열지 않는다", async () => {
  const { fake, service, opened } = setup()
  try {
    await Promise.all([service.connect(), service.connect()])
    await service.check()
    await service.connect()
    assert.equal(opened.length, 1)
    assert.equal(
      fake.requests.filter((request) => request.method === "initialize").length,
      1
    )
  } finally {
    service.dispose()
  }
})

test("허용되지 않은 로그인 URL은 브라우저에 전달하지 않는다", async () => {
  for (const url of [
    "http://auth.openai.com/",
    "https://auth.openai.com.evil.test/",
    "file:///C:/test",
    "https://user:pass@chatgpt.com/",
    "https://chatgpt.com:444/",
  ]) {
    const { fake, service, opened } = setup({ url })
    try {
      assert.equal((await service.connect()).status, "error")
      assert.equal(opened.length, 0)
      assert.equal(fake.killed, 1)
    } finally {
      service.dispose()
    }
  }
})

test("브라우저 열기 실패와 인증 대기 시간 초과는 프로세스를 정리한다", async () => {
  const { fake, service, states } = setup({}, 15)
  try {
    await service.connect()
    await until(() => states.at(-1)?.status === "error")
    assert.equal(fake.killed, 1)
  } finally {
    service.dispose()
  }
  const second = fakeCodex()
  const failing = new CodexConnectionService(
    () => {},
    async () => {
      throw new Error("Browser unavailable")
    },
    {
      find: async () => "fake",
      version: async () => "0.164.0",
      start: () => second.rpc,
    }
  )
  try {
    assert.equal((await failing.connect()).status, "error")
    assert.equal(second.killed, 1)
  } finally {
    failing.dispose()
  }
})

test("RPC 응답 오류·손상·시간 초과를 처리하고 원격 오류의 비밀을 전달하지 않는다", async () => {
  const first = fakeCodex()
  await assert.rejects(
    first.rpc.request("unknown"),
    (error: Error) => !error.message.includes("SECRET")
  )
  const malformed = first.rpc.request("wait")
  first.child.stdout.write("not json\n")
  await assert.rejects(malformed)
  assert.equal(first.killed, 1)
  const stalled = fakeCodex({ stall: true })
  await assert.rejects(stalled.rpc.request("initialize"), /응답 시간/)
  assert.equal(stalled.killed, 1)
})

test("Windows npm 바이너리와 직접 설치 파일을 찾으며 누락된 파일은 실행하지 않는다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "my-hub-codex-"))
  try {
    assert.equal(await findCodexExecutable([dir], "win32", "x64"), null)
    const vendor = join(
      dir,
      "node_modules/@openai/codex/node_modules/@openai/codex-win32-x64"
    )
    await mkdir(join(vendor, "vendor/x86_64-pc-windows-msvc/bin"), {
      recursive: true,
    })
    await writeFile(
      join(vendor, "package.json"),
      '{"name":"@openai/codex-win32-x64"}'
    )
    const binary = join(vendor, "vendor/x86_64-pc-windows-msvc/bin/codex.exe")
    await writeFile(binary, "test", { mode: 0o755 })
    assert.equal(await findCodexExecutable([dir], "win32", "x64"), binary)
    const direct = join(dir, "codex.exe")
    await writeFile(direct, "test", { mode: 0o755 })
    assert.equal(await findCodexExecutable([dir], "win32", "x64"), direct)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("IPC는 현재 창의 메인 프레임만 허용하고 창이 닫히면 핸들러를 제거한다", () => {
  const window = new BrowserWindow()
  registerCodex(window as never)
  for (const method of [
    "check",
    "connect",
    "cancel",
    "preferences",
    "save-preferences",
  ]) {
    const handler = handlers.get(`codex:${method}`)!
    assert.throws(() => handler({ sender: {} }), /허용되지 않은/)
    assert.throws(
      () => handler({ sender: window.webContents, senderFrame: {} }),
      /허용되지 않은/
    )
  }
  window.close()
  assert.equal(handlers.has("codex:connect"), false)
})

test("자식 프로세스 환경에서 API 키와 Electron Node 모드를 제거한다", () => {
  const keys = ["OPENAI_API_KEY", "CODEX_API_KEY", "ELECTRON_RUN_AS_NODE"]
  const previous = keys.map((key) => process.env[key])
  try {
    for (const key of keys) process.env[key] = "test"
    const env = codexEnvironment()
    for (const key of keys) assert.equal(env[key], undefined)
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] == null) delete process.env[key]
      else process.env[key] = previous[index]
    })
  }
})
