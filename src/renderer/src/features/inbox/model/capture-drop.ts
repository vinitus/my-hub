import type { DragEvent } from "react"
import type { InboxCaptureProps } from "../ui/inbox-capture"

export async function captureInboxDrop(
  event: DragEvent,
  props: InboxCaptureProps
) {
  event.preventDefault()
  event.stopPropagation()
  if (props.busy) return false
  const files = Array.from(event.dataTransfer.files)
  if (files.length) return props.onFiles(files)
  const uri = event.dataTransfer
    .getData("text/uri-list")
    .split(/\r?\n/)
    .find((line) => line && !line.startsWith("#"))
  const text = uri || event.dataTransfer.getData("text/plain")
  return text.trim() ? props.onCapture(text, "드래그 앤 드롭") : false
}
