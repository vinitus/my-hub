import { useCallback, useEffect, useRef, useState } from "react"
import type { NoteFile } from "../../../../shared/notes"
import { DEFAULT_NOTE_NAME, normalizeNoteName } from "../../../../shared/notes"
import { assertSupportedMarkdown } from "./markdown"

const DRAFT_KEY = "my-hub:markdown-draft:v1"
type NoteState = {
  key: string
  name: string
  markdown: string
  savedMarkdown: string
  file: NoteFile | null
}

function emptyNote(markdown = "", name = DEFAULT_NOTE_NAME): NoteState {
  return {
    key: crypto.randomUUID(),
    name,
    markdown,
    savedMarkdown: "",
    file: null,
  }
}

function hasChanges(note: NoteState) {
  return (
    note.markdown !== note.savedMarkdown ||
    (!note.file && note.name !== DEFAULT_NOTE_NAME)
  )
}

function restoreDraft() {
  try {
    const draft: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null")
    if (
      draft &&
      typeof draft === "object" &&
      "markdown" in draft &&
      typeof draft.markdown === "string"
    ) {
      assertSupportedMarkdown(draft.markdown)
      // 재시작 시 이전 파일에 자동으로 덮어쓰지 않고 복원된 새 메모로 취급한다.
      const name =
        "name" in draft && typeof draft.name === "string"
          ? normalizeNoteName(draft.name)
          : DEFAULT_NOTE_NAME
      return emptyNote(draft.markdown, name)
    }
  } catch {
    /* 사용할 수 없는 초안은 새 메모로 시작한다. */
  }
  return emptyNote()
}

export function useNote() {
  const [note, setNote] = useState<NoteState>(restoreDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [draftError, setDraftError] = useState("")
  const noteRef = useRef(note)
  const busyRef = useRef(false)
  const dirty = hasChanges(note)
  const api = window.api?.notes

  // 비동기 저장 중에 입력한 내용은 저장 완료 시 덮어쓰지 않는다.
  const update = useCallback(
    (next: NoteState) => {
      noteRef.current = next
      setNote(next)
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ markdown: next.markdown, name: next.name })
        )
        setDraftError("")
      } catch {
        setDraftError("임시 복원이 불가능합니다. .md 파일로 저장해 주세요.")
      }
      api?.setDirty(hasChanges(next))
    },
    [api]
  )

  const change = useCallback(
    (markdown: string) => {
      update({ ...noteRef.current, markdown })
    },
    [update]
  )

  const report = useCallback((cause: unknown) => {
    setError(
      cause instanceof Error
        ? cause.message.replace(
            /^Error invoking remote method '[^']+': Error: /,
            ""
          )
        : "메모 작업에 실패했습니다."
    )
  }, [])

  const saveCurrent = useCallback(
    async (saveAs = false) => {
      const snapshot = noteRef.current
      if (!api) {
        setError(
          "파일 열기·저장은 Electron 앱에서 사용할 수 있습니다. pnpm dev로 실행해 주세요."
        )
        return false
      }
      try {
        const file = await api.save({
          id: snapshot.file?.id ?? null,
          markdown: snapshot.markdown,
          saveAs,
          name: snapshot.name,
        })
        if (!file) return false
        update({
          ...noteRef.current,
          file,
          name: file.name,
          savedMarkdown: snapshot.markdown,
        })
        setError("")
        // 저장 도중 추가 입력이 있었다면 닫기/교체를 진행하지 않는다.
        return noteRef.current.markdown === snapshot.markdown
      } catch (cause) {
        report(cause)
        return false
      }
    },
    [api, report, update]
  )

  const run = useCallback(
    async <T>(action: () => Promise<T>) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      try {
        return await action()
      } catch (cause) {
        report(cause)
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [report]
  )

  const save = useCallback(
    (saveAs = false) => run(() => saveCurrent(saveAs)),
    [run, saveCurrent]
  )

  const rename = useCallback(
    (value: string) =>
      run(async () => {
        const name = normalizeNoteName(value)
        const current = noteRef.current
        if (name !== current.name) {
          if (current.file) {
            if (!api)
              throw new Error(
                "파일명 변경은 Electron 앱에서 사용할 수 있습니다."
              )
            const file = await api.rename({ id: current.file.id, name })
            update({ ...noteRef.current, file, name: file.name })
          } else update({ ...current, name })
        }
        setError("")
        return true
      }),
    [api, run, update]
  )

  const replace = useCallback(
    (open: boolean) =>
      run(async () => {
        if (hasChanges(noteRef.current)) {
          if (!api) {
            setError(
              "현재 메모를 파일로 저장하려면 Electron 앱에서 실행해 주세요."
            )
            return
          }
          const choice = await api.confirmReplace()
          if (
            choice === "cancel" ||
            (choice === "save" && !(await saveCurrent()))
          )
            return
        }
        if (open) {
          if (!api) {
            setError("파일 열기는 Electron 앱에서 사용할 수 있습니다.")
            return
          }
          const file = await api.open()
          if (!file) return
          assertSupportedMarkdown(file.markdown)
          update({
            key: crypto.randomUUID(),
            name: file.name,
            markdown: file.markdown,
            savedMarkdown: file.markdown,
            file,
          })
        } else update(emptyNote())
        setError("")
      }),
    [api, run, saveCurrent, update]
  )

  useEffect(() => {
    api?.setDirty(hasChanges(noteRef.current))
    return api?.onSaveBeforeClose(() => {
      if (busyRef.current) {
        api.completeClose(false)
        return
      }
      void run(async () => {
        api.completeClose(await saveCurrent())
      })
    })
  }, [api, run, saveCurrent])

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey
      )
        return
      const key = event.key.toLowerCase()
      if (!["s", "o", "n"].includes(key)) return
      event.preventDefault()
      if (key === "s") void save(event.shiftKey)
      else void replace(key === "o")
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (hasChanges(noteRef.current)) event.preventDefault()
    }
    window.addEventListener("keydown", listener)
    // 데스크톱 창 닫기는 main의 저장 확인 창으로 처리한다.
    if (!api) window.addEventListener("beforeunload", beforeUnload)
    return () => {
      window.removeEventListener("keydown", listener)
      window.removeEventListener("beforeunload", beforeUnload)
    }
  }, [api, replace, save])

  return {
    note,
    dirty,
    busy,
    error: error || draftError,
    change,
    save,
    rename,
    newNote: () => replace(false),
    open: () => replace(true),
    report,
  }
}
