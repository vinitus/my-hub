import { useEffect, useEffectEvent, useRef, useState } from "react"
import { hasOpenDialog } from "@/shared/lib/has-open-dialog"

export type ScratchpadSaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; name: string }
  | { status: "error"; message: string }
export type SaveScratchpad = (
  text: string
) => Promise<boolean | { name: string }>

export function useScratchpad(active: boolean, onSave: SaveScratchpad) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const submitting = useRef(false)
  const [text, setText] = useState("")
  const [saveState, setSaveState] = useState<ScratchpadSaveState>({
    status: "idle",
  })
  const saving = saveState.status === "saving"
  async function save() {
    if (submitting.current) return
    submitting.current = true
    setSaveState({ status: "saving" })
    try {
      const result = await onSave(text)
      setSaveState(
        result
          ? {
              status: "saved",
              name: typeof result === "object" ? result.name : "",
            }
          : { status: "idle" }
      )
    } catch (cause) {
      setSaveState({
        status: "error",
        message:
          cause instanceof Error ? cause.message : "파일을 저장할 수 없습니다.",
      })
    } finally {
      submitting.current = false
    }
  }
  const saveShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (
      !active ||
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.shiftKey ||
      !(event.ctrlKey || event.metaKey) ||
      event.key.toLowerCase() !== "s" ||
      hasOpenDialog()
    )
      return
    event.preventDefault()
    if (!event.repeat) void save()
  })
  useEffect(() => {
    window.addEventListener("keydown", saveShortcut)
    return () => window.removeEventListener("keydown", saveShortcut)
  }, [])
  // Focus is an external UI synchronization: entry and OS app activation only.
  // Dialog focus and the user's cursor position during normal typing are kept.
  useEffect(() => {
    if (!active || saving) return
    const focusInput = () => {
      if (!hasOpenDialog()) inputRef.current?.focus({ preventScroll: true })
    }
    focusInput()
    window.addEventListener("focus", focusInput)
    return () => window.removeEventListener("focus", focusInput)
  }, [active, saving])
  function changeText(value: string) {
    setText(value)
    setSaveState((current) =>
      current.status === "saved" ? { status: "idle" } : current
    )
  }
  return { inputRef, text, saveState, onTextChange: changeText }
}
