import { useId, type Ref } from "react"
import { CalendarPlusIcon, LayoutGridIcon, ListTodoIcon } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Textarea } from "@/shared/ui/textarea"
import { Calculator } from "@/features/calculator"
import type { ScratchpadSaveState } from "../model/use-scratchpad"

export type HomePageViewProps = {
  text: string
  saveState: ScratchpadSaveState
  inputRef?: Ref<HTMLTextAreaElement>
  onTextChange: (text: string) => void
  onCreateTodo: () => void
  onCreateEvent: () => void
  onCreateShortcut: () => void
}

export function HomePageView({
  text,
  saveState,
  inputRef,
  onTextChange,
  onCreateTodo,
  onCreateEvent,
  onCreateShortcut,
}: HomePageViewProps) {
  const id = useId()
  const saving = saveState.status === "saving"
  const saveError = saveState.status === "error" ? saveState.message : ""
  const savedName = saveState.status === "saved" ? saveState.name : null
  return (
    <section
      aria-label="낙서장"
      className="flex min-h-0 flex-1 flex-col overflow-auto px-4 md:px-6"
    >
      <div className="flex min-h-64 flex-1 flex-col pt-4">
        <label htmlFor={`${id}-memo`} className="sr-only">
          낙서장 내용
        </label>
        <Textarea
          ref={inputRef}
          id={`${id}-memo`}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          disabled={saving}
          className="field-sizing-fixed min-h-48 flex-1 resize-none rounded-lg p-4 text-base leading-8 md:text-base"
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
      </div>
      <div className="shrink-0 border-t py-2">
        <div
          className="flex flex-wrap items-center gap-1"
          aria-label="빠른 등록"
        >
          <Button variant="ghost" size="sm" onClick={onCreateTodo}>
            <ListTodoIcon />
            할일 등록
          </Button>
          <Button variant="ghost" size="sm" onClick={onCreateEvent}>
            <CalendarPlusIcon />
            일정 등록
          </Button>
          <Button variant="ghost" size="sm" onClick={onCreateShortcut}>
            <LayoutGridIcon />
            바로가기 등록
          </Button>
        </div>
        <Calculator />
      </div>
    </section>
  )
}
