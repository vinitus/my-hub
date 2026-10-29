import { useEffect, useEffectEvent, useId, useRef, useState } from "react"
import { Dialog } from "@base-ui/react/dialog"
import {
  ArrowUpIcon,
  SearchIcon,
  FileTextIcon,
  CalendarDaysIcon,
  ListTodoIcon,
  AppWindowIcon,
  CommandIcon,
  XIcon,
} from "lucide-react"
import { hasOpenDialog } from "@/shared/lib/has-open-dialog"
import { Button } from "@/shared/ui/button"
import {
  ACTION_LABELS,
  searchActions,
  type LauncherAction,
} from "../model/action-search"
import {
  LAUNCHER_SHORTCUTS,
  matchesLauncherShortcut,
  type LauncherShortcut,
} from "../../../../../shared/launcher-shortcut"

const icons = {
  note: FileTextIcon,
  event: CalendarDaysIcon,
  todo: ListTodoIcon,
  shortcut: AppWindowIcon,
  command: CommandIcon,
}
const kinds = ["note", "todo", "event", "shortcut", "command"] as const
const EMPTY: LauncherAction[] = []

export function QuickCommand({
  open,
  onOpenChange,
  actions = EMPTY,
  loading = false,
  error = "",
  shortcut = "ctrl+k",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions?: LauncherAction[]
  loading?: boolean
  error?: string
  shortcut?: LauncherShortcut
}) {
  const [draft, setDraft] = useState("")
  const [selection, setSelection] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  const [running, setRunning] = useState(false)
  const busy = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const matches = searchActions(actions, draft)
  const groups = kinds.map((kind) => ({
    kind,
    items: matches
      .filter((item) => item.kind === kind)
      .slice(0, draft.trim() ? 10 : 3),
  }))
  const results = groups.flatMap((group) => group.items)
  const choices = results.filter((item) => !item.disabled)
  const preferred = matches.find(
    (item) => !item.disabled && results.includes(item)
  )
  const selectedId =
    selection && choices.some((item) => item.id === selection)
      ? selection
      : preferred?.id
  const optionId = (id: string) => `${listId}-${encodeURIComponent(id)}`
  const activeId = selectedId ? optionId(selectedId) : undefined

  useEffect(() => {
    if (open && activeId)
      document.getElementById(activeId)?.scrollIntoView({ block: "nearest" })
  }, [open, activeId])
  const toggle = useEffectEvent((event: KeyboardEvent) => {
    if (!matchesLauncherShortcut(event, shortcut) || (!open && hasOpenDialog()))
      return
    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) onOpenChange(!open)
  })
  useEffect(() => {
    window.addEventListener("keydown", toggle, true)
    return () => window.removeEventListener("keydown", toggle, true)
  }, [])

  async function execute(id = selectedId) {
    const action = results.find((item) => item.id === id)
    if (!action || action.disabled || busy.current) return
    busy.current = true
    setRunning(true)
    setFeedback("")
    onOpenChange(false)
    setDraft("")
    setSelection(null)
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      )
      const message = await action.execute()
      if (message) setFeedback(message)
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "작업을 실행하지 못했습니다."
      )
    } finally {
      busy.current = false
      setRunning(false)
    }
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/15 backdrop-blur-[2px]" />
          <Dialog.Popup
            initialFocus={input}
            className="fixed top-[12vh] left-1/2 z-50 flex max-h-[76svh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl outline-none"
          >
            <Dialog.Title className="sr-only">
              통합 검색 및 액션 런처
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              메모, 할일, 일정, 바로가기와 앱 명령을 검색합니다. 방향키로
              선택하고 Enter로 실행하며 Escape로 닫습니다.
            </Dialog.Description>
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void execute()
              }}
            >
              <SearchIcon
                aria-hidden="true"
                className="ml-2 size-4 shrink-0 text-muted-foreground"
              />
              <input
                ref={input}
                role="combobox"
                aria-label="검색 또는 명령 입력"
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls={listId}
                aria-activedescendant={activeId}
                autoComplete="off"
                spellCheck={false}
                maxLength={500}
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="메모, 할일, 일정, 바로가기 검색…"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value.replace(/[\r\n]+/g, " "))
                  setSelection(null)
                }}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing || event.keyCode === 229) {
                    if (event.key === "Enter") event.preventDefault()
                    return
                  }
                  if (
                    ["ArrowDown", "ArrowUp", "Home", "End"].includes(
                      event.key
                    ) &&
                    choices.length
                  ) {
                    event.preventDefault()
                    const index = choices.findIndex(
                      (item) => item.id === selectedId
                    )
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? choices.length - 1
                          : (index +
                              (event.key === "ArrowDown" ? 1 : -1) +
                              choices.length) %
                            choices.length
                    setSelection(choices[next].id)
                  }
                }}
              />
              <Button
                type="submit"
                size="icon-sm"
                aria-label="선택한 액션 실행"
                disabled={!selectedId || running}
              >
                <ArrowUpIcon />
              </Button>
            </form>
            <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
              <span>{draft.trim() ? "검색 결과" : "내 작업과 빠른 명령"}</span>
              <span role="status">
                {loading ? "불러오는 중…" : `${matches.length}개`}
              </span>
            </div>
            {error && (
              <p role="alert" className="px-3 pb-2 text-xs text-destructive">
                일부 목록을 불러오지 못했습니다. {error}
              </p>
            )}
            <div
              id={listId}
              role="listbox"
              aria-label="검색 결과와 액션"
              aria-busy={loading}
              className="min-h-0 overflow-y-auto overscroll-contain"
            >
              {groups
                .filter((group) => group.items.length > 0)
                .map(({ kind, items }) => (
                  <div
                    key={kind}
                    role="group"
                    aria-labelledby={`${listId}-${kind}`}
                  >
                    <p
                      id={`${listId}-${kind}`}
                      className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground"
                    >
                      {ACTION_LABELS[kind]}
                    </p>
                    {items.map((item) => {
                      const Icon = icons[item.kind]
                      return (
                        <div
                          key={item.id}
                          id={optionId(item.id)}
                          role="option"
                          aria-selected={selectedId === item.id}
                          aria-disabled={item.disabled || running}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => void execute(item.id)}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${selectedId === item.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"} ${item.disabled || running ? "pointer-events-none opacity-50" : ""}`}
                        >
                          <Icon
                            aria-hidden="true"
                            className="size-4 shrink-0 text-muted-foreground"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{item.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {item.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              {!results.length && !loading && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  검색 결과가 없습니다. 다른 검색어를 입력해 주세요.
                </p>
              )}
            </div>
            <p className="border-t px-3 pt-2 pb-1 text-[11px] text-muted-foreground">
              ↑↓ 선택 · Enter 실행 · Esc 닫기 · {LAUNCHER_SHORTCUTS[shortcut]}
            </p>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      {feedback && (
        <aside
          role="status"
          aria-label="액션 실행 결과"
          className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
        >
          <span>{feedback}</span>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="실행 결과 닫기"
            onClick={() => setFeedback("")}
          >
            <XIcon />
          </Button>
        </aside>
      )}
    </>
  )
}
