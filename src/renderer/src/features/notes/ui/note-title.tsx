import { useRef, useState } from "react"
import { Input } from "@/shared/ui/input"
import "./note-title.css"

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
  const title = name.replace(/\.md$/i, "")
  const [draft, setDraft] = useState(title)
  const [previousTitle, setPreviousTitle] = useState(title)
  const submitting = useRef(false)

  if (title !== previousTitle) {
    setPreviousTitle(title)
    setDraft(title)
  }

  async function commit() {
    if (submitting.current) return
    submitting.current = true
    try {
      return await onRename(draft.trim() || "제목 없는 메모")
    } finally {
      submitting.current = false
    }
  }

  return (
    <Input
      aria-label="메모 제목"
      value={draft}
      placeholder="제목 없는 메모"
      readOnly={busy}
      className="note-title-input h-7 w-auto min-w-0 rounded border border-transparent bg-transparent px-1 text-sm font-medium shadow-none outline-none placeholder:text-muted-foreground/70 focus:border-input focus:bg-background focus:ring-2 focus:ring-ring/50 focus-visible:border-input focus-visible:ring-2"
      title={`${path ?? name}\n.md 확장자는 저장할 때 자동으로 붙습니다.`}
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
          setDraft(title)
        }
      }}
    />
  )
}
