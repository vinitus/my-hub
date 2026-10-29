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
import {
  searchActions,
  type LauncherAction,
} from "../src/renderer/src/features/quick-command/model/action-search"

test("launcher scopes searches, ranks exact matches and handles local action phrases without executing", () => {
  const execute = () => {
    throw new Error("search must not execute")
  }
  const items: LauncherAction[] = [
    {
      id: "note",
      kind: "note",
      title: "보고서 회의 메모",
      description: "메모",
      label: "열기",
      execute,
    },
    {
      id: "todo",
      kind: "todo",
      title: "보고서",
      description: "미완료",
      label: "완료",
      execute,
    },
    {
      id: "code",
      kind: "shortcut",
      title: "VS Code",
      description: "프로그램",
      label: "실행",
      execute,
    },
    {
      id: "event",
      kind: "event",
      title: "회의",
      description: "2026-10-30",
      label: "열기",
      execute,
    },
  ]
  assert.deepEqual(
    searchActions(items, "보고서").map((item) => item.id),
    ["todo", "note"]
  )
  assert.deepEqual(
    searchActions(items, "메모 보고서 검색").map((item) => item.id),
    ["note"]
  )
  assert.deepEqual(
    searchActions(items, "할일 보고서 완료").map((item) => item.id),
    ["todo"]
  )
  assert.deepEqual(
    searchActions(items, "vscode 실행").map((item) => item.id),
    ["code"]
  )
  assert.deepEqual(
    searchActions(items, "일정 2026-10-30").map((item) => item.id),
    ["event"]
  )
  assert.deepEqual(
    searchActions(items, "메모 회의 보고서").map((item) => item.id),
    ["note"]
  )
  assert.equal(searchActions(items, "없는 항목").length, 0)
  assert.equal(searchActions(items, "constructor").length, 0)
  assert.deepEqual(
    searchActions(items, "보고서 완료해줘").map((item) => item.id),
    ["todo"]
  )
  assert.deepEqual(
    searchActions(items, "VS Code 실행해줘").map((item) => item.id),
    ["code"]
  )
  const registration: LauncherAction = {
    id: "register",
    kind: "command",
    title: "프로그램 등록",
    description: "바로가기 추가",
    label: "등록",
    execute,
  }
  assert.equal(
    searchActions([...items, registration], "프로그램 등록")[0]?.id,
    "register"
  )
})

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
async function executeConfirmed(service: CommandService, input: string) {
  const result = await service.execute(input)
  return result.preview ? service.apply(result.preview.token) : result
}

// 제목 또는 기본 1시간 적용 여부를 되물으며 clarification을 반환했던 입력이다.
// 응답을 mock하면 자연어 해석 회귀를 검출할 수 없으므로 실제 모델 평가로 남긴다.
// 명시적으로 켰을 때만 연결된 ChatGPT 계정으로 합성 컨텍스트를 전송한다.
// planner만 호출하며 사용자 목록을 읽거나 일정·할일을 저장하지 않는다.
for (const scenario of [
  {
    name: "내일 10시 회의와 모레 마감 자료 준비는 제목 재질문 없이 두 작업으로 해석한다",
    request: "내일 오전 10시 회의 추가하고 모레 마감 자료 준비 할일도 만들어줘",
    todoCount: 1,
  },
  {
    name: "종료 시간이 없는 회의는 확인 질문 없이 기본 1시간으로 해석한다",
    request: "내일 오전 10시 회의 추가",
    todoCount: 0,
  },
]) {
  test(
    `실제 모델 회귀: ${scenario.name}`,
    {
      skip: process.env.MY_HUB_LIVE_COMMAND_EVAL !== "1",
      timeout: 150000,
    },
    async () => {
      const planner = new CodexCommandPlanner()
      try {
        const plan = await planner.plan(
          JSON.stringify({
            request: scenario.request,
            currentLocalTime:
              "Wed Oct 28 2026 10:00:00 GMT+0900 (Korean Standard Time)",
            currentInstant: "2026-10-28T01:00:00.000Z",
            timeZone: "Asia/Seoul",
            calendar: [],
            todos: [],
          }),
          { model: null, reasoningEffort: null }
        )
        assert.equal(
          plan.kind,
          "actions",
          `제목·기본 1시간 적용을 재질문하지 않고 작업 계획을 반환해야 한다. 실제 응답: ${plan.message}`
        )
        assert.equal(plan.actions.length, 1 + scenario.todoCount)
        // 모델 출력은 실제 저장 경로와 동일한 검증도 통과해야 한다.
        validateCommandPlan(
          plan,
          { events: [], revision: "missing", path: "synthetic-calendar" },
          { items: [], revision: "missing", path: "synthetic-todos" }
        )
        for (const action of plan.actions) {
          assert.equal(action.operation, "create")
          assert.equal(action.id, null)
        }
        const calendar = plan.actions.filter(
          (action) => action.domain === "calendar"
        )
        const todos = plan.actions.filter((action) => action.domain === "todos")
        assert.equal(calendar.length, 1)
        assert.equal(todos.length, scenario.todoCount)
        const event = calendar[0].event
        assert.ok(event)
        assert.equal(event.title, "회의")
        assert.equal(event.allDay, false)
        assert.equal(
          Date.parse(event.start),
          Date.parse("2026-10-29T10:00:00+09:00")
        )
        assert.equal(
          Date.parse(event.end),
          Date.parse("2026-10-29T11:00:00+09:00")
        )
        if (scenario.todoCount)
          assert.deepEqual(todos[0].todo, {
            title: "자료 준비",
            dueDate: "2026-10-30",
            completed: false,
          })
      } finally {
        planner.dispose()
      }
    }
  )
}

test("한 요청으로 일정과 할일을 저장하고 실제 revision으로 수정·완료·삭제한다", async () => {
  let plan = actions(eventAction(), todoAction())
  const env = await setup(async () => plan)
  try {
    let result = await executeConfirmed(
      env.service,
      "내일 회의와 금요일 보고서 할일 추가"
    )
    assert.equal(result.status, "success", result.message)
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
    delete (plan.actions[0].todo as Record<string, unknown>).favorite
    result = await executeConfirmed(
      env.service,
      "보고서 완료하고 회의 제목 수정"
    )
    assert.equal(result.status, "success")
    assert.equal((await env.todos.load()).items[0].completed, true)
    assert.equal((await env.calendar.load()).events[0].title, "수정 회의")
    plan = actions(
      { ...todoAction(), operation: "remove", id: todo.id, todo: null },
      { ...eventAction(), operation: "remove", id: event.id, event: null }
    )
    assert.equal(
      (await executeConfirmed(env.service, "두 항목 삭제")).status,
      "success"
    )
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
      (await executeConfirmed(env.service, "보고서 할일 추가")).status,
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
    assert.equal((await executeConfirmed(env.service, "추가")).status, "error")
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
test("마감일 없는 할일을 만들고 기존 할일 수정 시 날짜와 즐겨찾기를 보존한다", async () => {
  const env = await setup(async () =>
    actions({
      ...todoAction(),
      todo: { title: "언젠가 할 일", completed: false },
    })
  )
  try {
    const plan = validateCommandPlan(
      actions({
        ...todoAction(),
        todo: { title: "언젠가 할 일", completed: false },
      }),
      await env.calendar.load(),
      await env.todos.load()
    )
    assert.equal(plan.actions[0]?.todo?.dueDate, undefined)
    const initial = await env.todos.load()
    const saved = await env.todos.save({
      todo: {
        id: crypto.randomUUID(),
        title: "기존 할일",
        dueDate: "2026-10-30",
        completed: false,
        favorite: true,
      },
      expectedRevision: initial.revision,
    })
    const item = saved.items[0]!
    const updated = validateCommandPlan(
      actions({
        ...todoAction(),
        operation: "update",
        id: item.id,
        todo: { title: "수정된 할일", completed: false },
      }),
      await env.calendar.load(),
      saved
    )
    assert.equal(updated.actions[0]?.todo?.dueDate, "2026-10-30")
    assert.equal(updated.actions[0]?.todo?.favorite, true)
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
    assert.equal((await executeConfirmed(env.service, "추가")).status, "error")
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
    const result = await executeConfirmed(env.service, "둘 다 추가")
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
    await executeConfirmed(env.service, "추가")
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
    assert.equal(
      (await executeConfirmed(env.service, "제목만 수정")).status,
      "success"
    )
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
    assert.equal((await executeConfirmed(env.service, " ")).status, "error")
    assert.equal(
      (await executeConfirmed(env.service, "a".repeat(501))).status,
      "error"
    )
    const first = executeConfirmed(env.service, "추가")
    while (!release) await new Promise((resolve) => setTimeout(resolve, 1))
    assert.equal(
      (await executeConfirmed(env.service, "또 추가")).status,
      "error"
    )
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
    assert.equal(
      (await executeConfirmed(env.service, "추가")).status,
      "needs-connection"
    )
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
    for (const method of ["apply", "undo", "discard"]) {
      const handle = handlers.get(`commands:${method}`)!
      assert.throws(
        () => handle({ sender: {}, senderFrame: {} }, "token"),
        /허용/
      )
      assert.throws(
        () => handle({ sender: win.webContents, senderFrame: {} }, "token"),
        /허용/
      )
    }
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
    for (const method of ["execute", "apply", "undo", "discard"])
      assert.equal(handlers.has(`commands:${method}`), false)
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

test("미리보기는 쓰기 없이 전후 내용을 제공하고 취소·재요청·중복 적용을 보호한다", async () => {
  const env = await setup(async () => actions(todoAction(), eventAction()))
  try {
    const preview = await env.service.execute("둘 다 추가")
    assert.equal(preview.status, "preview")
    assert.equal((await env.todos.load()).revision, "missing")
    assert.equal((await env.calendar.load()).revision, "missing")
    assert.deepEqual(env.changed, [])
    assert.equal(preview.preview!.changes[0].before, null)
    assert.match(
      preview.preview!.changes[0].after!,
      /보고서.*\n마감: 2026-10-30/
    )
    await env.service.discard(preview.preview!.token)
    assert.equal(
      (await env.service.apply(preview.preview!.token)).status,
      "error"
    )
    const second = await env.service.execute("둘 다 추가")
    const third = await env.service.execute("둘 다 추가")
    assert.equal(
      (await env.service.apply(second.preview!.token)).status,
      "error"
    )
    const [one, two] = await Promise.all([
      env.service.apply(third.preview!.token),
      env.service.apply(third.preview!.token),
    ])
    assert.equal(one.status, "success")
    assert.equal(two.status, "error")
    assert.equal((await env.todos.load()).items.length, 1)
    assert.equal(
      (await env.service.apply(third.preview!.token)).status,
      "error"
    )
  } finally {
    await env.cleanup()
  }
})

test("미리보기 이후 수동 변경과 임의 토큰은 저장 전에 거부한다", async () => {
  const env = await setup(async () => actions(eventAction(), todoAction()))
  try {
    const result = await env.service.execute("둘 다 추가")
    assert.equal((await env.service.apply("forged")).status, "error")
    await env.todos.save({
      todo: { ...todoAction().todo, id: crypto.randomUUID() },
      expectedRevision: "missing",
    })
    assert.equal(
      (await env.service.apply(result.preview!.token)).status,
      "error"
    )
    assert.equal((await env.calendar.load()).events.length, 0)
    assert.equal((await env.todos.load()).items.length, 1)
  } finally {
    await env.cleanup()
  }
})

test("추가·수정·삭제 실행 취소는 원래 ID와 일정 링크·알림을 복원한다", async () => {
  let plan = actions(eventAction(), todoAction())
  const env = await setup(async () => plan)
  try {
    const created = await executeConfirmed(env.service, "추가")
    assert.ok(created.undoToken)
    assert.equal((await env.service.undo(created.undoToken)).status, "success")
    assert.equal((await env.todos.load()).items.length, 0)
    assert.equal((await env.calendar.load()).events.length, 0)
    assert.equal((await env.service.undo(created.undoToken)).status, "error")
    await executeConfirmed(env.service, "추가")
    const cal = await env.calendar.load()
    const original = {
      ...cal.events[0],
      referenceUrls: ["https://example.com"],
      openLinks: "at-start" as const,
      notifyOS: false,
      notifyInApp: false,
    }
    await env.calendar.save({ event: original, expectedRevision: cal.revision })
    const originalTodo = (await env.todos.load()).items[0]
    plan = actions(
      {
        ...eventAction(),
        operation: "update",
        id: original.id,
        event: { ...eventAction().event, title: "수정" },
      },
      { ...todoAction(), operation: "remove", id: originalTodo.id, todo: null }
    )
    const preview = await env.service.execute("수정 및 삭제")
    assert.match(preview.preview!.changes[0].before!, /회의/)
    assert.match(preview.preview!.changes[0].after!, /수정/)
    assert.equal(preview.preview!.changes[1].after, null)
    const saved = await env.service.apply(preview.preview!.token)
    assert.equal((await env.service.undo(saved.undoToken)).status, "success")
    assert.deepEqual((await env.calendar.load()).events[0], original)
    assert.deepEqual((await env.todos.load()).items[0], originalTodo)
    plan = actions({
      ...eventAction(),
      operation: "remove",
      id: original.id,
      event: null,
    })
    const deleted = await executeConfirmed(env.service, "일정 삭제")
    assert.equal((await env.service.undo(deleted.undoToken)).status, "success")
    assert.deepEqual((await env.calendar.load()).events[0], original)
  } finally {
    await env.cleanup()
  }
})

test("실행 취소는 이후 수동 변경을 덮어쓰지 않고 새 요청·종료 시 만료된다", async () => {
  const env = await setup(async () => actions(todoAction()))
  try {
    const first = await executeConfirmed(env.service, "추가")
    const snapshot = await env.todos.load()
    await env.todos.save({
      todo: { ...snapshot.items[0], title: "수동 편집" },
      expectedRevision: snapshot.revision,
    })
    assert.equal((await env.service.undo(first.undoToken)).status, "error")
    assert.equal((await env.todos.load()).items[0].title, "수동 편집")
    const second = await executeConfirmed(env.service, "또 추가")
    const preview = await env.service.execute("새 요청")
    assert.equal((await env.service.undo(second.undoToken)).status, "error")
    env.service.dispose()
    assert.equal(
      (await env.service.apply(preview.preview!.token)).status,
      "error"
    )
  } finally {
    await env.cleanup()
  }
})

test("일부 저장은 저장된 항목만 실행 취소하며 취소 중 실패도 실제 복원 내역을 표시한다", async () => {
  const env = await setup(async () => actions(eventAction(), todoAction()))
  try {
    env.todos.save = async () => {
      throw new Error("디스크 오류")
    }
    const result = await executeConfirmed(env.service, "둘 다 추가")
    assert.equal(result.status, "partial")
    assert.ok(result.undoToken)
    assert.equal((await env.service.undo(result.undoToken)).status, "success")
    assert.equal((await env.calendar.load()).events.length, 0)
  } finally {
    await env.cleanup()
  }
  const second = await setup(async () => actions(eventAction(), todoAction()))
  try {
    const result = await executeConfirmed(second.service, "둘 다 추가")
    second.calendar.remove = async () => {
      throw new Error("디스크 오류")
    }
    const undone = await second.service.undo(result.undoToken)
    assert.equal(undone.status, "partial")
    assert.deepEqual(undone.changed, ["todos"])
    assert.equal(undone.undoToken, undefined)
    assert.match(undone.message, /1건만 복원/)
    assert.equal((await second.calendar.load()).events.length, 1)
    assert.equal((await second.todos.load()).items.length, 0)
  } finally {
    await second.cleanup()
  }
})
