import { hasOpenDialog } from "@/shared/lib/has-open-dialog"
import { useEffect, useEffectEvent, useId, useRef, useState } from "react"
import {
  CalculatorIcon,
  CalendarPlusIcon,
  LayoutGridIcon,
  ListTodoIcon,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Textarea } from "@/shared/ui/textarea"
import { calculateExpression } from "../model/calculate-expression"

type Props = {
  active: boolean
  onSave: (text: string) => Promise<boolean>
  onCreateTodo: () => void
  onCreateEvent: () => void
  onCreateShortcut: () => void
}

function Calculator() {
  const id = useId()
  const [expression, setExpression] = useState("")
  let result = ""
  if (expression.trim()) {
    try {
      result = new Intl.NumberFormat("ko-KR", {
        maximumFractionDigits: 8,
      }).format(calculateExpression(expression))
    } catch (cause) {
      result = cause instanceof Error ? cause.message : "계산할 수 없습니다."
    }
  }
  return (
    <details className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <CalculatorIcon className="size-4" />
        계산기
      </summary>
      <div className="flex flex-wrap items-center gap-3 py-2">
        <label htmlFor={`${id}-expression`} className="sr-only">
          계산식
        </label>
        <Input
          id={`${id}-expression`}
          className="w-56 max-w-full"
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          placeholder="예: (1200 + 350) * 2"
          aria-describedby={`${id}-result`}
        />
        <output
          id={`${id}-result`}
          aria-live="polite"
          className="text-sm tabular-nums"
        >
          {result}
        </output>
      </div>
    </details>
  )
}

export function HomePage({
  active,
  onSave,
  onCreateTodo,
  onCreateEvent,
  onCreateShortcut,
}: Props) {
  const id = useId()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const submitting = useRef(false)
  const [text, setText] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [saved, setSaved] = useState(false)
  async function saveScratchpad() {
    if (saving || submitting.current) return
    submitting.current = true
    setSaving(true)
    setSaveError("")
    setSaved(false)
    try {
      if (await onSave(text)) {
        setSaved(true)
      }
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "파일을 저장할 수 없습니다."
      )
    } finally {
      submitting.current = false
      setSaving(false)
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
    if (!event.repeat) void saveScratchpad()
  })
  useEffect(() => {
    window.addEventListener("keydown", saveShortcut)
    return () => window.removeEventListener("keydown", saveShortcut)
  }, [])
  useEffect(() => {
    if (!active || saving) return
    const focusInput = () => {
      if (!hasOpenDialog()) inputRef.current?.focus({ preventScroll: true })
    }
    focusInput()
    window.addEventListener("focus", focusInput)
    return () => window.removeEventListener("focus", focusInput)
  }, [active, saving])
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
          onChange={(event) => {
            setText(event.target.value)
            setSaved(false)
          }}
          disabled={saving}
          className="field-sizing-fixed min-h-48 flex-1 resize-none rounded-lg p-4 text-base leading-8 md:text-base"
        />
        {saveError && (
          <p role="alert" className="py-2 text-sm text-destructive">
            {saveError}
          </p>
        )}
        <div
          role="status"
          className="min-h-8 py-2 text-right text-xs text-muted-foreground"
        >
          {saving ? "저장 중…" : saved ? "메모로 저장했습니다." : "Ctrl+S로 메모 저장"}
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
