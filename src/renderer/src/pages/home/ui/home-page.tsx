import { useState, type FormEvent } from "react"
import {
  CalculatorIcon,
  CalendarPlusIcon,
  FileTextIcon,
  LayoutGridIcon,
  ListTodoIcon,
  SaveIcon,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import { Input } from "@/shared/ui/input"
import { calculateExpression } from "../model/calculate-expression"

type Props = {
  noteName: string
  noteBusy: boolean
  noteError: string
  onSaveMemo: (text: string) => Promise<boolean>
  onOpenNotes: () => void
  onCreateTodo: () => void
  onCreateEvent: () => void
  onCreateShortcut: () => void
}

function Calculator() {
  const [expression, setExpression] = useState("")
  let result: number | null = null
  let error = ""
  if (expression.trim()) {
    try {
      result = calculateExpression(expression)
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "계산할 수 없습니다."
    }
  }
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalculatorIcon className="size-4 text-muted-foreground" />
          계산기
        </CardTitle>
        <CardDescription>사칙연산과 괄호를 바로 계산합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <label htmlFor="home-calculator-expression" className="sr-only">
          계산식
        </label>
        <Input
          id="home-calculator-expression"
          inputMode="text"
          autoComplete="off"
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          placeholder="예: (1200 + 350) * 2"
          aria-describedby="home-calculator-result"
        />
        <div
          id="home-calculator-result"
          aria-live="polite"
          className="min-h-8 text-right text-lg font-semibold tabular-nums"
        >
          {result === null ? (
            <span className="text-sm font-normal text-muted-foreground">
              {error || "결과가 여기에 표시됩니다."}
            </span>
          ) : (
            new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 8 }).format(
              result
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function HomePage({
  noteName,
  noteBusy,
  noteError,
  onSaveMemo,
  onOpenNotes,
  onCreateTodo,
  onCreateEvent,
  onCreateShortcut,
}: Props) {
  const [memoText, setMemoText] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const saveMemo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = memoText.trim()
    if (!text || saving || noteBusy) return
    setSaving(true)
    setSaveError("")
    try {
      if (await onSaveMemo(text)) setMemoText("")
      else
        setSaveError(
          "메모 저장에 실패했습니다. 메모 설정과 저장 상태를 확인해 주세요."
        )
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "메모를 저장할 수 없습니다."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main
      aria-label="홈"
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4 md:p-6"
    >
      <header>
        <h1 className="text-xl font-semibold">오늘의 작업</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          메모를 남기고 자주 쓰는 작업을 빠르게 시작하세요.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon className="size-4 text-muted-foreground" />
              빠른 메모
            </CardTitle>
            <CardDescription>
              입력한 내용은 현재 메모에 추가되고 Markdown 파일로 저장됩니다.
            </CardDescription>
          </CardHeader>
          <form onSubmit={(event) => void saveMemo(event)}>
            <CardContent>
              <label htmlFor="home-quick-memo" className="sr-only">
                메모 내용
              </label>
              <textarea
                id="home-quick-memo"
                value={memoText}
                onChange={(event) => setMemoText(event.target.value)}
                disabled={noteBusy || saving}
                placeholder="떠오른 생각이나 할 일을 적어 보세요."
                rows={5}
                className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {(noteError || saveError) && (
                <p role="alert" className="text-sm text-destructive">
                  {saveError || noteError}
                </p>
              )}
            </CardContent>
            <CardFooter className="flex flex-wrap justify-between gap-3 border-t">
              <span
                className="min-w-0 truncate text-xs text-muted-foreground"
                title={noteName}
              >
                연결된 메모 · {noteName || "새 메모"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onOpenNotes}
                >
                  메모 열기
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!memoText.trim() || noteBusy || saving}
                >
                  <SaveIcon />
                  {saving ? "저장 중…" : "메모에 추가"}
                </Button>
              </div>
            </CardFooter>
          </form>
        </Card>
        <Calculator />
      </div>

      <section aria-labelledby="home-actions-heading" className="space-y-3">
        <h2 id="home-actions-heading" className="text-sm font-medium">
          빠른 등록
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-4 text-left"
            onClick={onCreateTodo}
          >
            <ListTodoIcon className="size-5 shrink-0 text-muted-foreground" />
            <span className="grid gap-1">
              <span>할일 등록</span>
              <span className="text-xs font-normal text-muted-foreground">
                마감일 없이 빠르게 추가
              </span>
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-4 text-left"
            onClick={onCreateEvent}
          >
            <CalendarPlusIcon className="size-5 shrink-0 text-muted-foreground" />
            <span className="grid gap-1">
              <span>일정 등록</span>
              <span className="text-xs font-normal text-muted-foreground">
                날짜와 알림 설정
              </span>
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-4 text-left"
            onClick={onCreateShortcut}
          >
            <LayoutGridIcon className="size-5 shrink-0 text-muted-foreground" />
            <span className="grid gap-1">
              <span>바로가기 등록</span>
              <span className="text-xs font-normal text-muted-foreground">
                프로그램·폴더·웹사이트
              </span>
            </span>
          </Button>
        </div>
      </section>
    </main>
  )
}
