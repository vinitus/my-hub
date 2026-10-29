import { useEffect, useState } from "react"
import { CheckIcon, XIcon } from "lucide-react"
import { EventSheet } from "@/features/calendar"
import { ShortcutSheet } from "@/features/shortcuts"
import { TodoForm } from "@/features/todos"
import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import type { CalendarEvent } from "../../../../shared/calendar"
import type { Shortcut, ShortcutSelection } from "../../../../shared/shortcuts"
import type { Todo } from "../../../../shared/todos"
import type { HomeCreateSession } from "../model/use-home-create"

type Props = {
  session: HomeCreateSession | null
  busy: boolean
  error: string
  onClose: () => void
  onRetry: () => void
  onSaveTodo: (todo: Todo) => Promise<boolean>
  onSaveEvent: (event: CalendarEvent) => Promise<boolean>
  onSaveShortcut: (item: Shortcut) => Promise<boolean>
  onChoose: (
    kind: "program" | "folder" | "file"
  ) => Promise<ShortcutSelection | null>
  onChooseFile?: () => Promise<string | null | undefined>
}

export function HomeCreateDialog(props: Props) {
  const [notice, setNotice] = useState(0)
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(0), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])
  return (
    <>
      <HomeCreateContent
        {...props}
        onSaveTodo={async (todo) => {
          const saved = await props.onSaveTodo(todo)
          if (saved) setNotice((current) => current + 1)
          return saved
        }}
      />
      {notice > 0 && (
        <aside
          role="status"
          aria-label="할일 등록 결과"
          className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
        >
          <CheckIcon aria-hidden className="size-4 shrink-0" />
          <span>할일을 등록했습니다.</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="할일 등록 안내 닫기"
            onClick={() => setNotice(0)}
          >
            <XIcon />
          </Button>
        </aside>
      )}
    </>
  )
}

function HomeCreateContent({
  session,
  busy,
  error,
  onClose,
  onRetry,
  onSaveTodo,
  onSaveEvent,
  onSaveShortcut,
  onChoose,
  onChooseFile,
}: Props) {
  if (!session) return null
  if (session.revision !== null && session.kind === "event")
    return (
      <EventSheet
        presentation="dialog"
        event={session.event}
        existing={false}
        busy={busy}
        serverError={error}
        onSave={onSaveEvent}
        onClose={onClose}
        onDelete={async () => false}
        onChooseFile={onChooseFile}
      />
    )
  if (session.revision !== null && session.kind === "shortcut")
    return (
      <ShortcutSheet
        presentation="dialog"
        item={session.item}
        existing={false}
        busy={busy}
        error={error}
        onSave={onSaveShortcut}
        onChoose={onChoose}
        onClose={onClose}
        onDelete={async () => false}
      />
    )
  const ready = session.revision !== null
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        className="max-h-[calc(100svh-2rem)] gap-4 overflow-y-auto p-5 sm:max-w-[420px]"
        showCloseButton={!busy}
      >
        <DialogHeader className="gap-1.5 pr-6">
          <DialogTitle>
            {session.kind === "todo"
              ? "할일 등록"
              : session.kind === "event"
                ? "일정 등록"
                : "바로가기 등록"}
          </DialogTitle>
          <DialogDescription>
            {session.kind === "todo"
              ? "제목을 입력하고 필요한 경우 마감일을 지정하세요."
              : "현재 화면을 나가지 않고 새 항목을 등록합니다."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {ready ? (
          <TodoForm
            dialog
            item={session.kind === "todo" ? (session.todo ?? null) : null}
            busy={busy}
            onSave={onSaveTodo}
            onCancel={onClose}
          />
        ) : error ? (
          <Button variant="outline" onClick={onRetry}>
            다시 시도
          </Button>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            등록 정보를 불러오는 중…
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
