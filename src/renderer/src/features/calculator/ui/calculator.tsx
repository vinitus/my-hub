import { useId, useState } from "react"
import { CalculatorIcon } from "lucide-react"
import { Input } from "@/shared/ui/input"
import { calculateExpression } from "../model/calculate-expression"

export function Calculator({ collapsible = true }: { collapsible?: boolean }) {
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
  const content = (
    <div>
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
    </div>
  )
  if (!collapsible) return content
  return (
    <details className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <CalculatorIcon className="size-4" />
        계산기
      </summary>
      {content}
    </details>
  )
}
