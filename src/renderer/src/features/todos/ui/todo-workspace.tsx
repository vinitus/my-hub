import { useEffect, useId, useRef, useState, type RefObject } from "react"
import {
  CalendarDaysIcon,
  PencilIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import type { Todo } from "../../../../../shared/todos"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { compareTodoPriority } from "../lib/compare-todo-priority"

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
  createRequest?: number
}
export function TodoForm({
  item,
  busy,
  onSave,
  onCancel,
  titleInputRef,
  dialog = false,
}: {
  item: Todo | null
  busy: boolean
  onSave: (todo: Todo) => Promise<boolean>
  onCancel: () => void
  dialog?: boolean
  titleInputRef?: RefObject<HTMLInputElement | null>
}) {
  const id = useId()
  const [title, setTitle] = useState(item?.title ?? "")
  const [dueDate, setDueDate] = useState(item?.dueDate ?? "")
  const [completed, setCompleted] = useState(item?.completed ?? false)
  const submitting = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const pending = busy || saving
  const cancel = (item || dialog) && (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={onCancel}
    >
      취소
    </Button>
  )
  return (
    <form
      className={
        dialog
          ? "flex flex-col gap-3"
          : "flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"
      }
      aria-busy={pending}
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLInputElement &&
          event.target.type === "date" &&
          event.target.matches(":open") &&
          (event.key === "Enter" || event.key === "Escape")
        ) {
          // Let the native picker select/dismiss without reaching the modal.
          event.stopPropagation()
          return
        }
        if (
          event.key === "Enter" &&
          (event.nativeEvent.isComposing || event.keyCode === 229)
        )
          event.preventDefault()
      }}
      onSubmit={async (event) => {
        event.preventDefault()
        if (
          event.currentTarget
            .querySelector('input[type="date"]')
            ?.matches(":open")
        )
          return
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
      }}
    >
      <div className="min-w-0 basis-full space-y-2 sm:flex-1 sm:basis-auto">
        <Label htmlFor={`${id}-title`}>제목</Label>
        <Input
          id={`${id}-title`}
          type="text"
          ref={titleInputRef}
          autoFocus={dialog}
          required
          maxLength={200}
          value={title}
          disabled={pending}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="할일을 입력하세요"
        />
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${id}-date`}>마감일</Label>
          <span className="text-xs text-muted-foreground">선택 사항</span>
        </div>
        <Input
          id={`${id}-date`}
          type="date"
          className={`[color-scheme:light] dark:[color-scheme:dark] ${dialog ? "w-full" : "sm:w-40"}`}
          value={dueDate}
          disabled={pending}
          aria-describedby={`${id}-date-hint`}
          onKeyDown={(event) => {
            if (dialog && event.key === "Delete") {
              event.preventDefault()
              setDueDate("")
            }
          }}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <div className="flex min-h-6 items-center justify-between gap-3">
          <span
            id={`${id}-date-hint`}
            className="text-xs text-muted-foreground"
          >
            {dialog
              ? "선택 입력 · Delete로 지우기"
              : dueDate
                ? "기한을 지정했습니다."
                : "기한 없이 등록할 수 있어요."}
          </span>
          {dueDate && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={pending}
              tabIndex={dialog ? -1 : undefined}
              onClick={() => setDueDate("")}
            >
              기한 지우기
            </Button>
          )}
        </div>
      </div>
      <label
        className={`flex min-h-9 items-center gap-2 text-sm ${dialog ? "text-muted-foreground" : ""}`}
      >
        <input
          type="checkbox"
          checked={completed}
          disabled={pending}
          onChange={(e) => setCompleted(e.target.checked)}
        />{" "}
        완료
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div
        className={
          dialog
            ? "flex items-center justify-end gap-2 border-t pt-3"
            : "contents"
        }
      >
        {dialog && cancel}
        <Button type="submit" disabled={pending || !title.trim()}>
          {pending ? "저장 중…" : item && !dialog ? "수정 저장" : "추가"}
        </Button>
        {!dialog && cancel}
      </div>
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
  createRequest = 0,
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
    .toSorted(compareTodoPriority)
  const filterId = useId()
  const titleInputRef = useRef<HTMLInputElement>(null)
  const handledCreateRequest = useRef(0)
  // 외부 등록 요청은 페이지의 데이터 로드가 끝난 뒤 포커스한다.
  useEffect(() => {
    if (createRequest <= handledCreateRequest.current || !ready || busy) return
    handledCreateRequest.current = createRequest
    titleInputRef.current?.focus()
  }, [createRequest, ready, busy])
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
            titleInputRef={titleInputRef}
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
            <span className="text-muted-foreground">
              마감일순 · 기한 없는 항목은 아래
            </span>
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
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {item.dueDate ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <CalendarDaysIcon className="size-3.5" />
                          <time dateTime={item.dueDate}>{item.dueDate}</time>
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                          기한 없음
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        · {item.completed ? "완료" : "미완료"}
                      </span>
                    </div>
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
