import { useRef, useState } from "react"
import type { Todo } from "../../../../../shared/todos"

export type TodoFormOptions = {
  item: Todo | null
  busy: boolean
  onSave: (todo: Todo) => Promise<boolean>
  onCancel: () => void
}

// Keep the draft for this mounted editor; callers control editor identity.
export function useTodoForm({ item, busy, onSave, onCancel }: TodoFormOptions) {
  const [title, setTitle] = useState(item?.title ?? "")
  const [dueDate, setDueDate] = useState(item?.dueDate ?? "")
  const [completed, setCompleted] = useState(item?.completed ?? false)
  const submitting = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const pending = busy || saving
  async function save() {
    if (!title.trim() || pending || submitting.current) return
    submitting.current = true
    setSaving(true)
    setError("")
    try {
      const saved = await onSave({
        id: item?.id ?? crypto.randomUUID(),
        title: title.trim(),
        dueDate: dueDate || undefined,
        completed,
        favorite: item?.favorite ?? false,
      })
      if (saved) {
        setTitle("")
        setDueDate("")
        setCompleted(false)
        onCancel()
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "할일을 저장하지 못했습니다. 다시 시도해 주세요."
      )
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }
  return {
    title,
    setTitle,
    dueDate,
    setDueDate,
    completed,
    setCompleted,
    pending,
    error,
    save,
  }
}
