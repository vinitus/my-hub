import { useState } from "react"
import type { CalendarEvent } from "../../../../shared/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { eventDraft, eventFromDraft } from "./calendar-dates"

type Props = {
  event: CalendarEvent
  existing: boolean
  busy: boolean
  onSave: (event: CalendarEvent) => Promise<boolean>
  onDelete: () => Promise<boolean>
  onClose: () => void
  serverError: string
}

export function EventSheet({
  event,
  existing,
  busy,
  onSave,
  onDelete,
  onClose,
  serverError,
}: Props) {
  const [draft, setDraft] = useState(() => eventDraft(event))
  const [error, setError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <SheetContent className="w-full sm:max-w-md" showCloseButton={!busy}>
        <SheetHeader>
          <SheetTitle>{existing ? "일정 수정" : "새 일정"}</SheetTitle>
          <SheetDescription>
            내 컴퓨터의 날짜와 시간을 기준으로 표시됩니다.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={async (submit) => {
            submit.preventDefault()
            setError("")
            try {
              if (
                await onSave(
                  eventFromDraft(draft, existing ? event : undefined)
                )
              )
                onClose()
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "일정을 확인해 주세요."
              )
            }
          }}
        >
          <fieldset
            disabled={busy}
            className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6"
          >
            <div className="grid gap-2">
              <Label htmlFor="event-title">제목</Label>
              <Input
                id="event-title"
                autoFocus
                required
                maxLength={200}
                placeholder="일정 제목"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.allDay}
                onChange={(e) =>
                  setDraft({ ...draft, allDay: e.target.checked })
                }
              />
              하루 종일
            </label>
            <div className="grid gap-2">
              <Label htmlFor="event-start-date">시작</Label>
              <div className="flex gap-2">
                <Input
                  id="event-start-date"
                  aria-label="시작 날짜"
                  type="date"
                  required
                  value={draft.startDate}
                  onChange={(e) =>
                    setDraft({ ...draft, startDate: e.target.value })
                  }
                />
                {!draft.allDay && (
                  <Input
                    aria-label="시작 시간"
                    type="time"
                    required
                    value={draft.startTime}
                    onChange={(e) =>
                      setDraft({ ...draft, startTime: e.target.value })
                    }
                  />
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-end-date">종료</Label>
              <div className="flex gap-2">
                <Input
                  id="event-end-date"
                  aria-label="종료 날짜"
                  type="date"
                  required
                  min={draft.startDate}
                  value={draft.endDate}
                  onChange={(e) =>
                    setDraft({ ...draft, endDate: e.target.value })
                  }
                />
                {!draft.allDay && (
                  <Input
                    aria-label="종료 시간"
                    type="time"
                    required
                    value={draft.endTime}
                    onChange={(e) =>
                      setDraft({ ...draft, endTime: e.target.value })
                    }
                  />
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-color">색상</Label>
              <select
                id="event-color"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={draft.color}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    color: e.target.value as CalendarEvent["color"],
                  })
                }
              >
                <option value="blue">파랑</option>
                <option value="green">초록</option>
                <option value="orange">주황</option>
                <option value="purple">보라</option>
                <option value="rose">분홍</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-description">설명</Label>
              <textarea
                id="event-description"
                className="min-h-28 rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                maxLength={10000}
                placeholder="추가할 내용을 적어 주세요."
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </div>
            {(error || serverError) && (
              <p role="alert" className="text-sm text-destructive">
                {error || serverError}
              </p>
            )}
          </fieldset>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t p-4">
            {confirmDelete ? (
              <>
                <span className="mr-auto text-sm">이 일정을 삭제할까요?</span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={async () => {
                    if (await onDelete()) onClose()
                  }}
                >
                  삭제
                </Button>
              </>
            ) : (
              <>
                {existing && (
                  <Button
                    type="button"
                    variant="destructive"
                    className="mr-auto"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                  >
                    삭제
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={onClose}
                >
                  취소
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "저장 중…" : "일정 저장"}
                </Button>
              </>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
