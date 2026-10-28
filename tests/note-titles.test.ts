import { test } from "node:test"
import assert from "node:assert/strict"
import { z } from "zod"
import {
  NoteTitleService,
  NOTE_TITLE_INSTRUCTIONS,
} from "../src/main/note-title-service"
import {
  CodexStructuredRequest,
  NeedsConnection,
} from "../src/main/codex-structured-request"
import type { CodexRPC } from "../src/main/codex-rpc"

const preferences = { model: "fixture-model", reasoningEffort: "low" }
const settings = { read: async () => preferences }

test("제목 요청은 저장된 모델 설정과 본문 앞부분만 사용하고 파일명을 검증한다", async () => {
  let calls = 0
  const service = new NoteTitleService(settings, {
    generate: async (excerpt, selected) => {
      calls++
      assert.equal(excerpt.length, 6000)
      assert.ok(!excerpt.includes("본문 뒷부분"))
      assert.deepEqual(selected, preferences)
      return { title: "분기별 회의 준비" }
    },
    dispose: () => {},
  })
  try {
    assert.equal(
      await service.generate("회의 준비 ".repeat(2000) + "본문 뒷부분"),
      "분기별 회의 준비.md"
    )
    assert.equal(calls, 1)
    for (const input of [null, {}, "", "  ", "a".repeat(5 * 1024 * 1024 + 1)])
      await assert.rejects(() => service.generate(input))
    assert.equal(calls, 1)
  } finally {
    service.dispose()
  }
})

test("잘못된 AI 응답이나 경로·예약어 제목은 파일명으로 사용하지 않는다", async () => {
  for (const response of [
    { title: "../원본" },
    { title: "CON" },
    { title: "나쁜\n제목" },
    { title: "" },
    { title: "a".repeat(61) },
    { title: "제목", content: "변조" },
    null,
  ]) {
    const service = new NoteTitleService(settings, {
      generate: async () => response,
      dispose: () => {},
    })
    try {
      await assert.rejects(() => service.generate("메모 내용"))
    } finally {
      service.dispose()
    }
  }
})

test("중복 제목 요청과 종료 후 응답을 차단하며 실패 후 재시도할 수 있다", async () => {
  let finish!: (value: unknown) => void
  let stopped = false
  const service = new NoteTitleService(settings, {
    generate: () =>
      new Promise((resolve) => {
        finish = resolve
      }),
    dispose: () => {
      stopped = true
    },
  })
  const pending = service.generate("작성한 내용")
  await Promise.resolve()
  await assert.rejects(() => service.generate("중복 요청"), /생성 중/)
  service.dispose()
  finish({ title: "제목" })
  await assert.rejects(pending, /종료/)
  assert.equal(stopped, true)
  await assert.rejects(() => service.generate("종료 후 요청"), /종료/)

  let fail = true
  const retry = new NoteTitleService(settings, {
    generate: async () => {
      if (fail) throw new NeedsConnection("연결 필요")
      return { title: "복구한 제목" }
    },
    dispose: () => {},
  })
  try {
    await assert.rejects(() => retry.generate("메모"), NeedsConnection)
    fail = false
    assert.equal(await retry.generate("메모"), "복구한 제목.md")
  } finally {
    retry.dispose()
  }
})

test("제목 요청도 ephemeral thread·구조화 응답·도구 제한과 선택 모델을 사용한다", async () => {
  const requests: { method: string; params: Record<string, unknown> }[] = []
  let stopped = false
  const rpc = {
    onNotification: (() => {}) as CodexRPC["onNotification"],
    onClose: () => {},
    initialize: async () => {},
    stop: () => {
      stopped = true
    },
    request: async (method: string, params: Record<string, unknown>) => {
      requests.push({ method, params })
      if (method === "account/read") return { account: { type: "chatgpt" } }
      if (method === "thread/start") return { thread: { id: "title-thread" } }
      if (method === "turn/start") {
        queueMicrotask(() => {
          rpc.onNotification("item/completed", {
            threadId: "title-thread",
            turnId: "title-turn",
            item: { type: "agentMessage", text: '{"title":"업무 계획"}' },
          })
          rpc.onNotification("turn/completed", {
            threadId: "title-thread",
            turn: { id: "title-turn", status: "completed" },
          })
        })
        return { turn: { id: "title-turn" } }
      }
      throw new Error("Unexpected request")
    },
  }
  const request = new CodexStructuredRequest(
    {
      find: async () => "fixture-codex",
      start: (_path, _cwd, restricted) => {
        assert.equal(restricted, true)
        return rpc as unknown as CodexRPC
      },
    },
    1000
  )
  try {
    assert.deepEqual(
      await request.request(
        '{"noteExcerpt":"업무 내용을 요약"}',
        preferences,
        z.object({ title: z.string() }),
        NOTE_TITLE_INSTRUCTIONS
      ),
      { title: "업무 계획" }
    )
    const thread = requests.find(
      (entry) => entry.method === "thread/start"
    )!.params
    assert.equal(thread.ephemeral, true)
    assert.equal(thread.sandbox, "read-only")
    assert.equal(thread.approvalPolicy, "never")
    assert.equal(thread.baseInstructions, NOTE_TITLE_INSTRUCTIONS)
    const turn = requests.find((entry) => entry.method === "turn/start")!.params
    assert.equal(turn.model, preferences.model)
    assert.equal(turn.effort, preferences.reasoningEffort)
    assert.deepEqual(turn.sandboxPolicy, {
      type: "readOnly",
      networkAccess: false,
    })
    assert.ok(turn.outputSchema)
    assert.equal(stopped, true)
  } finally {
    request.dispose()
  }
})
