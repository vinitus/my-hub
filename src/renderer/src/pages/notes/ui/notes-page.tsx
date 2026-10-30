import { useCallback, useEffect, useState } from "react"
import {
  FilePlus2Icon,
  FolderOpenIcon,
  SaveIcon,
  FileDownIcon,
  FileTextIcon,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { NoteEditor, NoteTitle } from "@/features/notes"

import type { useNote } from "@/features/notes"

export function NotesPage({
  memo,
  active = true,
}: {
  memo: ReturnType<typeof useNote>
  active?: boolean
}) {
  const { note, dirty, busy, error, change, save, newNote, open, report } = memo
  const [focusEditor, setFocusEditor] = useState<(() => void) | null>(null)
  const onFocusReady = useCallback((focus: () => void) => {
    setFocusEditor(() => focus)
  }, [])
  const focusBody = useCallback(() => focusEditor?.(), [focusEditor])

  useEffect(() => {
    if (active && document.hasFocus()) focusEditor?.()
  }, [active, note.key, focusEditor])

  useEffect(() => {
    if (!active) return
    const onWindowFocus = () => focusEditor?.()
    window.addEventListener("focus", onWindowFocus)
    return () => window.removeEventListener("focus", onWindowFocus)
  }, [active, focusEditor])
  return (
    <section
      aria-label="Markdown 메모"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-8">
        <div className="mr-auto flex min-w-0 items-center gap-2 text-sm">
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
          <NoteTitle
            key={note.key}
            name={note.name}
            path={note.file?.path}
            busy={busy}
            onRename={memo.rename}
            onSave={(saveAs) => void save(saveAs)}
            onFocusBody={focusBody}
          />
          <span role="status" className="text-xs text-muted-foreground">
            {busy
              ? "처리 중…"
              : memo.saving
                ? "저장 중…"
                : memo.autosavePaused
                  ? "자동 저장 중지 · 다시 저장해 주세요"
                  : dirty
                    ? "저장 대기 중"
                    : note.file
                      ? "저장됨"
                      : "새 메모 · 아직 저장되지 않음"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void newNote()}
          title="새 메모 (Ctrl/Cmd+N)"
        >
          <FilePlus2Icon />새 메모
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void open()}
          title="Markdown 열기"
        >
          <FolderOpenIcon />
          열기
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void save()}
          title="지금 저장 (Ctrl/Cmd+S)"
        >
          <SaveIcon />
          지금 저장
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          onClick={() => void save(true)}
          title="다른 이름으로 저장 (Ctrl/Cmd+Shift+S)"
          aria-label="다른 이름으로 저장"
        >
          <FileDownIcon />
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <NoteEditor
          key={note.key}
          markdown={note.markdown}
          onChange={change}
          onError={report}
          disabled={busy}
          onFocusReady={onFocusReady}
        />
      </div>
      <footer className="flex justify-between gap-2 border-t px-6 py-2 text-xs text-muted-foreground">
        <span className="truncate" title={note.file?.path}>
          {note.file?.path ??
            memo.library?.directory ??
            "작성 내용은 이 기기에 임시 보관됩니다."}
        </span>
        <span className="shrink-0">
          {note.markdown.length.toLocaleString()}자 · Markdown
        </span>
      </footer>
    </section>
  )
}
