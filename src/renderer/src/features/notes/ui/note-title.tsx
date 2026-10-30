import { useRef, useState } from "react"

type Props = {
  name: string
  path?: string
  busy: boolean
  onRename: (name: string) => Promise<boolean | undefined>
  onSave: (saveAs: boolean) => void
  onFocusBody?: () => void
}

export function NoteTitle({
  name,
  path,
  busy,
  onRename,
  onSave,
  onFocusBody = () => {},
}: Props) {
  const [editing, setEditing] = useState(false)
  const title = name.replace(/\.md$/i, "")
  const [draft, setDraft] = useState(title)
  const submitting = useRef(false)
  const cancelled = useRef(false)

  function start() {
    if (busy) return
    cancelled.current = false
    setDraft(title)
    setEditing(true)
  }

  async function commit() {
    if (submitting.current || cancelled.current) return
    submitting.current = true
    try {
      const applied = await onRename(draft.trim() || "제목 없는 메모")
      if (applied) setEditing(false)
      return applied
    } finally {
      submitting.current = false
    }
  }

  return editing ? (
    <input
      autoFocus
      aria-label="메모 파일명"
      value={draft}
      placeholder="제목 없는 메모"
      readOnly={busy}
      className="h-7 w-44 rounded border border-input bg-background px-1 text-sm font-medium outline-none focus:ring-2 focus:ring-ring/50"
      onFocus={(event) =>
        event.currentTarget.setSelectionRange(
          0,
          draft.length
        )
      }
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault()
          event.stopPropagation()
          const saveAs = event.shiftKey
          void commit().then((applied) => {
            if (applied) onSave(saveAs)
          })
          return
        }
        if (event.key === "Enter") {
          event.preventDefault()
          event.stopPropagation()
          void commit().then((applied) => {
            if (applied) onFocusBody()
          })
        }
        if (event.key === "Tab") {
          event.preventDefault()
          event.stopPropagation()
          void commit().then((applied) => {
            if (applied) onFocusBody()
          })
        }
        if (event.key === "Escape") {
          event.preventDefault()
          event.stopPropagation()
          cancelled.current = true
          setEditing(false)
        }
      }}
    />
  ) : (
    <button
      type="button"
      className="max-w-44 truncate rounded px-1 text-left font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      title={`${path ?? name}\n더블클릭해서 파일명 변경`}
      aria-label={`${name}, 더블클릭하거나 Enter를 눌러 이름 변경`}
      disabled={busy}
      onDoubleClick={start}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "F2") {
          event.preventDefault()
          start()
        }
      }}
    >
      {title}
    </button>
  )
}
