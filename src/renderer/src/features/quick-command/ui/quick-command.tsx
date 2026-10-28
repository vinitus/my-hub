import { hasOpenDialog } from "@/shared/lib/has-open-dialog"
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
import { Button } from "@/shared/ui/button"
import {
  executeCommand,
  applyCommand,
  undoCommand,
  discardCommand,
  MAX_COMMAND_LENGTH,
  type CommandResult,
} from "../model/command-runner"

type Task = {
  id: string
  input: string
  status: CommandResult["status"] | "running"
  message: string
  preview?: CommandResult["preview"]
  undoToken?: string
}

export function QuickCommand({
  open,
  onOpenChange,
  runCommand = executeCommand,
  apply = applyCommand,
  undo = undoCommand,
  discard = discardCommand,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  runCommand?: typeof executeCommand
  apply?: typeof applyCommand
  undo?: typeof undoCommand
  discard?: typeof discardCommand
}) {
  const [draft, setDraft] = useState("")
  const [task, setTask] = useState<Task | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)
  const running = task?.status === "running"
  const reviewing = task?.status === "preview"

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
    if (!open && hasOpenDialog()) return
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
    if (!input || busyRef.current || reviewing) return
    busyRef.current = true
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
      const result = await runCommand(input)
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
    } finally {
      busyRef.current = false
    }
  }
  async function resolveTask(action: "apply" | "undo" | "discard") {
    const token = action === "undo" ? task?.undoToken : task?.preview?.token
    if (!task || !token || busyRef.current) return
    busyRef.current = true
    const current = task
    setTask({
      ...current,
      status: "running",
      message:
        action === "undo"
          ? "변경을 되돌리고 있습니다."
          : action === "discard"
            ? "변경을 취소하고 있습니다."
            : "변경을 저장하고 있습니다.",
    })
    try {
      const result =
        action === "discard"
          ? (await discard(token),
            {
              status: "success" as const,
              message: "변경하지 않고 취소했습니다.",
              changed: [],
            })
          : await (action === "undo" ? undo : apply)(token)
      setTask({ id: current.id, input: current.input, ...result })
    } catch (error) {
      setTask({
        id: current.id,
        input: current.input,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "처리 결과를 확인하지 못했습니다. 목록을 확인해 주세요.",
      })
    } finally {
      busyRef.current = false
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
      : task?.status === "preview"
        ? "변경 확인"
        : task?.status === "success"
          ? "완료"
          : task?.status === "needs-connection"
            ? "AI 연결 필요"
            : task?.status === "clarification"
              ? "추가 설명 필요"
              : task?.status === "partial"
                ? "일부 저장됨"
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
              캘린더 일정이나 할일 요청을 입력하세요. Enter로 전송하고 Escape로
              닫습니다. 변경은 미리보기를 확인한 뒤 적용합니다. 요청과 현재
              일정·할일 정보가 연결된 AI로 전송됩니다.
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
                placeholder="내일 오후 3시 팀 회의 / 금요일까지 보고서 할일 추가"
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
                disabled={!draft.trim() || running || reviewing}
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
          className="fixed right-4 bottom-4 z-40 max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg sm:right-6 sm:bottom-6"
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
              <p className="mt-2 max-h-64 overflow-auto text-xs leading-5 break-words whitespace-pre-wrap text-muted-foreground">
                {task.message}
              </p>
            </div>
            {!running && !reviewing && (
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
          {reviewing && task.preview && (
            <div className="mt-3">
              <ol
                aria-label="변경 미리보기"
                className="max-h-64 space-y-3 overflow-auto text-xs"
              >
                {task.preview.changes.map((change) => (
                  <li
                    key={`${change.domain}:${change.id}`}
                    className="rounded-md border p-2"
                  >
                    <p className="font-medium">
                      {change.domain === "calendar" ? "일정" : "할일"}{" "}
                      {change.operation === "create"
                        ? "추가"
                        : change.operation === "remove"
                          ? "삭제"
                          : "수정"}
                    </p>
                    <p className="mt-1 break-words whitespace-pre-wrap text-muted-foreground">
                      변경 전: {change.before ?? "없음"}
                    </p>
                    <p className="mt-1 break-words whitespace-pre-wrap">
                      변경 후: {change.after ?? "삭제됨"}
                    </p>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => void resolveTask("apply")}>
                  변경 적용
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void resolveTask("discard")}
                >
                  변경 취소
                </Button>
              </div>
            </div>
          )}
          {!running && task.undoToken && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void resolveTask("undo")}
            >
              실행 취소
            </Button>
          )}
          {!running && !reviewing && task.status !== "success" && (
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
