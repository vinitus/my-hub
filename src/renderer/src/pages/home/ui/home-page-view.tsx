import { useId, useRef, useState, type Ref } from "react"
import {
  CalendarPlusIcon,
  LayoutGridIcon,
  ListTodoIcon,
  InboxIcon,
  Maximize2Icon,
  Minimize2Icon,
  PencilLineIcon,
  EllipsisIcon,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Textarea } from "@/shared/ui/textarea"
import { Calculator } from "@/features/calculator"
import type { ScratchpadSaveState } from "../model/use-scratchpad"
import type { InboxItem } from "../../../../../shared/inbox"
import { RecentInbox } from "./recent-inbox"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/ui/dropdown-menu"

export type HomePageViewProps = {
  text: string
  saveState: ScratchpadSaveState
  inputRef?: Ref<HTMLTextAreaElement>
  onTextChange: (text: string) => void
  onCreateTodo: () => void
  onCreateEvent: () => void
  onCreateShortcut: () => void
  onCreateInbox?: () => void
  recentInboxItems?: InboxItem[]
  inboxBusy?: boolean
  onOpenInbox?: (id: string) => void
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
  recentInboxItems = [],
  inboxBusy = false,
  onOpenInbox,
}: HomePageViewProps) {
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const [height, setHeight] = useState<number | null>(null)
  const resize = useRef<{ y: number; height: number } | null>(null)
  const saving = saveState.status === "saving"
  const saveError = saveState.status === "error" ? saveState.message : ""
  const savedName = saveState.status === "saved" ? saveState.name : null
  return (
    <section
      aria-label="홈"
      className="@container flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-auto px-4 py-4 md:px-6"
    >
      <div
        hidden={expanded}
        className={`${expanded ? "hidden" : "flex"} min-w-0 shrink-0 flex-col gap-3`}
      >
        <section
          aria-label="빠른 작업"
          className="flex min-w-0 flex-wrap items-center gap-2"
        >
          <h2 className="sr-only">빠른 작업</h2>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={onCreateTodo}
          >
            <ListTodoIcon />
            할일 추가
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={onCreateInbox}
            disabled={!onCreateInbox}
          >
            <InboxIcon />
            인박스 추가
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="sm" className="min-h-11" />}
              aria-label="빠른 작업 더 보기"
            >
              <EllipsisIcon />더 보기
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuItem
                className="whitespace-nowrap"
                onClick={onCreateEvent}
              >
                <CalendarPlusIcon />
                일정 추가
              </DropdownMenuItem>
              <DropdownMenuItem
                className="whitespace-nowrap"
                onClick={onCreateShortcut}
              >
                <LayoutGridIcon />
                바로가기 등록
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </section>
        <RecentInbox
          items={recentInboxItems}
          busy={inboxBusy}
          onOpen={onOpenInbox}
        />
      </div>
      <section
        aria-label="낙서장"
        style={!expanded && height !== null ? { height } : undefined}
        className={`flex min-h-64 min-w-0 flex-col rounded-xl border bg-card px-3 pt-2 ${!expanded && height !== null ? "shrink-0" : "flex-1"}`}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
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
          placeholder="떠오르는 생각을 자유롭게 적어보세요…"
          className="field-sizing-fixed min-h-32 w-full flex-1 resize-none rounded-none border-0 bg-transparent p-2 text-base leading-8 shadow-none focus-visible:ring-0 md:text-base"
        />
        {saveError && (
          <p role="alert" className="py-2 text-sm text-destructive">
            {saveError}
          </p>
        )}
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-2 text-xs text-muted-foreground">
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
        {!expanded && (
          <div
            role="separator"
            tabIndex={0}
            aria-label="낙서장 높이 조절"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={1600}
            aria-valuenow={height ?? 0}
            aria-valuetext={
              height === null
                ? "남는 공간에 자동 맞춤"
                : `${Math.round(height)}픽셀`
            }
            title="드래그 또는 위아래 화살표로 높이 조절 · Home 키로 자동 맞춤"
            className="flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-ring"
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              const initial =
                event.currentTarget.parentElement!.getBoundingClientRect()
                  .height
              resize.current = { y: event.clientY, height: initial }
              setHeight(initial)
            }}
            onPointerMove={(event) => {
              if (resize.current)
                setHeight(
                  Math.max(
                    256,
                    Math.min(
                      1600,
                      resize.current.height + event.clientY - resize.current.y
                    )
                  )
                )
            }}
            onPointerUp={(event) => {
              resize.current = null
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onLostPointerCapture={() => {
              resize.current = null
            }}
            onKeyDown={(event) => {
              if (event.key === "Home") {
                event.preventDefault()
                setHeight(null)
              } else if (["ArrowUp", "ArrowDown"].includes(event.key)) {
                event.preventDefault()
                const current =
                  event.currentTarget.parentElement!.getBoundingClientRect()
                    .height
                setHeight(
                  Math.max(
                    256,
                    Math.min(
                      1600,
                      current + (event.key === "ArrowUp" ? -32 : 32)
                    )
                  )
                )
              }
            }}
          >
            <span aria-hidden className="h-0.5 w-8 rounded-full bg-border" />
          </div>
        )}
      </section>
      <div hidden={expanded} className="shrink-0">
        <Calculator />
      </div>
    </section>
  )
}
