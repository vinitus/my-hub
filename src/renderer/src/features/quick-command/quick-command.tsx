import { useEffect, useEffectEvent, useRef, useState } from "react"
import { Dialog } from "@base-ui/react/dialog"
import {
  ArrowUpIcon,
  CheckIcon,
  CircleAlertIcon,
  LoaderCircleIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  executeCommand,
  MAX_COMMAND_LENGTH,
  type CommandResult,
} from "./command-runner"

type Task = {
  id: string
  input: string
  status: CommandResult["status"] | "running"
  message: string
}

export function QuickCommand({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [draft, setDraft] = useState("")
  const [task, setTask] = useState<Task | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const running = task?.status === "running"

  const toggle = useEffectEvent((event: KeyboardEvent) => {
    if (
      !event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.shiftKey ||
      event.isComposing ||
      event.key.toLowerCase() !== "k"
    )
      return
    // 편집기의 링크 단축키보다 먼저 처리하되, 다른 등록/수정 모달은 가리지 않는다.
    if (
      !open &&
      document.querySelector(
        '[role="dialog"][data-open], [role="alertdialog"][data-open]'
      )
    )
      return
    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) onOpenChange(!open)
  })
  useEffect(() => {
    window.addEventListener("keydown", toggle, true)
    return () => window.removeEventListener("keydown", toggle, true)
  }, [])

  async function submit() {
    const input = draft.trim()
    if (!input || running) return
    const id = crypto.randomUUID()
    setTask({
      id,
      input,
      status: "running",
      message: "요청을 처리하고 있습니다.",
    })
    setDraft("")
    onOpenChange(false)
    try {
      const result = await executeCommand(input)
      setTask((current) =>
        current?.id === id ? { ...current, ...result } : current
      )
    } catch (error) {
      setTask((current) =>
        current?.id === id
          ? {
              ...current,
              status: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "요청을 처리하지 못했습니다.",
            }
          : current
      )
    }
  }
  const StatusIcon =
    task?.status === "running"
      ? LoaderCircleIcon
      : task?.status === "success"
        ? CheckIcon
        : CircleAlertIcon
  const statusLabel =
    task?.status === "running"
      ? "처리 중"
      : task?.status === "success"
        ? "완료"
        : task?.status === "needs-connection"
          ? "AI 연결 필요"
          : "처리 실패"

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/15 backdrop-blur-[2px]" />
          <Dialog.Popup
            initialFocus={inputRef}
            className="fixed top-[20vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl outline-none"
          >
            <Dialog.Title className="sr-only">빠른 AI 입력</Dialog.Title>
            <Dialog.Description className="sr-only">
              일정 추가나 메모 저장 요청을 한 줄로 입력하세요. Enter로 전송하고
              Escape로 닫습니다. AI 연결은 추가 작업이 필요합니다.
            </Dialog.Description>
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              <SparklesIcon
                aria-hidden="true"
                className="ml-2 size-4 shrink-0 text-muted-foreground"
              />
              <input
                ref={inputRef}
                aria-label="AI에게 요청할 내용"
                autoComplete="off"
                spellCheck={false}
                maxLength={MAX_COMMAND_LENGTH}
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="내일 오후 3시에 팀 회의 추가해줘"
                value={draft}
                onChange={(event) =>
                  setDraft(event.target.value.replace(/[\r\n]+/g, " "))
                }
                onKeyDown={(event) => {
                  // 한글 조합을 확정하는 Enter는 요청 전송에 사용하지 않는다.
                  if (
                    event.key === "Enter" &&
                    (event.nativeEvent.isComposing || event.keyCode === 229)
                  )
                    event.preventDefault()
                }}
              />
              <kbd
                aria-hidden="true"
                className="hidden text-[10px] text-muted-foreground sm:block"
              >
                Esc
              </kbd>
              <Button
                type="submit"
                size="icon-sm"
                aria-label="요청 전송"
                disabled={!draft.trim() || running}
              >
                <ArrowUpIcon />
              </Button>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      {task && (
        <aside
          aria-label="AI 작업 상태"
          className="fixed right-4 bottom-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg sm:right-6 sm:bottom-6"
        >
          <div className="flex items-start gap-3">
            <StatusIcon
              aria-hidden="true"
              className={`mt-0.5 size-4 shrink-0 ${running ? "animate-spin" : "text-muted-foreground"}`}
            />
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="min-w-0 flex-1"
            >
              <p className="text-sm font-medium">{statusLabel}</p>
              <p
                title={task.input}
                className="mt-1 truncate text-sm text-muted-foreground"
              >
                {task.input}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {task.message}
              </p>
            </div>
            {!running && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="작업 상태 닫기"
                onClick={() => setTask(null)}
              >
                <XIcon />
              </Button>
            )}
          </div>
          {!running && task.status !== "success" && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 ml-5 text-xs"
              onClick={() => {
                setDraft(task.input)
                onOpenChange(true)
              }}
            >
              입력 수정
            </Button>
          )}
        </aside>
      )}
    </>
  )
}
