import type {
  CalendarAPI,
  CalendarEvent,
  CalendarSnapshot,
} from "../../../../../shared/calendar"

type State = {
  snapshot: CalendarSnapshot | null
  loading: boolean
  busy: boolean
  error: string
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message.replace(
        /^Error invoking remote method '[^']+': Error: /,
        ""
      )
    : "일정 작업에 실패했습니다."
}

export class CalendarStore {
  private readonly api: CalendarAPI | undefined
  private state: State = {
    snapshot: null,
    loading: false,
    busy: false,
    error: "",
  }
  private readonly listeners = new Set<() => void>()
  private generation = 0
  private initialization: Promise<void> | undefined
  constructor(api: CalendarAPI | undefined) {
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
      typeof this.api.load !== "function" ||
      typeof this.api.save !== "function" ||
      typeof this.api.remove !== "function"
    ) {
      throw new Error(
        "캘린더 연결을 위해 Electron 창을 닫고 pnpm dev를 다시 실행해 주세요."
      )
    }
    return this.api
  }
  initialize = () => {
    this.initialization ??= this.refresh()
    return this.initialization
  }
  refresh = async () => {
    if (this.state.busy) return
    const generation = ++this.generation
    this.publish({ loading: true })
    try {
      const snapshot = await this.requireAPI().load()
      if (generation === this.generation)
        this.publish({ snapshot, error: "", loading: false })
    } catch (error) {
      if (generation === this.generation)
        this.publish({ error: message(error), loading: false })
    }
  }
  private async mutate(
    action: (api: CalendarAPI) => Promise<CalendarSnapshot>
  ) {
    if (this.state.busy || this.state.loading) return false
    this.generation++
    this.publish({ busy: true })
    try {
      const snapshot = await action(this.requireAPI())
      this.publish({ snapshot, error: "", busy: false })
      return true
    } catch (error) {
      this.publish({ error: message(error), busy: false })
      return false
    }
  }
  save = (event: CalendarEvent, expectedRevision: string) =>
    this.mutate((api) => api.save({ event, expectedRevision }))
  remove = (id: string, expectedRevision: string) =>
    this.mutate((api) => api.remove({ id, expectedRevision }))
}
