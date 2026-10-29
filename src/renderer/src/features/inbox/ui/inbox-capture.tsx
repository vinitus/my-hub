import { useId, useState } from "react"
import { PlusIcon, PaperclipIcon } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Textarea } from "@/shared/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog"
import { captureInboxDrop } from "../model/capture-drop"

export type InboxCaptureProps = {
  busy: boolean
  onCapture: (content: string, source: string) => Promise<boolean>
  onFiles: (files: File[]) => Promise<boolean>
  onChooseFiles: () => Promise<boolean>
}
export function InboxCapture(props: InboxCaptureProps) {
  const inputId = useId()
  const [content, setContent] = useState("")
  const [source, setSource] = useState("")
  async function submit() {
    if (
      content.trim() &&
      (await props.onCapture(content, source || "직접 입력"))
    ) {
      setContent("")
      setSource("")
    }
  }
  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
      }}
      onDrop={(event) => {
        void captureInboxDrop(event, props)
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        수집할 내용
      </label>
      <Textarea
        id={inputId}
        aria-label="수집할 내용"
        placeholder="떠오른 생각이나 링크를 적거나, 파일을 끌어 놓으세요."
        maxLength={10000}
        value={content}
        disabled={props.busy}
        className="min-h-24 resize-y border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        onChange={(event) => setContent(event.target.value)}
        onPaste={() => {
          if (!source) setSource("붙여넣기")
        }}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            (event.ctrlKey || event.metaKey) &&
            !event.nativeEvent.isComposing &&
            event.keyCode !== 229
          ) {
            event.preventDefault()
            void submit()
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Input
          aria-label="출처"
          placeholder="출처 (선택)"
          maxLength={500}
          value={source}
          onChange={(event) => setSource(event.target.value)}
          disabled={props.busy}
          className="h-8 min-w-0 flex-1 basis-full text-xs sm:basis-32"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto sm:ml-0"
          disabled={props.busy}
          onClick={() => void props.onChooseFiles()}
        >
          <PaperclipIcon />
          파일
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={props.busy || !content.trim()}
        >
          <PlusIcon />
          수집
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Ctrl+Enter로 수집 · 클립보드는 붙여넣은 내용만 사용합니다.
      </p>
    </form>
  )
}
export function InboxCaptureDialog({
  open,
  onOpenChange,
  error,
  ...props
}: InboxCaptureProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  error: string
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!props.busy) onOpenChange(next)
      }}
    >
      <DialogContent
        showCloseButton={!props.busy}
        className="max-h-[calc(100svh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>인박스에 수집</DialogTitle>
          <DialogDescription>
            생각, 링크, 파일을 모아두고 나중에 정리하세요.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <InboxCapture
          {...props}
          onCapture={async (content, source) => {
            const saved = await props.onCapture(content, source)
            if (saved) onOpenChange(false)
            return saved
          }}
          onFiles={async (files) => {
            const saved = await props.onFiles(files)
            if (saved) onOpenChange(false)
            return saved
          }}
          onChooseFiles={async () => {
            const saved = await props.onChooseFiles()
            if (saved) onOpenChange(false)
            return saved
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
