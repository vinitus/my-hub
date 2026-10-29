import { useEffect, useId, useRef, useState } from "react"
import {
  InboxIcon,
  ExternalLinkIcon,
  CheckIcon,
  Undo2Icon,
  Trash2Icon,
  RefreshCwIcon,
  FileIcon,
  LinkIcon,
  StickyNoteIcon,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog"
import { InboxCapture, type InboxCaptureProps } from "./inbox-capture"
import { captureInboxDrop } from "../model/capture-drop"
import {
  inboxTitle,
  INBOX_DESTINATION_LABELS,
  type InboxItem,
  type InboxDestination,
} from "../../../../../shared/inbox"

export type InboxViewProps = InboxCaptureProps & {
  items: InboxItem[]
  loading: boolean
  error: string
  notice: string
  onRefresh: () => void
  onOpen: (id: string) => void
  onProcess: (id: string, processed: boolean) => void
  onRemove: (id: string) => Promise<boolean>
  onConvert: (item: InboxItem, kind: InboxDestination["kind"]) => void
  focusRequest?: { id: number; itemId: string } | null
}
export function InboxView(props: InboxViewProps) {
  const listId = useId()
  const focusedRequest = useRef<number | undefined>(undefined)
  const [filter, setFilter] = useState<"pending" | "processed" | "all">(
    "pending"
  )
  const [query, setQuery] = useState("")
  const [deleting, setDeleting] = useState<InboxItem | null>(null)
  const focusRequest = props.focusRequest
  const [appliedFocus, setAppliedFocus] = useState<number | undefined>(
    undefined
  )
  // 홈에서 선택한 항목이 기존 필터에 가려지지 않도록 표시 상태를 맞춘다.
  if (focusRequest && appliedFocus !== focusRequest.id) {
    setAppliedFocus(focusRequest.id)
    setFilter("all")
    setQuery("")
  }
  useEffect(() => {
    if (
      !focusRequest ||
      focusedRequest.current === focusRequest.id ||
      filter !== "all" ||
      query
    )
      return
    const target = document.getElementById(`${listId}-${focusRequest.itemId}`)
    if (target) {
      focusedRequest.current = focusRequest.id
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: "nearest" })
    }
  }, [focusRequest, filter, query, props.items, listId])
  const pending = props.items.filter((item) => !item.processedAt).length
  const needle = query.trim().toLocaleLowerCase()
  const items = props.items
    .filter(
      (item) =>
        (filter === "all" ||
          Boolean(item.processedAt) === (filter === "processed")) &&
        `${item.content} ${item.source} ${item.destination?.title ?? ""}`
          .toLocaleLowerCase()
          .includes(needle)
    )
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <section
      aria-label="인박스"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
      }}
      onDrop={(event) => void captureInboxDrop(event, props)}
    >
      <div className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <InboxIcon className="size-5" />
              인박스
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                미처리 {pending}
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              지금은 모아두고, 여유가 생기면 정리하세요.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="인박스 새로고침"
            disabled={props.busy || props.loading}
            onClick={props.onRefresh}
          >
            <RefreshCwIcon />
          </Button>
        </div>
        <InboxCapture {...props} />
        {props.error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
          >
            {props.error}
          </p>
        )}
        {props.notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {props.notice}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1" role="group" aria-label="처리 상태 필터">
            {(["pending", "processed", "all"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "secondary" : "ghost"}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === "pending"
                  ? "미처리"
                  : value === "processed"
                    ? "처리 완료"
                    : "전체"}
              </Button>
            ))}
          </div>
          <Input
            aria-label="인박스 검색"
            value={query}
            placeholder="내용 또는 출처 검색"
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 min-w-0 flex-1 basis-40"
          />
        </div>
        {props.loading && (
          <p role="status" className="py-4 text-sm text-muted-foreground">
            인박스를 불러오는 중…
          </p>
        )}
        {!props.loading && !items.length && (
          <div className="rounded-xl border border-dashed px-4 py-12 text-center">
            <InboxIcon className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {query
                ? "검색 결과가 없습니다."
                : filter === "pending"
                  ? "아직 정리할 항목이 없습니다."
                  : "표시할 항목이 없습니다."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              위 입력창에 생각을 적거나 링크와 파일을 끌어 놓으세요.
            </p>
          </div>
        )}
        <ul className="space-y-3" aria-label="수집한 항목">
          {items.map((item) => {
            const Icon =
              item.kind === "file"
                ? FileIcon
                : item.kind === "link"
                  ? LinkIcon
                  : StickyNoteIcon
            const detail =
              item.kind === "file"
                ? item.content
                : item.kind === "text"
                  ? item.content.split(/\r?\n/).slice(1).join("\n")
                  : ""
            return (
              <li key={item.id} className="rounded-xl border bg-card p-4">
                <article
                  id={`${listId}-${item.id}`}
                  tabIndex={-1}
                  aria-label={inboxTitle(item)}
                  className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Icon
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium wrap-anywhere">
                        {inboxTitle(item)}
                      </p>
                      {detail && (
                        <p className="mt-1 text-sm wrap-anywhere whitespace-pre-wrap text-muted-foreground">
                          {detail}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="wrap-anywhere">
                          출처: {item.source}
                        </span>
                        <time dateTime={item.createdAt}>
                          {new Date(item.createdAt).toLocaleString("ko-KR")}
                        </time>
                        <span>{item.processedAt ? "처리 완료" : "미처리"}</span>
                      </div>
                      {item.destination && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {INBOX_DESTINATION_LABELS[item.destination.kind]}로
                          옮김 · {item.destination.title}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1 border-t pt-3">
                    {!item.processedAt &&
                      (
                        Object.keys(
                          INBOX_DESTINATION_LABELS
                        ) as InboxDestination["kind"][]
                      ).map((kind) => (
                        <Button
                          key={kind}
                          size="sm"
                          variant="ghost"
                          disabled={props.busy || props.loading}
                          onClick={() => props.onConvert(item, kind)}
                        >
                          {INBOX_DESTINATION_LABELS[kind]}로
                        </Button>
                      ))}
                    <div className="ml-auto flex gap-1">
                      {item.kind !== "text" && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={props.busy || props.loading}
                          aria-label={`${inboxTitle(item)} 원본 열기`}
                          onClick={() => props.onOpen(item.id)}
                        >
                          <ExternalLinkIcon />
                        </Button>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={props.busy || props.loading}
                        aria-label={
                          item.processedAt
                            ? `${inboxTitle(item)} 미처리로 되돌리기`
                            : `${inboxTitle(item)} 처리 완료`
                        }
                        onClick={() =>
                          props.onProcess(item.id, !item.processedAt)
                        }
                      >
                        {item.processedAt ? <Undo2Icon /> : <CheckIcon />}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={props.busy || props.loading}
                        aria-label={`${inboxTitle(item)} 삭제`}
                        onClick={() => setDeleting(item)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      </div>
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !props.busy) setDeleting(null)
        }}
      >
        <DialogContent showCloseButton={!props.busy}>
          <DialogHeader>
            <DialogTitle>수집한 항목을 삭제할까요?</DialogTitle>
            <DialogDescription>
              인박스 항목만 삭제합니다. 원본 파일과 이미 옮긴 항목은 유지됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={props.busy}
              onClick={() => setDeleting(null)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={props.busy}
              onClick={async () => {
                if (deleting && (await props.onRemove(deleting.id)))
                  setDeleting(null)
              }}
            >
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
