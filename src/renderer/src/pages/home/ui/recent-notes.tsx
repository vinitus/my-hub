import { FileTextIcon, HistoryIcon } from "lucide-react"
import { Button } from "@/shared/ui/button"
import type { NoteSummary } from "../../../../../shared/notes"

export function RecentNotes({
  notes,
  busy,
  onOpen,
}: {
  notes: NoteSummary[]
  busy: boolean
  onOpen?: (name: string) => void
}) {
  const recent = notes
    .filter((note) => Number.isFinite(new Date(note.modifiedAt).getTime()))
    .toSorted(
      (a, b) =>
        b.modifiedAt - a.modifiedAt || a.name.localeCompare(b.name, "ko")
    )
    .slice(0, 3)
  return (
    <section
      aria-label="이어서 작업하기"
      className="min-w-0 rounded-xl border bg-card p-4"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <HistoryIcon aria-hidden className="size-4 text-muted-foreground" />
        이어서 작업하기
      </h2>
      {recent.length ? (
        <ul className="mt-3 divide-y">
          {recent.map((note) => (
            <li
              key={note.path}
              className="flex min-w-0 items-center gap-3 py-2.5"
            >
              <FileTextIcon
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" title={note.name}>
                  {note.name.replace(/\.md$/i, "")}
                </p>
                <time
                  dateTime={new Date(note.modifiedAt).toISOString()}
                  className="text-xs text-muted-foreground"
                  title={new Date(note.modifiedAt).toLocaleString("ko-KR")}
                >
                  {new Date(note.modifiedAt).toLocaleString("ko-KR", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  수정
                </time>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || !onOpen}
                onClick={() => onOpen?.(note.name)}
                aria-label={`${note.name} 이어서 열기`}
                className="shrink-0"
              >
                이어서 열기
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex min-h-32 flex-col justify-center py-4 text-sm text-muted-foreground">
          <p>최근 수정한 메모가 없습니다.</p>
          <p className="mt-1 text-xs">
            메모를 저장하면 여기에서 다시 열 수 있습니다.
          </p>
        </div>
      )}
    </section>
  )
}
