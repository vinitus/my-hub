import { useId, useState, type Ref } from "react"
import {
  CalendarPlusIcon,
  LayoutGridIcon,
  ListTodoIcon,
  InboxIcon,
  Maximize2Icon,
  Minimize2Icon,
  PencilLineIcon,
  ZapIcon,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Textarea } from "@/shared/ui/textarea"
import { Calculator } from "@/features/calculator"
import type { ScratchpadSaveState } from "../model/use-scratchpad"
import type { NoteSummary } from "../../../../../shared/notes"
import { RecentNotes } from "./recent-notes"

export type HomePageViewProps = {
  text: string
  saveState: ScratchpadSaveState
  inputRef?: Ref<HTMLTextAreaElement>
  onTextChange: (text: string) => void
  onCreateTodo: () => void
  onCreateEvent: () => void
  onCreateShortcut: () => void
  onCreateInbox?: () => void
  recentNotes?: NoteSummary[]
  notesBusy?: boolean
  onOpenNote?: (name: string) => void
}

export function HomePageView({
  text,
  saveState,
  inputRef,
  onTextChange,
  onCreateTodo,
  onCreateEvent,
  onCreateShortcut,
  onCreateInbox,
  recentNotes = [],
  notesBusy = false,
  onOpenNote,
}: HomePageViewProps) {
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const saving = saveState.status === "saving"
  const saveError = saveState.status === "error" ? saveState.message : ""
  const savedName = saveState.status === "saved" ? saveState.name : null
  return (
    <section
      aria-label="홈"
      className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-5 md:px-6"
    >
      <div
        hidden={expanded}
        className={`${expanded ? "hidden" : "grid"} shrink-0 grid-cols-1 gap-4 @[640px]:grid-cols-2`}
      >
        <RecentNotes
          notes={recentNotes}
          busy={notesBusy || saving}
          onOpen={onOpenNote}
        />
        <section
          aria-label="빠른 작업"
          className="min-w-0 rounded-xl border bg-card p-4"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ZapIcon aria-hidden className="size-4 text-muted-foreground" />
            빠른 작업
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-auto min-h-11 justify-start whitespace-normal"
              onClick={onCreateTodo}
            >
              <ListTodoIcon />
              할일 추가
            </Button>
            <Button
              variant="outline"
              className="h-auto min-h-11 justify-start whitespace-normal"
              onClick={onCreateEvent}
            >
              <CalendarPlusIcon />
              일정 추가
            </Button>
            <Button
              variant="outline"
              className="h-auto min-h-11 justify-start whitespace-normal"
              onClick={onCreateShortcut}
            >
              <LayoutGridIcon />
              바로가기 등록
            </Button>
            <Button
              variant="outline"
              className="h-auto min-h-11 justify-start whitespace-normal"
              onClick={onCreateInbox}
              disabled={!onCreateInbox}
            >
              <InboxIcon />
              인박스에 추가
            </Button>
          </div>
        </section>
      </div>
      <section
        aria-label="낙서장"
        className={`flex shrink-0 flex-col rounded-xl border bg-card p-4 ${expanded ? "min-h-96 flex-1" : ""}`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <PencilLineIcon
              aria-hidden
              className="size-4 text-muted-foreground"
            />
            낙서장
          </h2>
          <Button
            variant="ghost"
            size="sm"
            aria-label={expanded ? "낙서장 축소" : "낙서장 확대"}
            aria-pressed={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <Minimize2Icon /> : <Maximize2Icon />}
            {expanded ? "축소" : "확대"}
          </Button>
        </div>
        <label htmlFor={`${id}-memo`} className="sr-only">
          낙서장 내용
        </label>
        <Textarea
          ref={inputRef}
          id={`${id}-memo`}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          disabled={saving}
          className={`field-sizing-fixed min-h-40 w-full rounded-lg p-3 text-base leading-8 md:text-base ${expanded ? "min-h-64 flex-1 resize-none" : "h-56 resize-y"}`}
        />
        {saveError && (
          <p role="alert" className="py-2 text-sm text-destructive">
            {saveError}
          </p>
        )}
        <div className="flex min-h-8 flex-wrap justify-between gap-2 py-2 text-xs text-muted-foreground">
          <span>저장 시 본문 일부를 AI로 전송해 제목을 만듭니다.</span>
          <span role="status" className="max-w-full break-words">
            {saving
              ? "AI 제목 생성·저장 중…"
              : savedName !== null
                ? savedName
                  ? `${savedName} 저장 완료`
                  : "메모로 저장했습니다."
                : "Ctrl+S로 메모 저장"}
          </span>
        </div>
      </section>
      <div
        hidden={expanded}
        className="shrink-0 rounded-xl border bg-card px-3 py-1"
      >
        <Calculator />
      </div>
    </section>
  )
}
