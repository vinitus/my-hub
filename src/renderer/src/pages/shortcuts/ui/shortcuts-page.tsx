import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
} from "react"
import {
  ArrowUpRightIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  LayoutGridIcon,
  UploadIcon,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import {
  SHORTCUT_LABELS,
  type Shortcut,
  type ShortcutKind,
} from "../../../../../shared/shortcuts"
import {
  ShortcutStore,
  shortcutError,
  ShortcutSheet,
  readShortcutDrop,
  ShortcutIcon,
} from "@/features/shortcuts"

type Editor = { item: Shortcut; existing: boolean; revision: string }
export default function ShortcutWorkspace({
  active = true,
}: {
  active?: boolean
}) {
  const [store] = useState(() => new ShortcutStore(window.api?.shortcuts))
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<ShortcutKind | "all">("all")
  const [editor, setEditor] = useState<Editor | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dropBusy, setDropBusy] = useState(false)
  const [dropError, setDropError] = useState("")
  const dragDepth = useRef(0)
  const disabled = state.loading || state.busy || dropBusy || !state.snapshot
  const items = state.snapshot?.items ?? []
  const filtered = items.filter(
    (item) =>
      (kind === "all" || item.kind === kind) &&
      `${item.name} ${item.target}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase())
  )
  useEffect(() => {
    void store.initialize()
  }, [store])
  function edit(item?: Shortcut) {
    if (disabled || !state.snapshot) return
    setDropError("")
    store.clearFeedback()
    setEditor({
      item: item ?? {
        id: crypto.randomUUID(),
        name: "",
        kind: kind === "all" ? "program" : kind,
        target: "",
      },
      existing: !!item,
      revision: state.snapshot.revision,
    })
  }
  async function drop(event: DragEvent<HTMLElement>) {
    // File과 URL은 await 전에 읽고, 기본 파일 열기/브라우저 이동을 막는다.
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current = 0
    setDragging(false)
    if (disabled || editor || !state.snapshot) return
    if (items.length >= 500) {
      setDropError("바로가기는 최대 500개까지 등록할 수 있습니다.")
      return
    }
    const revision = state.snapshot.revision
    setDropError("")
    store.clearFeedback()
    try {
      const input = readShortcutDrop(event.dataTransfer)
      const api = window.api?.shortcuts
      if (
        !api ||
        typeof api.inspectDrop !== "function" ||
        typeof api.inspectFileDrop !== "function"
      )
        throw new Error(
          "드래그 추가를 사용하려면 Electron을 완전히 닫고 pnpm dev를 다시 실행해 주세요."
        )
      setDropBusy(true)
      const item =
        "file" in input
          ? await api.inspectFileDrop(input.file)
          : await api.inspectDrop({ kind: "website", target: input.url })
      setKind(item.kind)
      setQuery("")
      setEditor({ item, existing: false, revision })
    } catch (error) {
      setDropError(shortcutError(error))
    } finally {
      setDropBusy(false)
    }
  }
  return (
    <section
      aria-label="바로가기"
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(event) => {
        event.preventDefault()
        event.stopPropagation()
        dragDepth.current++
        if (!disabled && !editor && items.length < 500) setDragging(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect =
          disabled || editor || items.length >= 500 ? "none" : "copy"
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        event.stopPropagation()
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (!dragDepth.current) setDragging(false)
      }}
      onDrop={(event) => void drop(event)}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/95 p-6 text-center">
          <div>
            <UploadIcon className="mx-auto mb-4 size-8 text-muted-foreground" />
            <p className="text-lg font-semibold">여기에 놓아 바로가기 추가</p>
            <p className="mt-2 text-sm text-muted-foreground">
              프로그램(.exe/.lnk) · 폴더 · 웹사이트 링크
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              한 번에 하나씩 · 놓은 뒤 이름과 대상을 확인하세요
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <p className="text-sm text-muted-foreground">
          자주 쓰는 곳으로, 한 번에.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="바로가기 새로고침"
            disabled={state.busy || state.loading || dropBusy}
            onClick={() => void store.refresh()}
          >
            <RefreshCwIcon />
          </Button>
          <Button
            size="sm"
            disabled={disabled || items.length >= 500}
            onClick={() => edit()}
          >
            <PlusIcon />
            바로가기 추가
          </Button>
        </div>
      </div>
      {(dropError || state.error) && (
        <p
          role="alert"
          className="border-b bg-destructive/5 px-5 py-3 text-sm text-destructive"
        >
          {dropError || state.error}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="바로가기 종류"
              className="flex flex-wrap gap-1"
            >
              {(["all", "program", "folder", "website"] as const).map(
                (value) => (
                  <Button
                    key={value}
                    variant={kind === value ? "secondary" : "ghost"}
                    size="sm"
                    aria-pressed={kind === value}
                    onClick={() => setKind(value)}
                  >
                    {value === "all" ? "전체" : SHORTCUT_LABELS[value]}
                    <span className="text-xs text-muted-foreground">
                      {value === "all"
                        ? items.length
                        : items.filter((item) => item.kind === value).length}
                    </span>
                  </Button>
                )
              )}
            </div>
            <div className="relative w-full sm:w-64">
              <SearchIcon
                aria-hidden="true"
                className="absolute top-2.5 left-3 size-4 text-muted-foreground"
              />
              <Input
                className="pl-9"
                aria-label="바로가기 검색"
                placeholder="이름 또는 경로 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          {state.loading && !state.snapshot ? (
            <p
              role="status"
              className="py-16 text-center text-sm text-muted-foreground"
            >
              바로가기를 불러오는 중…
            </p>
          ) : filtered.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => {
                return (
                  <article
                    key={item.id}
                    className="group relative rounded-xl border bg-card transition-colors hover:border-foreground/25"
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      className="flex w-full items-start gap-4 rounded-xl p-5 pr-12 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      onClick={() => void store.launch(item)}
                      title={item.target}
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <ShortcutIcon
                          item={item}
                          revision={state.snapshot!.revision}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {item.name}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {item.target}
                        </span>
                        <span className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                          {SHORTCUT_LABELS[item.kind]}
                          <ArrowUpRightIcon className="size-3" />
                        </span>
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="absolute top-3 right-3"
                      aria-label={`${item.name} 수정`}
                      title="바로가기 수정"
                      disabled={disabled}
                      onClick={() => edit(item)}
                    >
                      <PencilIcon />
                    </Button>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-20 text-center">
              <span className="mb-5 flex size-14 items-center justify-center rounded-2xl border bg-muted/30">
                <LayoutGridIcon className="size-6 text-muted-foreground" />
              </span>
              <h1 className="text-lg font-semibold">
                {items.length
                  ? "일치하는 바로가기가 없습니다"
                  : "자주 쓰는 바로가기를 모아보세요"}
              </h1>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {items.length
                  ? "검색어나 종류를 바꿔서 찾아보세요."
                  : "프로그램, 폴더 또는 웹사이트 링크를 이곳에 끌어 놓거나 추가 버튼을 눌러 등록하세요."}
              </p>
              {!items.length && (
                <Button
                  className="mt-6"
                  disabled={disabled}
                  onClick={() => edit()}
                >
                  <PlusIcon />첫 바로가기 추가
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-2 text-xs text-muted-foreground">
        <span role="status">
          {dropBusy
            ? "드롭한 대상을 확인하는 중…"
            : state.busy
              ? "처리 중…"
              : state.notice || `${items.length}개 바로가기`}
        </span>
        <span title={state.snapshot?.path}>
          드래그해서 추가 · 클릭해서 열기
        </span>
      </footer>
      {editor && active && (
        <ShortcutSheet
          key={editor.item.id}
          item={editor.item}
          existing={editor.existing}
          busy={state.busy}
          error={state.error}
          onChoose={store.choose}
          onSave={(item) => store.save(item, editor.revision)}
          onDelete={() => store.remove(editor.item.id, editor.revision)}
          onClose={() => setEditor(null)}
        />
      )}
    </section>
  )
}
