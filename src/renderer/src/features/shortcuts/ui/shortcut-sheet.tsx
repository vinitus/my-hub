import { useId, useState } from "react"
import { FolderOpenIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/shared/ui/sheet"
import {
  ShortcutSchema,
  SHORTCUT_LABELS,
  type Shortcut,
  type ShortcutKind,
  type ShortcutSelection,
} from "../../../../../shared/shortcuts"
import { shortcutError } from "../model/shortcut-store"

type Props = {
  item: Shortcut
  existing: boolean
  confirmDeleteOnOpen?: boolean
  busy: boolean
  error: string
  onChoose: (kind: "program" | "folder") => Promise<ShortcutSelection | null>
  onSave: (item: Shortcut) => Promise<boolean>
  onDelete: () => Promise<boolean>
  onClose: () => void
}
export function ShortcutSheet({
  item,
  existing,
  confirmDeleteOnOpen = false,
  busy,
  error,
  onChoose,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const formId = useId()
  const [draft, setDraft] = useState(item)
  const [localError, setLocalError] = useState("")
  const [choosing, setChoosing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(confirmDeleteOnOpen)
  const disabled = busy || choosing
  async function browse() {
    if (draft.kind === "website" || disabled) return
    setChoosing(true)
    setLocalError("")
    try {
      const selected = await onChoose(draft.kind)
      if (selected)
        setDraft((current) => ({
          ...current,
          target: selected.target,
          name: current.name || selected.name,
        }))
    } catch (cause) {
      setLocalError(shortcutError(cause))
    } finally {
      setChoosing(false)
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !disabled) onClose()
      }}
    >
      <SheetContent className="w-full sm:max-w-md" showCloseButton={!disabled}>
        <SheetHeader>
          <SheetTitle>
            {existing ? "바로가기 수정" : "바로가기 추가"}
          </SheetTitle>
          <SheetDescription>
            자주 사용하는 프로그램, 폴더, 웹사이트를 등록하세요.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={async (e) => {
            e.preventDefault()
            if (disabled) return
            setLocalError("")
            const result = ShortcutSchema.safeParse(draft)
            if (!result.success) {
              setLocalError(
                result.error.issues[0]?.message ?? "입력 내용을 확인해 주세요."
              )
              return
            }
            if (await onSave(result.data)) onClose()
          }}
        >
          <fieldset
            disabled={disabled}
            className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-5"
          >
            <div className="grid gap-2">
              <Label htmlFor={`${formId}-shortcut-kind`}>종류</Label>
              <select
                id={`${formId}-shortcut-kind`}
                className="h-9 w-full rounded-md border bg-background px-3"
                value={draft.kind}
                onChange={(e) => {
                  setDraft({
                    ...draft,
                    kind: e.target.value as ShortcutKind,
                    target: "",
                  })
                  setLocalError("")
                }}
              >
                {Object.entries(SHORTCUT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${formId}-shortcut-name`}>이름</Label>
              <Input
                id={`${formId}-shortcut-name`}
                autoFocus
                required
                maxLength={80}
                placeholder="예: 작업 폴더"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${formId}-shortcut-target`}>
                {draft.kind === "website" ? "웹사이트 주소" : "경로"}
              </Label>
              <Input
                id={`${formId}-shortcut-target`}
                required
                maxLength={4096}
                type={draft.kind === "website" ? "url" : "text"}
                spellCheck={false}
                placeholder={
                  draft.kind === "website"
                    ? "https://example.com"
                    : "찾아보기로 대상을 선택하세요"
                }
                value={draft.target}
                onChange={(e) => setDraft({ ...draft, target: e.target.value })}
              />
              {draft.kind !== "website" && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-1 w-fit"
                  onClick={() => void browse()}
                >
                  <FolderOpenIcon />
                  {choosing ? "선택 중…" : "찾아보기"}
                </Button>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                {draft.kind === "program"
                  ? "Windows 실행 파일(.exe)이나 기존 바로가기(.lnk)를 선택하세요."
                  : draft.kind === "folder"
                    ? "클릭하면 파일 탐색기로 폴더를 엽니다."
                    : "http 또는 https 주소를 기본 브라우저로 엽니다."}
              </p>
            </div>
            {(localError || error) && (
              <p role="alert" className="text-sm text-destructive">
                {localError || error}
              </p>
            )}
          </fieldset>
          <div className="flex flex-wrap items-center gap-2 border-t p-4">
            {existing && (
              <Button
                type="button"
                variant="destructive"
                disabled={disabled}
                onClick={async () => {
                  if (!confirmDelete) {
                    setConfirmDelete(true)
                    return
                  }
                  if (await onDelete()) onClose()
                }}
              >
                <Trash2Icon />
                {confirmDelete ? "삭제 확인" : "삭제"}
              </Button>
            )}
            {confirmDelete && (
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => setConfirmDelete(false)}
              >
                삭제 취소
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={onClose}
              >
                취소
              </Button>
              <Button type="submit" disabled={disabled}>
                {busy ? "저장 중…" : "저장"}
              </Button>
            </div>
            {confirmDelete && (
              <p className="w-full text-xs text-muted-foreground">
                목록에서만 삭제하며 실제 프로그램이나 폴더는 삭제하지 않습니다.
              </p>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
