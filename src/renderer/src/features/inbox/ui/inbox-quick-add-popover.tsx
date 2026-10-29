import { useRef, useState } from "react"
import { CheckIcon, InboxIcon, XIcon } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Popover } from "@base-ui/react/popover"

export function InboxQuickAddPopover({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (content: string) => Promise<void>
}) {
  const input = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState<number | null>(null)
  async function save() {
    const value = content.trim()
    if (!value || submitting.current) return
    submitting.current = true
    setSaving(true)
    setError("")
    try {
      await onSave(value)
      setContent("")
      onOpenChange(false)
      setNotice((current) => (current ?? 0) + 1)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "인박스에 저장하지 못했습니다. 다시 시도해 주세요."
      )
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }
  return (
    <>
      <Popover.Root
        modal={false}
        open={open}
        onOpenChange={(next) => {
          if (!submitting.current) onOpenChange(next)
        }}
      >
        <Popover.Trigger
          render={<Button variant="outline" size="sm" className="min-h-11" />}
        >
          <InboxIcon />
          인박스 추가
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="z-50"
          >
            <Popover.Popup
              initialFocus={input}
              className="relative max-h-[var(--available-height)] w-[400px] max-w-[calc(100vw-1.5rem)] overflow-auto rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-lg outline-none"
            >
              <Popover.Close
                disabled={saving}
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-2 right-2"
                    aria-label="인박스 추가 닫기"
                  />
                }
              >
                <XIcon />
              </Popover.Close>
              <div className="mb-4 flex flex-col gap-2 pr-7">
                <Popover.Title className="font-medium">
                  인박스에 추가
                </Popover.Title>
                <Popover.Description className="text-muted-foreground">
                  생각이나 링크를 모아두고 나중에 정리하세요.
                </Popover.Description>
              </div>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void save()
                }}
                aria-busy={saving}
              >
                <Input
                  ref={input}
                  aria-label="인박스에 추가할 내용"
                  aria-invalid={Boolean(error)}
                  placeholder="생각, 할일, URL 등을 입력하세요..."
                  maxLength={10000}
                  value={content}
                  disabled={saving}
                  autoComplete="off"
                  onChange={(event) => {
                    setContent(event.target.value)
                    setError("")
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      (event.nativeEvent.isComposing || event.keyCode === 229)
                    )
                      event.preventDefault()
                  }}
                />
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Enter 저장 · Esc 닫기
                </p>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => onOpenChange(false)}
                  >
                    취소
                  </Button>
                  <Button type="submit" disabled={saving || !content.trim()}>
                    {saving ? "저장 중…" : "저장"}
                  </Button>
                </div>
              </form>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {notice !== null && (
        <aside
          key={notice}
          role="status"
          aria-label="인박스 추가 결과"
          className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
        >
          <CheckIcon aria-hidden className="size-4 shrink-0" />
          <span>인박스에 추가했습니다.</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="인박스 추가 안내 닫기"
            onClick={() => setNotice(null)}
          >
            <XIcon />
          </Button>
        </aside>
      )}
    </>
  )
}
