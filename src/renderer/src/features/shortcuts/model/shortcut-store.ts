import type {
  Shortcut,
  ShortcutSnapshot,
  ShortcutsAPI,
} from "../../../../../shared/shortcuts"

type State = {
  snapshot: ShortcutSnapshot | null
  loading: boolean
  busy: boolean
  error: string
  notice: string
  recentIds: string[]
}
export function shortcutError(error: unknown) {
  return error instanceof Error
    ? error.message.replace(
        /^Error invoking remote method '[^']+': Error: /,
        ""
      )
    : "바로가기 작업에 실패했습니다."
}
export class ShortcutStore {
  private readonly api: ShortcutsAPI | undefined
  private state: State = {
    snapshot: null,
    loading: false,
    busy: false,
    error: "",
    notice: "",
    recentIds: [],
  }
  private readonly listeners = new Set<() => void>()
  private initialization: Promise<void> | undefined
  private generation = 0
  constructor(api: ShortcutsAPI | undefined) {
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
      [
        this.api.load,
        this.api.save,
        this.api.remove,
        this.api.reorder,
        this.api.choose,
        this.api.launch,
      ].some((fn) => typeof fn !== "function")
    )
      throw new Error(
        "바로가기 연결을 위해 Electron을 완전히 닫고 pnpm dev를 다시 실행해 주세요."
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
        this.publish({ loading: false, error: shortcutError(error) })
    }
  }
  private async action(
    run: (api: ShortcutsAPI) => Promise<ShortcutSnapshot | void>,
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
      this.publish({ busy: false, error: shortcutError(error) })
      return false
    }
  }
  save = (shortcut: Shortcut, expectedRevision: string) =>
    this.action(
      (api) => api.save({ shortcut, expectedRevision }),
      "바로가기를 저장했습니다."
    )
  remove = (id: string, expectedRevision: string) =>
    this.action(
      (api) => api.remove({ id, expectedRevision }),
      "바로가기를 삭제했습니다."
    )
  reorder = async (ids: string[], expectedRevision: string) => {
    const previous = this.state.snapshot
    if (this.state.busy || this.state.loading || !previous) return false
    const byId = new Map(previous.items.map((item) => [item.id, item]))
    const canReorder =
      ids.length === previous.items.length &&
      new Set(ids).size === ids.length &&
      ids.every((id) => byId.has(id))
    if (!canReorder)
      return this.action(
        (api) => api.reorder({ ids, expectedRevision }),
        "???? ??? ??????."
      )
    if (ids.every((id, index) => previous.items[index]?.id === id)) return true

    // ??? ?? ??? ?? ????, IPC ??? ??? ???? ????.
    const optimistic = { ...previous, items: ids.map((id) => byId.get(id)!) }
    this.publish({ snapshot: optimistic })
    const saved = await this.action(
      (api) => api.reorder({ ids, expectedRevision }),
      "???? ??? ??????."
    )
    if (!saved && this.state.snapshot === optimistic)
      this.publish({ snapshot: previous })
    return saved
  }
  launch = async (item: Shortcut) => {
    const expectedRevision = this.state.snapshot?.revision ?? ""
    const launched = await this.action(
      (api) => api.launch({ id: item.id, expectedRevision }),
      `${item.name} 열기 요청을 보냈습니다.`
    )
    // 앱 실행 중의 사용 이력만 유지한다. 삭제한 항목은 소비자가 최신 목록과 대조한다.
    if (launched) {
      this.publish({
        recentIds: [
          item.id,
          ...this.state.recentIds.filter((id) => id !== item.id),
        ].slice(0, 5),
      })
    }
    return launched
  }
  choose = async (kind: "program" | "folder") => this.requireAPI().choose(kind)
}
