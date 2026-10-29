import { useRef, useState } from "react"
import type {
  executeCommand,
  applyCommand,
  undoCommand,
  discardCommand,
  CommandResult,
} from "./command-runner"

type Task = {
  id: string
  input: string
  status: CommandResult["status"] | "running"
  message: string
  preview?: CommandResult["preview"]
  undoToken?: string
}

type CommandTaskOptions = {
  onOpenChange: (open: boolean) => void
  runCommand: typeof executeCommand
  apply: typeof applyCommand
  undo: typeof undoCommand
  discard: typeof discardCommand
}

// The request state lives as long as the mounted input, independently of its popup.
export function useCommandTask({
  onOpenChange,
  runCommand,
  apply,
  undo,
  discard,
}: CommandTaskOptions) {
  const [draft, setDraft] = useState("")
  const [task, setTask] = useState<Task | null>(null)
  const busyRef = useRef(false)
  const running = task?.status === "running"
  const reviewing = task?.status === "preview"

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
  return {
    draft,
    setDraft,
    task,
    setTask,
    running,
    reviewing,
    submit,
    resolveTask,
  }
}
