import { z } from "zod"
import { randomUUID } from "node:crypto"
import { CalendarEventSchema, type CalendarSnapshot } from "../shared/calendar"
import { TodoSchema, type TodoSnapshot } from "../shared/todos"
import {
  CommandInputSchema,
  CommandPlanSchema,
  type CommandPlan,
  type CommandResult,
} from "../shared/command"
import { CodexCommandPlanner, NeedsConnection } from "./codex-command-planner"
import type { CalendarRepository } from "./calendar-repository"
import type { TodoRepository } from "./todo-repository"
import type { CodexSettings } from "./codex-settings"

export function validateCommandPlan(
  raw: unknown,
  calendar: CalendarSnapshot,
  todos: TodoSnapshot
) {
  const plan = CommandPlanSchema.parse(raw)
  if ((plan.kind === "actions") !== plan.actions.length > 0)
    throw new Error("AI 작업 계획이 일관되지 않습니다.")
  const targets = new Set<string>()
  return {
    plan,
    actions: plan.actions.map((action) => {
      if (action.operation === "create") {
        if (action.id !== null)
          throw new Error("새 항목의 ID가 올바르지 않습니다.")
      } else {
        const key = `${action.domain}:${action.id}`
        if (targets.has(key))
          throw new Error("같은 항목을 여러 번 변경할 수 없습니다.")
        targets.add(key)
        const exists =
          action.domain === "todos"
            ? todos.items.some((item) => item.id === action.id)
            : calendar.events.some((item) => item.id === action.id)
        if (!exists) throw new Error("변경할 항목을 찾을 수 없습니다.")
      }
      if (action.operation === "remove") {
        if (action.event !== null || action.todo !== null)
          throw new Error("삭제 요청을 확인해 주세요.")
        return { ...action, id: action.id!, event: null, todo: null }
      }
      const id = action.id ?? randomUUID()
      if (action.domain === "todos") {
        if (!action.todo || action.event !== null)
          throw new Error("할일 요청을 확인해 주세요.")
        return {
          ...action,
          id,
          todo: TodoSchema.parse({ ...action.todo, id }),
          event: null,
        }
      }
      if (!action.event || action.todo !== null)
        throw new Error("일정 요청을 확인해 주세요.")
      const existing = calendar.events.find((event) => event.id === action.id)
      const event = CalendarEventSchema.parse({
        referenceUrls: [],
        openLinks: "never",
        notifyOS: true,
        notifyInApp: true,
        ...existing,
        ...action.event,
        id,
      })
      return { ...action, id, event, todo: null }
    }),
  }
}

type ValidatedAction = {
  domain: "calendar" | "todos"
  operation: "create" | "update" | "remove"
  id: string
  event: CalendarSnapshot["events"][number] | null
  todo: TodoSnapshot["items"][number] | null
}
type Batch = {
  token: string
  actions: ValidatedAction[]
  calendar: CalendarSnapshot
  todos: TodoSnapshot
}

function describe(
  item:
    | CalendarSnapshot["events"][number]
    | TodoSnapshot["items"][number]
    | undefined
) {
  if (!item) return null
  if ("dueDate" in item)
    return `${item.title}\n마감: ${item.dueDate} · ${item.completed ? "완료" : "미완료"}`
  return `${item.title}\n${item.allDay ? "종일 · 종료일 제외 " : ""}${item.start} → ${item.end}\n${item.description}\n색상: ${item.color}`
}

export class CommandService {
  private running = false
  private disposed = false
  private pending: Batch | null = null
  private undoBatch: Batch | null = null
  private readonly calendar: Pick<
    CalendarRepository,
    "load" | "save" | "remove"
  >
  private readonly todos: Pick<TodoRepository, "load" | "save" | "remove">
  private readonly settings: Pick<CodexSettings, "read">
  private readonly changed: (domains: CommandResult["changed"]) => void
  private readonly planner: Pick<CodexCommandPlanner, "plan" | "dispose">
  private readonly now: () => Date
  constructor(
    calendar: Pick<CalendarRepository, "load" | "save" | "remove">,
    todos: Pick<TodoRepository, "load" | "save" | "remove">,
    settings: Pick<CodexSettings, "read">,
    changed: (domains: CommandResult["changed"]) => void,
    planner: Pick<
      CodexCommandPlanner,
      "plan" | "dispose"
    > = new CodexCommandPlanner(),
    now = () => new Date()
  ) {
    this.calendar = calendar
    this.todos = todos
    this.settings = settings
    this.changed = changed
    this.planner = planner
    this.now = now
  }
  dispose() {
    this.disposed = true
    this.pending = null
    this.undoBatch = null
    this.planner.dispose()
  }
  private error(message: string): CommandResult {
    return { status: "error", message, changed: [] }
  }
  private async assertCurrent(batch: Batch) {
    const [calendar, todos] = await Promise.all([
      this.calendar.load(),
      this.todos.load(),
    ])
    if (
      calendar.revision !== batch.calendar.revision ||
      todos.revision !== batch.todos.revision
    )
      throw new Error(
        "목록이 변경되었습니다. 최신 목록을 확인하고 다시 요청해 주세요."
      )
  }
  discard = async (token: unknown): Promise<void> => {
    if (!this.running && this.pending?.token === token) this.pending = null
  }
  execute = async (request: unknown): Promise<CommandResult> => {
    const parsed = CommandInputSchema.safeParse(request)
    if (!parsed.success) return this.error("요청을 500자 이내로 입력해 주세요.")
    if (this.running) return this.error("이전 AI 요청이 처리 중입니다.")
    if (this.disposed) return this.error("작업 창이 종료되었습니다.")
    this.running = true
    this.pending = null
    this.undoBatch = null
    try {
      const [calendar, todos, preferences] = await Promise.all([
        this.calendar.load(),
        this.todos.load(),
        this.settings.read(),
      ])
      const now = this.now()
      const context = JSON.stringify({
        request: parsed.data,
        currentLocalTime: now.toString(),
        currentInstant: now.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        calendar: calendar.events.map(
          ({ id, title, description, color, allDay, start, end }) => ({
            id,
            title,
            description,
            color,
            allDay,
            start,
            end,
          })
        ),
        todos: todos.items,
      })
      if (Buffer.byteLength(context) > 200000)
        throw new Error(
          "일정과 할일이 많아 한 번에 해석할 수 없습니다. 목록을 정리한 후 다시 시도해 주세요."
        )
      const raw: CommandPlan = await this.planner.plan(context, preferences)
      if (this.disposed)
        throw new Error("작업 창이 종료되어 변경하지 않았습니다.")
      const { plan, actions } = validateCommandPlan(raw, calendar, todos)
      if (plan.kind !== "actions")
        return {
          status: plan.kind === "answer" ? "success" : "clarification",
          message: plan.message,
          changed: [],
        }
      const batch = { token: randomUUID(), actions, calendar, todos }
      await this.assertCurrent(batch)
      if (this.disposed) throw new Error("작업 창이 종료되었습니다.")
      this.pending = batch
      return {
        status: "preview",
        message: plan.message,
        changed: [],
        preview: {
          token: batch.token,
          changes: actions.map((action) => ({
            id: action.id,
            domain: action.domain,
            operation: action.operation,
            before: describe(
              action.domain === "calendar"
                ? calendar.events.find((item) => item.id === action.id)
                : todos.items.find((item) => item.id === action.id)
            ),
            after: describe(action.event ?? action.todo ?? undefined),
          })),
        },
      }
    } catch (error) {
      return {
        ...this.error(this.errorMessage(error)),
        status: error instanceof NeedsConnection ? "needs-connection" : "error",
      }
    } finally {
      this.running = false
    }
  }
  apply = (token: unknown): Promise<CommandResult> => this.commit(token, false)
  undo = (token: unknown): Promise<CommandResult> => this.commit(token, true)

  private errorMessage(error: unknown) {
    return error instanceof z.ZodError
      ? "AI 작업 계획이 올바르지 않아 변경하지 않았습니다."
      : error instanceof Error
        ? error.message
        : "작업을 처리하지 못했습니다."
  }
  private async commit(token: unknown, undo: boolean): Promise<CommandResult> {
    if (this.running) return this.error("이전 AI 요청이 처리 중입니다.")
    if (this.disposed) return this.error("작업 창이 종료되었습니다.")
    const batch = undo ? this.undoBatch : this.pending
    if (!batch || batch.token !== token)
      return this.error(
        "작업이 만료되었거나 이미 처리되었습니다. 다시 요청해 주세요."
      )
    this.running = true
    // 토큰은 한 번만 소비한다. renderer는 계획이나 revision을 지정할 수 없다.
    if (undo) this.undoBatch = null
    else this.pending = null
    let { calendar, todos } = batch
    const domains = new Set<"calendar" | "todos">()
    const applied: string[] = []
    const inverses: ValidatedAction[] = []
    try {
      await this.assertCurrent(batch)
      for (const action of batch.actions) {
        if (this.disposed) throw new Error("작업 창이 종료되었습니다.")
        const previousEvent = calendar.events.find(
          (item) => item.id === action.id
        )
        const previousTodo = todos.items.find((item) => item.id === action.id)
        if (action.domain === "calendar") {
          calendar =
            action.operation === "remove"
              ? await this.calendar.remove({
                  id: action.id,
                  expectedRevision: calendar.revision,
                })
              : await this.calendar.save({
                  event: action.event!,
                  expectedRevision: calendar.revision,
                })
        } else {
          todos =
            action.operation === "remove"
              ? await this.todos.remove({
                  id: action.id,
                  expectedRevision: todos.revision,
                })
              : await this.todos.save({
                  todo: action.todo!,
                  expectedRevision: todos.revision,
                })
        }
        inverses.unshift({
          ...action,
          operation:
            action.operation === "create"
              ? "remove"
              : action.operation === "remove"
                ? "create"
                : "update",
          event: action.domain === "calendar" ? (previousEvent ?? null) : null,
          todo: action.domain === "todos" ? (previousTodo ?? null) : null,
        })
        domains.add(action.domain)
        applied.push(
          `${action.domain === "calendar" ? "일정" : "할일"} ${undo ? "복원" : action.operation === "create" ? "추가" : action.operation === "update" ? "수정" : "삭제"}: ${action.todo?.title ?? action.event?.title ?? previousTodo?.title ?? previousEvent?.title ?? action.id}`
        )
      }
      return {
        status: "success",
        message: `${applied.length}건 ${undo ? "실행 취소" : "저장"} 완료\n${applied.join("\n")}`,
        changed: [...domains],
        ...this.rememberUndo(undo, inverses, calendar, todos),
      }
    } catch (error) {
      return {
        status: applied.length ? "partial" : "error",
        changed: [...domains],
        message: applied.length
          ? `${applied.length}건만 ${undo ? "복원" : "저장"}했습니다.\n${applied.join("\n")}\n나머지 작업은 중단했습니다. 전체 요청을 다시 보내면 중복될 수 있습니다.\n${this.errorMessage(error)}`
          : this.errorMessage(error),
        ...this.rememberUndo(undo, inverses, calendar, todos),
      }
    } finally {
      this.running = false
      if (domains.size) this.changed([...domains])
    }
  }
  private rememberUndo(
    undo: boolean,
    actions: ValidatedAction[],
    calendar: CalendarSnapshot,
    todos: TodoSnapshot
  ) {
    if (undo || !actions.length || this.disposed) return {}
    this.undoBatch = { token: randomUUID(), actions, calendar, todos }
    return { undoToken: this.undoBatch.token }
  }
}
