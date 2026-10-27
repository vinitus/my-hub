import type { Todo, TodoSnapshot, TodosAPI } from "../../../../../shared/todos"

type State = {
  snapshot: TodoSnapshot | null
  loading: boolean
  busy: boolean
  error: string
  notice: string
}
export function todoError(error: unknown) {
  return error instanceof Error
    ? error.message.replace(
        /^Error invoking remote method '[^']+': Error: /,
        ""
      )
    : "할일 작업에 실패했습니다."
}
export class TodoStore {
  private readonly api: TodosAPI | undefined
  private state: State = {
    snapshot: null,
    loading: false,
    busy: false,
    error: "",
    notice: "",
  }
  private readonly listeners = new Set<() => void>()
  private initialization: Promise<void> | undefined
  private generation = 0
  constructor(api: TodosAPI | undefined) {
    this.api = api
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(next: Partial<State>) {
    this.state = { ...this.state, ...next }
    for (const listener of this.listeners) listener()
  }
  private requireAPI() {
    if (
      !this.api ||
      [this.api.load, this.api.save, this.api.remove].some(
        (fn) => typeof fn !== "function"
      )
    )
      throw new Error(
        "할일 연결을 위해 Electron을 완전히 닫고 pnpm dev를 다시 실행해 주세요."
      )
    return this.api
  }
  initialize = () => {
    this.initialization ??= this.refresh()
    return this.initialization
  }
  clearFeedback = () => this.publish({ error: "", notice: "" })
  refresh = async () => {
    if (this.state.busy) return
    const generation = ++this.generation
    this.publish({ loading: true, notice: "" })
    try {
      const snapshot = await this.requireAPI().load()
      if (generation === this.generation)
        this.publish({ snapshot, loading: false, error: "" })
    } catch (error) {
      if (generation === this.generation)
        this.publish({ loading: false, error: todoError(error) })
    }
  }
  private async action(
    run: (api: TodosAPI) => Promise<TodoSnapshot | void>,
    notice: string
  ) {
    if (this.state.busy || this.state.loading || !this.state.snapshot)
      return false
    this.generation++
    this.publish({ busy: true, error: "", notice: "" })
    try {
      const snapshot = await run(this.requireAPI())
      this.publish({ ...(snapshot ? { snapshot } : {}), busy: false, notice })
      return true
    } catch (error) {
      this.publish({ busy: false, error: todoError(error) })
      return false
    }
  }
  save = (todo: Todo, expectedRevision: string) =>
    this.action(
      (api) => api.save({ todo, expectedRevision }),
      "할일을 저장했습니다."
    )
  remove = (id: string, expectedRevision: string) =>
    this.action(
      (api) => api.remove({ id, expectedRevision }),
      "할일을 삭제했습니다."
    )
}
