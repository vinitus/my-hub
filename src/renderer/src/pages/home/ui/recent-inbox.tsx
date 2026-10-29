import { InboxIcon, LinkIcon, FileIcon, ArrowUpRightIcon } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { inboxTitle, type InboxItem } from "../../../../../shared/inbox"

export function RecentInbox({
  items,
  busy,
  onOpen,
}: {
  items: InboxItem[]
  busy: boolean
  onOpen?: (id: string) => void
}) {
  const recent = items
    .filter((item) => Number.isFinite(Date.parse(item.createdAt)))
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)
  if (!recent.length) return null
  return (
    <section
      aria-label="최근 인박스"
      className="min-w-0 shrink-0 border-b pb-2"
    >
      <h2 className="mb-1 px-2 text-xs font-medium text-muted-foreground">
        최근 인박스
      </h2>
      <ul>
        {recent.map((item) => {
          const title = inboxTitle(item)
          const Icon =
            item.kind === "file"
              ? FileIcon
              : item.kind === "link"
                ? LinkIcon
                : InboxIcon
          return (
            <li key={item.id} className="min-w-0">
              <Button
                variant="ghost"
                disabled={busy || !onOpen}
                onClick={() => onOpen?.(item.id)}
                aria-label={`${title} 인박스에서 보기`}
                title={`${title}\n${item.source} · ${item.processedAt ? "처리 완료" : "미처리"}`}
                className="h-auto w-full min-w-0 justify-start gap-2 px-2 py-2 text-left font-normal"
              >
                <Icon
                  aria-hidden
                  className="hidden size-4 shrink-0 text-muted-foreground @[400px]:block"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm" title={title}>
                    {title}
                  </p>
                </div>
                <time
                  dateTime={item.createdAt}
                  className="max-w-[45%] min-w-0 shrink text-right text-[11px] whitespace-normal text-muted-foreground"
                  title={new Date(item.createdAt).toLocaleString("ko-KR")}
                >
                  {new Date(item.createdAt).toLocaleString("ko-KR", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  수집
                </time>
                <ArrowUpRightIcon
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
