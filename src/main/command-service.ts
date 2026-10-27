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

export class CommandService {
  private running = false
  private disposed = false
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
    this.planner.dispose()
  }
  execute = async (request: unknown): Promise<CommandResult> => {
    const parsed = CommandInputSchema.safeParse(request)
    if (!parsed.success)
      return {
        status: "error",
        message: "요청을 500자 이내로 입력해 주세요.",
        changed: [],
      }
    if (this.running)
      return {
        status: "error",
        message: "이전 AI 요청이 처리 중입니다.",
        changed: [],
      }
    if (this.disposed)
      return {
        status: "error",
        message: "작업 창이 종료되었습니다.",
        changed: [],
      }
    this.running = true
    const domains = new Set<"calendar" | "todos">()
    const applied: string[] = []
    try {
      const loaded = await Promise.all([
        this.calendar.load(),
        this.todos.load(),
        this.settings.read(),
      ])
      let [calendar, todos] = loaded
      const preferences = loaded[2]
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
      // 첫 쓰기 전에 모든 payload와 양쪽 revision을 확인한다. 이후 쓰기도 각 repository에서 revision을 검사한다.
      const [latestCalendar, latestTodos] = await Promise.all([
        this.calendar.load(),
        this.todos.load(),
      ])
      if (
        latestCalendar.revision !== calendar.revision ||
        latestTodos.revision !== todos.revision
      )
        throw new Error(
          "해석 중 목록이 변경되었습니다. 최신 목록을 확인하고 다시 요청해 주세요."
        )
      for (const action of actions) {
        if (this.disposed) throw new Error("작업 창이 종료되었습니다.")
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
        domains.add(action.domain)
        applied.push(
          `${action.domain === "calendar" ? "일정" : "할일"} ${action.operation === "create" ? "추가" : action.operation === "update" ? "수정" : "삭제"}: ${action.todo?.title ?? action.event?.title ?? action.id}`
        )
      }
      return {
        status: "success",
        message: `${applied.length}건 저장 완료\n${applied.join("\n")}\n${plan.message}`,
        changed: [...domains],
      }
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? "AI 작업 계획이 올바르지 않아 변경하지 않았습니다."
          : error instanceof Error
            ? error.message
            : "AI 작업 계획이 올바르지 않아 변경하지 않았습니다."
      return {
        status: applied.length
          ? "partial"
          : error instanceof NeedsConnection
            ? "needs-connection"
            : "error",
        message: applied.length
          ? `${applied.length}건만 저장했습니다.\n${applied.join("\n")}\n나머지 작업은 중단했습니다. 전체 요청을 다시 보내면 중복될 수 있습니다.\n${message}`
          : message,
        changed: [...domains],
      }
    } finally {
      this.running = false
      if (domains.size) this.changed([...domains])
    }
  }
}
