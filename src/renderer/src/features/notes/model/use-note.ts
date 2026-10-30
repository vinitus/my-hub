import { useEffect, useState, useSyncExternalStore } from "react"
import { NoteStore, hasNoteChanges } from "./note-store"

const DRAFT_KEY = "my-hub:markdown-draft:v1"

export function useNote(
  shortcutsEnabled = true,
  personalMode = false,
  afterSave?: () => Promise<unknown>
) {
  const api = window.api?.notes
  const [store] = useState(
    () =>
      new NoteStore(
        api,
        {
          read: () => JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"),
          write: (draft) =>
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)),
        },
        1000,
        afterSave
      )
  )
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => {
    store.setPersonalMode(personalMode)
  }, [store, personalMode])

  useEffect(() => {
    const stop = store.start()
    const unsubscribe = api?.onSaveBeforeClose(() => {
      void store.save().then((saved) => api.completeClose(saved === true))
    })
    const refresh = () => {
      if (store.getSnapshot().ready) void store.refresh()
    }
    window.addEventListener("focus", refresh)
    return () => {
      stop()
      unsubscribe?.()
      window.removeEventListener("focus", refresh)
    }
  }, [api, store])

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        !shortcutsEnabled ||
        event.defaultPrevented ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey
      )
        return
      const key = event.key.toLowerCase()
      if (!["s", "n"].includes(key)) return
      event.preventDefault()
      if (key === "s") void store.save(event.shiftKey)
      else void store.newNote()
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (hasNoteChanges(store.getSnapshot().note)) event.preventDefault()
    }
    window.addEventListener("keydown", listener)
    if (!api) window.addEventListener("beforeunload", beforeUnload)
    return () => {
      window.removeEventListener("keydown", listener)
      window.removeEventListener("beforeunload", beforeUnload)
    }
  }, [api, store, shortcutsEnabled])

  return {
    ...state,
    busy: state.busy || !state.ready,
    dirty: hasNoteChanges(state.note),
    error: state.error || state.libraryError || state.draftError,
    change: store.change,
    save: store.save,
    saveText: store.saveText,
    rename: store.rename,
    newNote: store.newNote,
    open: store.open,
    openNote: store.openNote,
    refresh: store.refresh,
    setFavorite: store.setFavorite,
    chooseDirectory: store.chooseDirectory,
    report: store.report,
  }
}
