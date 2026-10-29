import {
  inboxTextDraft,
  type InboxDestination,
  type InboxDraft,
  type InboxRendererAPI,
  type InboxSnapshot,
} from "../../../../../shared/inbox"

type State = {
  snapshot: InboxSnapshot | null
  loading: boolean
  busy: boolean
  error: string
  notice: string
}
export class InboxStore {
  private readonly api: InboxRendererAPI | undefined
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
  constructor(api: InboxRendererAPI | undefined) {
    this.api = api
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(patch: Partial<State>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
  private requireAPI() {
    if (!this.api)
      throw new Error("인박스를 사용하려면 Electron 앱을 다시 시작해 주세요.")
    return this.api
  }
  initialize = () => {
    this.initialization ??= this.refresh()
    return this.initialization
  }
  refresh = async () => {
    if (this.state.busy) return
    const generation = ++this.generation
    this.publish({ loading: true, error: "" })
    try {
      const snapshot = await this.requireAPI().load()
      if (generation === this.generation)
        this.publish({ snapshot, loading: false })
    } catch (error) {
      if (generation === this.generation)
        this.publish({ loading: false, error: this.message(error) })
    }
  }
  private message(error: unknown) {
    return error instanceof Error
      ? error.message.replace(
          /^Error invoking remote method '[^']+': Error: /,
          ""
        )
      : "인박스 작업에 실패했습니다."
  }
  report = (error: string) => this.publish({ error, notice: "" })
  private async action(
    run: (
      api: InboxRendererAPI,
      revision: string
    ) => Promise<InboxSnapshot | null | void>,
    notice: string
  ) {
    if (this.state.busy || this.state.loading || !this.state.snapshot)
      return false
    const revision = this.state.snapshot.revision
    ++this.generation
    this.publish({ busy: true, error: "", notice: "" })
    try {
      const snapshot = await run(this.requireAPI(), revision)
      this.publish({
        ...(snapshot ? { snapshot } : {}),
        busy: false,
        notice: snapshot === null ? "" : notice,
      })
      return snapshot !== null
    } catch (error) {
      this.publish({ busy: false, error: this.message(error) })
      return false
    }
  }
  capture = (drafts: InboxDraft[]) =>
    this.action(
      (api, expectedRevision) => api.capture({ drafts, expectedRevision }),
      "인박스에 수집했습니다."
    )
  captureText = (content: string, source: string) =>
    this.capture([inboxTextDraft(content, source)])
  captureFiles = (files: File[]) =>
    this.action(
      (api, revision) => api.captureFiles(files, revision),
      "파일을 인박스에 수집했습니다."
    )
  chooseFiles = () =>
    this.action(
      (api, revision) => api.chooseFiles(revision),
      "파일을 인박스에 수집했습니다."
    )
  process = (id: string, processed: boolean, destination?: InboxDestination) =>
    this.action(
      (api, expectedRevision) =>
        api.process({ id, processed, destination, expectedRevision }),
      processed ? "처리 완료로 표시했습니다." : "미처리 항목으로 되돌렸습니다."
    )
  remove = (id: string) =>
    this.action(
      (api, expectedRevision) => api.remove({ id, expectedRevision }),
      "인박스에서 삭제했습니다."
    )
  open = (id: string) =>
    this.action(
      (api, expectedRevision) => api.open({ id, expectedRevision }),
      "원본 열기를 요청했습니다."
    )
}
