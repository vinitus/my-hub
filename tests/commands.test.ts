import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { CalendarRepository } from "../src/main/calendar-repository"
import { TodoRepository } from "../src/main/todo-repository"
import { CodexSettings } from "../src/main/codex-settings"
import {
  CommandService,
  validateCommandPlan,
} from "../src/main/command-service"
import {
  CodexCommandPlanner,
  NeedsConnection,
} from "../src/main/codex-command-planner"
import { CodexRPC } from "../src/main/codex-rpc"
import { registerCommands } from "../src/main/commands"
import { BrowserWindow, handlers } from "./fakes/electron"
import type { CommandPlan, CommandResult } from "../src/shared/command"

const todoAction = () => ({
  domain: "todos" as const,
  operation: "create" as const,
  id: null,
  event: null,
  todo: { title: "보고서", dueDate: "2026-10-30", completed: false },
})
const eventAction = () => ({
  domain: "calendar" as const,
  operation: "create" as const,
  id: null,
  todo: null,
  event: {
    title: "회의",
    description: "",
    color: "blue" as const,
    allDay: false,
    start: "2026-10-29T15:00:00+09:00",
    end: "2026-10-29T16:00:00+09:00",
  },
})
const actions = (...items: CommandPlan["actions"]): CommandPlan => ({
  kind: "actions",
  message: "작업 계획",
  actions: items,
})
async function setup(plan: (context: string) => Promise<CommandPlan>) {
  const dir = await mkdtemp(join(tmpdir(), "my-hub-commands-test-"))
  const calendar = new CalendarRepository(dir),
    todos = new TodoRepository(dir),
    settings = new CodexSettings(dir)
  const changed: CommandResult["changed"][] = []
  const service = new CommandService(
    calendar,
    todos,
    settings,
    (domains) => changed.push(domains),
    { plan, dispose() {} },
    () => new Date("2026-10-28T10:00:00+09:00")
  )
  return {
    calendar,
    todos,
    settings,
    service,
    changed,
    cleanup: async () => {
      service.dispose()
      await rm(dir, { recursive: true, force: true })
    },
  }
}
test("한 요청으로 일정과 할일을 저장하고 실제 revision으로 수정·완료·삭제한다", async () => {
  let plan = actions(eventAction(), todoAction())
  const env = await setup(async () => plan)
  try {
    let result = await env.service.execute(
      "내일 회의와 금요일 보고서 할일 추가"
    )
    assert.equal(result.status, "success")
    assert.deepEqual(result.changed, ["calendar", "todos"])
    const event = (await env.calendar.load()).events[0],
      todo = (await env.todos.load()).items[0]
    plan = actions(
      {
        ...todoAction(),
        operation: "update",
        id: todo.id,
        todo: { ...todo, completed: true },
      },
      {
        ...eventAction(),
        operation: "update",
        id: event.id,
        event: { ...eventAction().event, title: "수정 회의" },
      }
    )
    // AI payload에는 id 같은 추가 필드를 허용하지 않는다.
    delete (plan.actions[0].todo as Record<string, unknown>).id
    result = await env.service.execute("보고서 완료하고 회의 제목 수정")
    assert.equal(result.status, "success")
    assert.equal((await env.todos.load()).items[0].completed, true)
    assert.equal((await env.calendar.load()).events[0].title, "수정 회의")
    plan = actions(
      { ...todoAction(), operation: "remove", id: todo.id, todo: null },
      { ...eventAction(), operation: "remove", id: event.id, event: null }
    )
    assert.equal((await env.service.execute("두 항목 삭제")).status, "success")
    assert.equal((await env.todos.load()).items.length, 0)
    assert.equal((await env.calendar.load()).events.length, 0)
    assert.equal(env.changed.length, 3)
  } finally {
    await env.cleanup()
  }
})
test("조회와 추가 설명 요청은 저장하지 않으며 현재 시간대와 제한된 컨텍스트를 전달한다", async () => {
  let seen = ""
  const env = await setup(async (context) => {
    seen = context
    return {
      kind: "clarification",
      message: "마감일을 알려 주세요.",
      actions: [],
    }
  })
  try {
    assert.equal(
      (await env.service.execute("보고서 할일 추가")).status,
      "clarification"
    )
    const context = JSON.parse(seen)
    assert.equal(context.request, "보고서 할일 추가")
    assert.equal(typeof context.timeZone, "string")
    assert.equal(context.currentInstant, "2026-10-28T01:00:00.000Z")
    assert.equal(seen.includes("revision"), false)
    assert.equal((await env.todos.load()).revision, "missing")
    assert.deepEqual(env.changed, [])
  } finally {
    await env.cleanup()
  }
  const query = await setup(async () => ({
    kind: "answer",
    message: "등록된 일정이 없습니다.",
    actions: [],
  }))
  try {
    assert.equal(
      (await query.service.execute("내일 일정 알려줘")).status,
      "success"
    )
    assert.equal((await query.calendar.load()).revision, "missing")
  } finally {
    await query.cleanup()
  }
})
test("잘못된 날짜·없는 대상·중복 대상·불일치 계획은 첫 쓰기 전에 차단한다", async () => {
  const env = await setup(async () =>
    actions(todoAction(), {
      ...eventAction(),
      event: { ...eventAction().event, end: "bad" },
    })
  )
  try {
    assert.equal((await env.service.execute("추가")).status, "error")
    assert.equal((await env.todos.load()).revision, "missing")
    const cal = await env.calendar.load(),
      todos = await env.todos.load()
    assert.throws(() =>
      validateCommandPlan(
        actions({
          ...todoAction(),
          operation: "remove",
          id: crypto.randomUUID(),
          todo: null,
        }),
        cal,
        todos
      )
    )
    assert.throws(() =>
      validateCommandPlan(
        { kind: "answer", message: "조회", actions: [todoAction()] },
        cal,
        todos
      )
    )
    assert.throws(() =>
      validateCommandPlan(
        actions({
          ...todoAction(),
          todo: { ...todoAction().todo, dueDate: "2026-02-30" },
        }),
        cal,
        todos
      )
    )
    const item = { ...todoAction().todo, id: crypto.randomUUID() }
    assert.throws(() =>
      validateCommandPlan(
        actions(
          ...[1, 2].map(() => ({
            ...todoAction(),
            operation: "remove" as const,
            id: item.id,
            todo: null,
          }))
        ),
        cal,
        { ...todos, items: [item] }
      )
    )
  } finally {
    await env.cleanup()
  }
})
test("AI 해석 중 수동 변경이 생기면 최신 내용을 덮어쓰지 않는다", async () => {
  const env = await setup(async () => {
    await env.todos.save({
      todo: { ...todoAction().todo, id: crypto.randomUUID() },
      expectedRevision: "missing",
    })
    return actions(todoAction())
  })
  try {
    assert.equal((await env.service.execute("추가")).status, "error")
    assert.equal((await env.todos.load()).items.length, 1)
  } finally {
    await env.cleanup()
  }
})
test("중간 저장 실패는 성공한 항목만 반환하고 나머지는 중단한다", async () => {
  const env = await setup(async () => actions(eventAction(), todoAction()))
  try {
    env.todos.save = async () => {
      throw new Error("디스크 오류")
    }
    const result = await env.service.execute("둘 다 추가")
    assert.equal(result.status, "partial")
    assert.deepEqual(result.changed, ["calendar"])
    assert.match(result.message, /1건만/)
    assert.equal((await env.calendar.load()).events.length, 1)
    assert.deepEqual(env.changed, [["calendar"]])
  } finally {
    await env.cleanup()
  }
})
test("수정 시 기존 참고 링크와 알림 설정을 보존한다", async () => {
  let plan = actions(eventAction())
  const env = await setup(async () => plan)
  try {
    await env.service.execute("추가")
    let snapshot = await env.calendar.load()
    const event = {
      ...snapshot.events[0],
      referenceUrls: ["https://example.com"],
      openLinks: "at-start" as const,
      notifyOS: false,
    }
    snapshot = await env.calendar.save({
      event,
      expectedRevision: snapshot.revision,
    })
    plan = actions({
      ...eventAction(),
      operation: "update",
      id: event.id,
      event: { ...eventAction().event, title: "새 제목" },
    })
    assert.equal((await env.service.execute("제목만 수정")).status, "success")
    const updated = (await env.calendar.load()).events[0]
    assert.deepEqual(updated.referenceUrls, event.referenceUrls)
    assert.equal(updated.notifyOS, false)
    assert.equal(updated.openLinks, "at-start")
  } finally {
    await env.cleanup()
  }
})
test("중복 요청·잘못된 입력·종료 후 저장을 막는다", async () => {
  let release!: (plan: CommandPlan) => void
  const env = await setup(
    () =>
      new Promise((resolve) => {
        release = resolve
      })
  )
  try {
    assert.equal((await env.service.execute(" ")).status, "error")
    assert.equal((await env.service.execute("a".repeat(501))).status, "error")
    const first = env.service.execute("추가")
    while (!release) await new Promise((resolve) => setTimeout(resolve, 1))
    assert.equal((await env.service.execute("또 추가")).status, "error")
    env.service.dispose()
    release(actions(todoAction()))
    assert.equal((await first).status, "error")
    assert.equal((await env.todos.load()).revision, "missing")
  } finally {
    await env.cleanup()
  }
})
test("설치·연결이 없으면 needs-connection을 반환한다", async () => {
  const planner = new CodexCommandPlanner({
    find: async () => null,
    start: () => {
      throw new Error("must not start")
    },
  })
  await assert.rejects(
    planner.plan("{}", { model: null, reasoningEffort: null }),
    NeedsConnection
  )
  const env = await setup(async () => {
    throw new NeedsConnection("연결해 주세요")
  })
  try {
    assert.equal((await env.service.execute("추가")).status, "needs-connection")
  } finally {
    await env.cleanup()
  }
})

function fakePlanner(
  options: {
    status?: string
    text?: string
    silent?: boolean
    account?: string
  } = {}
) {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill() {
      this.emit("close")
    },
  })
  const requests: { method: string; params: Record<string, unknown> }[] = []
  child.stdin.on("data", (chunk) => {
    const req = JSON.parse(chunk.toString())
    if (!req.id) return
    requests.push(req)
    let result: unknown = {}
    if (req.method === "account/read")
      result = { account: { type: options.account ?? "chatgpt" } }
    if (req.method === "thread/start")
      result = { thread: { id: "thread-test" } }
    if (req.method === "turn/start") {
      result = { turn: { id: "turn-test" } }
      if (!options.silent) {
        // 완료 알림이 turn/start 응답보다 먼저 도착하는 경우도 처리한다.
        child.stdout.write(
          JSON.stringify({
            method: "item/completed",
            params: {
              threadId: "other",
              turnId: "wrong",
              item: { type: "agentMessage", text: "invalid" },
            },
          }) + "\n"
        )
        child.stdout.write(
          JSON.stringify({
            method: "item/completed",
            params: {
              threadId: "thread-test",
              turnId: "turn-test",
              item: {
                type: "agentMessage",
                text: options.text ?? JSON.stringify(actions(todoAction())),
              },
            },
          }) + "\n"
        )
        child.stdout.write(
          JSON.stringify({
            method: "turn/completed",
            params: {
              threadId: "thread-test",
              turn: { id: "turn-test", status: options.status ?? "completed" },
            },
          }) + "\n"
        )
      }
    }
    child.stdout.write(JSON.stringify({ id: req.id, result }) + "\n")
  })
  const planner = new CodexCommandPlanner(
    { find: async () => "fake", start: () => new CodexRPC(child as never) },
    100
  )
  return { planner, requests }
}
test("공식 thread/turn RPC와 완료 알림을 처리하고 선택한 모델·사고 수준을 전달한다", async () => {
  const { planner, requests } = fakePlanner()
  const result = await planner.plan("{}", {
    model: "selected-model",
    reasoningEffort: "low",
  })
  assert.equal(result.actions[0].domain, "todos")
  const thread = requests.find((r) => r.method === "thread/start")!.params
  assert.equal(thread.ephemeral, true)
  assert.equal(thread.sandbox, "read-only")
  const turn = requests.find((r) => r.method === "turn/start")!.params
  assert.equal(turn.model, "selected-model")
  assert.equal(turn.effort, "low")
  assert.ok(turn.outputSchema)
})
test("실패·중단·손상된 응답·시간 초과·비 ChatGPT 계정은 저장 계획으로 취급하지 않는다", async () => {
  for (const options of [
    { status: "failed" },
    { status: "interrupted" },
    { text: "not-json" },
    { silent: true },
    { account: "apiKey" },
  ]) {
    const { planner } = fakePlanner(options)
    await assert.rejects(
      planner.plan("{}", { model: null, reasoningEffort: null })
    )
  }
})
test("명령 IPC는 등록된 창·최상위 프레임만 허용하고 종료 시 해제한다", async () => {
  const env = await setup(async () => actions(todoAction()))
  const win = new BrowserWindow()
  try {
    registerCommands(
      win as never,
      env.calendar,
      env.todos,
      env.settings,
      () => {}
    )
    const execute = handlers.get("commands:execute")!
    assert.throws(
      () => execute({ sender: {}, senderFrame: {} }, "추가"),
      /허용/
    )
    assert.throws(
      () => execute({ sender: win.webContents, senderFrame: {} }, "추가"),
      /허용/
    )
    const result = (await execute(win.event(), " ")) as CommandResult
    assert.equal(result.status, "error")
  } finally {
    win.emit("closed")
    assert.equal(handlers.has("commands:execute"), false)
    await env.cleanup()
  }
})

test("수동 저장 중 도착한 AI 변경 알림은 작업 종료 후 새로고침한다", async () => {
  const { CalendarStore } =
    await import("../src/renderer/src/entities/calendar-event/model/calendar-store")
  const { TodoStore } =
    await import("../src/renderer/src/features/todos/model/todo-store")
  const event = {
    ...eventAction().event,
    id: crypto.randomUUID(),
    allDay: false as const,
    referenceUrls: [],
    openLinks: "never" as const,
    notifyOS: true,
    notifyInApp: true,
  }
  const todo = { ...todoAction().todo, id: crypto.randomUUID() }
  for (const domain of ["calendar", "todos"]) {
    let release!: () => void
    let latest = false
    const loadCalendar = async () => ({
      events: [{ ...event, title: latest ? "AI 변경" : "기존" }],
      revision: latest ? "2" : "1",
      path: "test",
    })
    const loadTodos = async () => ({
      items: [{ ...todo, title: latest ? "AI 변경" : "기존" }],
      revision: latest ? "2" : "1",
      path: "test",
    })
    const save = async () => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      throw new Error("충돌")
    }
    const store =
      domain === "calendar"
        ? new CalendarStore({
            load: loadCalendar,
            save,
            remove: loadCalendar,
            openLinks: async () => {},
            chooseFile: async () => null,
            onReminder: () => () => {},
          })
        : new TodoStore({ load: loadTodos, save, remove: loadTodos })
    await store.initialize()
    const pending =
      domain === "calendar"
        ? (store as InstanceType<typeof CalendarStore>).save(event, "1")
        : (store as InstanceType<typeof TodoStore>).save(todo, "1")
    latest = true
    await store.refresh()
    release()
    assert.equal(await pending, false)
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(store.getSnapshot().snapshot?.revision, "2")
    assert.equal(store.getSnapshot().error, "충돌")
  }
})
