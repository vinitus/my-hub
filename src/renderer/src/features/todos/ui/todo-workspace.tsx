import { useId, useState } from "react"
import { PencilIcon, StarIcon, Trash2Icon } from "lucide-react"
import type { Todo } from "../../../../../shared/todos"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"

type Props = {
  items: Todo[]
  revision: string
  ready: boolean
  busy: boolean
  error: string
  notice: string
  onSave: (todo: Todo, revision: string) => Promise<boolean>
  onRemove: (id: string) => Promise<boolean>
  onRefresh: () => void
}
function TodoForm({
  item,
  busy,
  onSave,
  onCancel,
}: {
  item: Todo | null
  busy: boolean
  onSave: (todo: Todo) => Promise<boolean>
  onCancel: () => void
}) {
  const id = useId()
  const [title, setTitle] = useState(item?.title ?? "")
  const [dueDate, setDueDate] = useState(item?.dueDate ?? "")
  const [completed, setCompleted] = useState(item?.completed ?? false)
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"
      onSubmit={async (event) => {
        event.preventDefault()
        const saved = await onSave({
          id: item?.id ?? crypto.randomUUID(),
          title: title.trim(),
          dueDate,
          completed,
          favorite: item?.favorite ?? false,
        })
        if (saved) {
          setTitle("")
          setDueDate("")
          setCompleted(false)
          onCancel()
        }
      }}
    >
      <div className="min-w-0 basis-full space-y-2 sm:flex-1 sm:basis-auto">
        <Label htmlFor={`${id}-title`}>제목</Label>
        <Input
          id={`${id}-title`}
          type="text"
          required
          maxLength={200}
          value={title}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="할일을 입력하세요"
        />
      </div>
      <div className="min-w-0 space-y-2">
        <Label htmlFor={`${id}-date`}>마감일</Label>
        <Input
          id={`${id}-date`}
          type="date"
          required
          value={dueDate}
          disabled={busy}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <label className="flex h-9 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={completed}
          disabled={busy}
          onChange={(e) => setCompleted(e.target.checked)}
        />{" "}
        완료
      </label>
      <Button type="submit" disabled={busy || !title.trim() || !dueDate}>
        {item ? "수정 저장" : "추가"}
      </Button>
      {item && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          취소
        </Button>
      )}
    </form>
  )
}
export function TodoWorkspace({
  items,
  revision,
  ready,
  busy,
  error,
  notice,
  onSave,
  onRemove,
  onRefresh,
}: Props) {
  const [editing, setEditing] = useState<{
    item: Todo
    revision: string
  } | null>(null)
  const [filter, setFilter] = useState("all")
  const remaining = items.filter((item) => !item.completed).length
  const visible = items
    .filter(
      (item) =>
        filter === "all" ||
        (filter === "completed" ? item.completed : !item.completed)
    )
    .toSorted(
      (a, b) =>
        Number(!!b.favorite) - Number(!!a.favorite) ||
        a.dueDate.localeCompare(b.dueDate)
    )
  const filterId = useId()
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">할일</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            전체 {items.length}개 · 미완료 {remaining}개
          </p>
        </div>
        <Button variant="outline" disabled={busy} onClick={onRefresh}>
          새로고침
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {!ready ? (
        <p role="status">
          {error ? "새로고침으로 다시 시도해 주세요." : "할일을 불러오는 중…"}
        </p>
      ) : (
        <>
          <TodoForm
            key={editing ? `${editing.item.id}:${editing.revision}` : "new"}
            item={editing?.item ?? null}
            busy={busy}
            onSave={(todo) => onSave(todo, editing?.revision ?? revision)}
            onCancel={() => setEditing(null)}
          />
          <div className="flex items-center gap-2 text-sm">
            <Label htmlFor={filterId}>완료 여부</Label>
            <select
              id={filterId}
              className="rounded-md border bg-background px-3 py-2"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="pending">미완료</option>
              <option value="completed">완료</option>
            </select>
            <span className="text-muted-foreground">마감일순</span>
          </div>
          {visible.length ? (
            <ul className="divide-y rounded-xl border bg-card">
              {visible.map((item) => (
                <li key={item.id} className="flex items-center gap-3 p-4">
                  <input
                    type="checkbox"
                    aria-label={`${item.title} 완료 여부`}
                    checked={item.completed}
                    disabled={busy}
                    onChange={(e) => {
                      void onSave(
                        { ...item, completed: e.target.checked },
                        revision
                      )
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium break-words ${item.completed ? "text-muted-foreground line-through" : ""}`}
                    >
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      마감일 <time dateTime={item.dueDate}>{item.dueDate}</time>{" "}
                      · {item.completed ? "완료" : "미완료"}
                    </p>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`${item.title} 즐겨찾기 ${item.favorite ? "해제" : "추가"}`}
                    aria-pressed={item.favorite}
                    disabled={busy}
                    onClick={() =>
                      void onSave(
                        { ...item, favorite: !item.favorite },
                        revision
                      )
                    }
                  >
                    <StarIcon
                      className={
                        item.favorite ? "fill-current text-amber-500" : ""
                      }
                    />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`${item.title} 수정`}
                    disabled={busy}
                    onClick={() => setEditing({ item, revision })}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`${item.title} 삭제`}
                    disabled={busy}
                    onClick={async () => {
                      if (await onRemove(item.id)) {
                        if (editing?.item.id === item.id) setEditing(null)
                      }
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {items.length
                ? "조건에 맞는 할일이 없습니다."
                : "아직 할일이 없습니다. 첫 할일을 추가해 보세요."}
            </p>
          )}
        </>
      )}
    </div>
  )
}
