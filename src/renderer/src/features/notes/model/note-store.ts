import type {
  NoteFile,
  NoteLibrarySnapshot,
  NotesAPI,
} from "../../../../../shared/notes"
import {
  DEFAULT_NOTE_NAME,
  normalizeNoteName,
} from "../../../../../shared/notes"
import { assertSupportedMarkdown } from "../lib/markdown"

type Note = {
  key: string
  name: string
  markdown: string
  savedMarkdown: string
  personalSourceKey?: string
  personal?: boolean
  file: NoteFile | null
}
type Draft = {
  name: string
  markdown: string
  savedMarkdown?: string
  filePath?: string
  personalSourceKey?: string
  personal?: boolean
}
type Storage = { read: () => unknown; write: (draft: Draft) => void }
type State = {
  note: Note
  library: NoteLibrarySnapshot | null
  ready: boolean
  busy: boolean
  saving: boolean
  autosavePaused: boolean
  error: string
  libraryError: string
  draftError: string
}

function emptyNote(markdown = "", name = DEFAULT_NOTE_NAME): Note {
  return {
    key: crypto.randomUUID(),
    name,
    markdown,
    savedMarkdown: "",
    file: null,
  }
}
export function hasNoteChanges(note: Note) {
  return (
    note.markdown !== note.savedMarkdown ||
    (!note.file && note.name !== DEFAULT_NOTE_NAME)
  )
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message.replace(
        /^Error invoking remote method '[^']+': Error: /,
        ""
      )
    : "메모 작업에 실패했습니다."
}

// React와 분리한 문서/파일 작업 상태다. 모든 저장·전환을 직렬화하여 늦은 응답이
// 다른 메모나 저장 도중의 입력을 덮어쓰지 않게 한다.
export class NoteStore {
  private readonly api: NotesAPI | undefined
  private readonly storage: Storage
  private readonly delay: number
  private readonly afterSave: (() => Promise<unknown>) | undefined
  private readonly listeners = new Set<() => void>()
  private state: State
  private draft: Draft | null = null
  private active = false
  private personalMode = false
  setPersonalMode = (personal: boolean) => {
    this.personalMode = personal
  }
  private initialization: Promise<void> | undefined
  private tail: Promise<unknown> = Promise.resolve()
  private manualCount = 0
  private refreshVersion = 0
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(
    api: NotesAPI | undefined,
    storage: Storage,
    delay = 1000,
    afterSave?: () => Promise<unknown>
  ) {
    this.api = api
    this.storage = storage
    this.delay = delay
    this.afterSave = afterSave
    let note = emptyNote()
    try {
      const draft = storage.read()
      if (
        draft &&
        typeof draft === "object" &&
        "markdown" in draft &&
        typeof draft.markdown === "string"
      ) {
        assertSupportedMarkdown(draft.markdown)
        const name =
          "name" in draft && typeof draft.name === "string"
            ? normalizeNoteName(draft.name)
            : DEFAULT_NOTE_NAME
        this.draft = {
          name,
          markdown: draft.markdown,
          savedMarkdown:
            "savedMarkdown" in draft && typeof draft.savedMarkdown === "string"
              ? draft.savedMarkdown
              : undefined,
          filePath:
            "filePath" in draft && typeof draft.filePath === "string"
              ? draft.filePath
              : undefined,
        }
        note = {
          ...emptyNote(draft.markdown, name),
          personal:
            "personal" in draft && typeof draft.personal === "boolean"
              ? draft.personal
              : undefined,
          personalSourceKey:
            "personalSourceKey" in draft &&
            typeof draft.personalSourceKey === "string"
              ? draft.personalSourceKey
              : this.draft.filePath
                ? `note:${this.draft.filePath.replace(/\\/g, "/").toLowerCase()}`
                : undefined,
        }
      }
    } catch {
      /* 손상된 초안은 파일을 건드리지 않고 빈 문서로 시작한다. */
    }
    this.state = {
      note,
      library: null,
      ready: !api,
      busy: false,
      saving: false,
      autosavePaused: false,
      error: "",
      libraryError: "",
      draftError: "",
    }
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
  private setNote(note: Note, extra: Partial<State> = {}) {
    let draftError = ""
    try {
      this.storage.write({
        name: note.name,
        markdown: note.markdown,
        savedMarkdown: note.savedMarkdown,
        filePath: note.file?.path,
        personalSourceKey: note.personalSourceKey,
        personal: note.personal,
      })
    } catch {
      draftError = "임시 복원이 불가능합니다. .md 파일로 저장해 주세요."
    }
    this.publish({ note, draftError, ...extra })
    this.api?.setDirty(hasNoteChanges(note))
    this.schedule()
  }
  report = (error: unknown) => this.publish({ error: message(error) })
  change = (markdown: string) =>
    this.setNote({
      ...this.state.note,
      markdown,
      personal:
        this.state.note.personal ??
        (this.state.note.file ? undefined : this.personalMode),
    })

  start = () => {
    this.active = true
    this.api?.setDirty(hasNoteChanges(this.state.note))
    this.initialization ??= this.initialize()
    this.schedule()
    return () => {
      this.active = false
      clearTimeout(this.timer)
    }
  }

  async initialize() {
    if (!this.api) return
    try {
      const library = await this.api.library()
      this.publish({ library })
      let note = this.state.note
      let error = ""
      const draft = this.draft
      if (draft?.filePath) {
        const entry = library.notes.find(
          (entry) => entry.path === draft.filePath
        )
        if (entry) {
          const file = await this.api.openFromLibrary(entry.name)
          assertSupportedMarkdown(file.markdown)
          if (draft.savedMarkdown === draft.markdown) {
            // 저장된 초안이면 디스크의 최신 내용을 사용한다.
            note = {
              ...emptyNote(),
              file,
              name: file.name,
              markdown: file.markdown,
              savedMarkdown: file.markdown,
            }
          } else if (draft.savedMarkdown === file.markdown) {
            note = { ...note, file, savedMarkdown: file.markdown }
          } else {
            note = {
              ...note,
              name: normalizeNoteName(`${note.name.slice(0, -3)} (복원)`),
            }
            error =
              "원본 파일이 외부에서 변경되어 초안을 별도 메모로 복원했습니다."
          }
        } else if (draft.savedMarkdown === draft.markdown) note = emptyNote()
      }
      this.setNote(note, { library, ready: true, error })
    } catch (error) {
      this.publish({
        ready: true,
        libraryError: message(error),
        autosavePaused: true,
      })
    }
  }

  private enqueue<T>(action: () => Promise<T>) {
    const result = this.tail.then(action)
    this.tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
  private run<T>(action: () => Promise<T>) {
    this.manualCount++
    clearTimeout(this.timer)
    this.publish({ busy: true })
    return this.enqueue(async () => {
      try {
        await this.initialization
        return await action()
      } catch (error) {
        this.report(error)
      } finally {
        this.manualCount--
        this.publish({ busy: this.manualCount > 0 })
        this.schedule()
      }
    })
  }

  private schedule() {
    clearTimeout(this.timer)
    const { note, ready, library, saving, autosavePaused } = this.state
    if (
      !this.active ||
      !this.api ||
      !ready ||
      !library ||
      saving ||
      this.manualCount ||
      autosavePaused ||
      !hasNoteChanges(note)
    )
      return
    this.timer = setTimeout(() => {
      void this.enqueue(async () => {
        if (
          !this.active ||
          this.manualCount ||
          this.state.note.key !== note.key ||
          this.state.autosavePaused ||
          !hasNoteChanges(this.state.note)
        )
          return
        await this.persist()
      })
    }, this.delay)
  }

  refresh = async () => {
    if (!this.api) return
    const version = ++this.refreshVersion
    try {
      const library = await this.api.library()
      if (version === this.refreshVersion)
        this.publish({ library, libraryError: "" })
    } catch (error) {
      if (version === this.refreshVersion)
        this.publish({ libraryError: message(error) })
    }
  }

  setFavorite = async (path: string, favorite: boolean) => {
    if (!this.api) return false
    try {
      const library = await this.api.setFavorite({ path, favorite })
      this.publish({ library, libraryError: "" })
      return true
    } catch (error) {
      this.publish({ libraryError: message(error) })
      return false
    }
  }

  private async persist(saveAs = false) {
    if (!this.api) {
      this.report(new Error("파일 저장은 Electron 앱에서 사용할 수 있습니다."))
      return false
    }
    let snapshot = this.state.note
    if (!snapshot.file && snapshot.personal === undefined) {
      snapshot = { ...snapshot, personal: this.personalMode }
      this.setNote(snapshot)
    }
    if (!saveAs && snapshot.file && !hasNoteChanges(snapshot)) return true
    this.publish({ saving: true })
    try {
      const file = await this.api.save({
        id: snapshot.file?.id ?? null,
        markdown: snapshot.markdown,
        name: snapshot.name,
        saveAs,
        ...(!snapshot.file ? { personal: snapshot.personal } : {}),
        ...(snapshot.personalSourceKey
          ? { personalSourceKey: snapshot.personalSourceKey }
          : {}),
      })
      if (!file) {
        this.publish({ saving: false })
        return false
      }
      // 새 개인 지정이 렌더러에 반영된 다음 파일을 공개해 목록과 편집기의 순간 노출을 막는다.
      await this.afterSave?.()
      const current = this.state.note
      this.setNote(
        {
          ...current,
          file,
          name: file.name,
          savedMarkdown: snapshot.markdown,
          personalSourceKey: undefined,
          personal: undefined,
        },
        { saving: false, autosavePaused: false, error: "" }
      )
      await this.refresh()
      return !hasNoteChanges(this.state.note)
    } catch (error) {
      this.publish({
        saving: false,
        autosavePaused: true,
        error: message(error),
      })
      return false
    }
  }
  save = (saveAs = false) => this.run(() => this.persist(saveAs))

  // 외부 작성 내용을 메모로 받아 기존 저장·복원·목록 갱신 경로를 사용한다.
  // 전달 후 다른 메모를 열었거나 본문이 바뀌었다면 별도 메모로 보존한다.
  saveText = (
    markdown: string,
    previous: { key: string; markdown: string } | null = null,
    title?: string,
    personalSourceKey?: string,
    personal = this.personalMode
  ) =>
    this.run(async () => {
      if (!this.api)
        throw new Error("파일 저장은 Electron 앱에서 사용할 수 있습니다.")
      assertSupportedMarkdown(markdown)
      const name = title === undefined ? undefined : normalizeNoteName(title)
      const current = this.state.note
      const reuse =
        current.key === previous?.key && current.markdown === previous.markdown
      if (!reuse) {
        if (hasNoteChanges(current) && !(await this.persist())) return
        this.setNote(
          { ...emptyNote(markdown, name), personalSourceKey, personal },
          {
            error: "",
            autosavePaused: false,
          }
        )
      } else {
        if (name && name !== current.name) {
          const file = current.file
            ? await this.api.rename({ id: current.file.id, name })
            : null
          if (this.state.note.markdown !== current.markdown) {
            // 느린 파일명 변경 중 메모 화면에서 입력한 내용을 덮어쓰지 않는다.
            this.setNote({ ...this.state.note, file, name: file?.name ?? name })
            return {
              key: current.key,
              markdown,
              name: file?.name ?? name,
              saved: false,
            }
          }
          this.setNote(
            { ...current, file, name: file?.name ?? name, markdown },
            { error: "" }
          )
        } else this.change(markdown)
      }
      const key = this.state.note.key
      const saved = await this.persist()
      return { key, markdown, name: this.state.note.name, saved }
    })

  rename = (value: string) =>
    this.run(async () => {
      const name = normalizeNoteName(value)
      const current = this.state.note
      if (name !== current.name) {
        if (current.file) {
          if (!this.api)
            throw new Error("파일명 변경은 Electron 앱에서 사용할 수 있습니다.")
          const file = await this.api.rename({ id: current.file.id, name })
          this.setNote(
            { ...this.state.note, file, name: file.name },
            { error: "" }
          )
          await this.refresh()
        } else
          this.setNote(
            {
              ...current,
              name,
              personal: current.personal ?? this.personalMode,
            },
            { error: "" }
          )
      }
      return true
    })

  private replace(target: "new" | "dialog" | { name: string }) {
    return this.run(async () => {
      if (hasNoteChanges(this.state.note) && !(await this.persist())) {
        if (!this.api) return
        const choice = await this.api.confirmReplace()
        if (
          choice === "cancel" ||
          (choice === "save" && !(await this.persist()))
        )
          return
      }
      if (target === "new") {
        this.setNote(
          { ...emptyNote(), personal: this.personalMode },
          { error: "", autosavePaused: false }
        )
        return
      }
      if (!this.api)
        throw new Error("파일 열기는 Electron 앱에서 사용할 수 있습니다.")
      const file =
        target === "dialog"
          ? await this.api.open()
          : await this.api.openFromLibrary(target.name)
      if (!file) return
      assertSupportedMarkdown(file.markdown)
      this.setNote(
        {
          key: crypto.randomUUID(),
          name: file.name,
          markdown: file.markdown,
          savedMarkdown: file.markdown,
          file,
        },
        { error: "", autosavePaused: false }
      )
    })
  }
  newNote = () => this.replace("new")
  open = () => this.replace("dialog")
  openNote = (name: string) => this.replace({ name })

  chooseDirectory = () =>
    this.run(async () => {
      if (!this.api)
        throw new Error("폴더 선택은 Electron 앱에서 사용할 수 있습니다.")
      const library = await this.api.chooseDirectory()
      if (library) {
        this.refreshVersion++
        this.publish({
          library,
          libraryError: "",
          autosavePaused: this.state.note.file
            ? this.state.autosavePaused
            : false,
        })
      }
    })
}
