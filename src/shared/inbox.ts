import { z } from "zod"

export const InboxDraftSchema = z
  .object({
    kind: z.enum(["text", "link", "file"]),
    content: z
      .string()
      .trim()
      .min(1, "수집할 내용을 입력해 주세요.")
      .max(10000, "내용은 10,000자 이내로 입력해 주세요."),
    source: z.string().trim().min(1).max(500),
  })
  .strict()
export type InboxDraft = z.infer<typeof InboxDraftSchema>
export const InboxDestinationSchema = z
  .object({
    kind: z.enum(["note", "todo", "event", "shortcut"]),
    title: z.string().min(1).max(500),
  })
  .strict()
export type InboxDestination = z.infer<typeof InboxDestinationSchema>
export const InboxItemSchema = InboxDraftSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  processedAt: z.iso.datetime().nullable(),
  destination: InboxDestinationSchema.nullable(),
})
  .strict()
  .refine((item) => item.processedAt !== null || item.destination === null)
export type InboxItem = z.infer<typeof InboxItemSchema>
export type InboxSnapshot = {
  items: InboxItem[]
  revision: string
  path: string
}
const revision = z.string().min(1).max(100)
export const InboxCaptureSchema = z
  .object({
    drafts: z
      .array(InboxDraftSchema)
      .min(1)
      .max(50, "한 번에 50개까지 수집할 수 있습니다."),
    expectedRevision: revision,
  })
  .strict()
export const InboxIdSchema = z
  .object({ id: z.uuid(), expectedRevision: revision })
  .strict()
export const InboxProcessSchema = InboxIdSchema.extend({
  processed: z.boolean(),
  destination: InboxDestinationSchema.optional(),
})
  .strict()
  .refine((value) => value.processed || !value.destination)
export type InboxAPI = {
  load: () => Promise<InboxSnapshot>
  capture: (
    request: z.infer<typeof InboxCaptureSchema>
  ) => Promise<InboxSnapshot>
  process: (
    request: z.infer<typeof InboxProcessSchema>
  ) => Promise<InboxSnapshot>
  remove: (request: z.infer<typeof InboxIdSchema>) => Promise<InboxSnapshot>
  open: (request: z.infer<typeof InboxIdSchema>) => Promise<void>
  chooseFiles: (expectedRevision: string) => Promise<InboxSnapshot | null>
}
export type InboxRendererAPI = InboxAPI & {
  captureFiles: (
    files: File[],
    expectedRevision: string
  ) => Promise<InboxSnapshot>
}
export function inboxTextDraft(
  content: string,
  source = "직접 입력"
): InboxDraft {
  return {
    kind: /^https?:\/\/\S+$/i.test(content.trim()) ? "link" : "text",
    content: content.trim(),
    source: source.trim() || "직접 입력",
  }
}
export const INBOX_DESTINATION_LABELS = {
  note: "메모",
  todo: "할일",
  event: "일정",
  shortcut: "바로가기",
} as const
export function inboxTitle(item: Pick<InboxDraft, "kind" | "content">) {
  return (
    (item.kind === "file"
      ? item.content.split(/[\\/]/).filter(Boolean).at(-1)
      : item.content.split(/\r?\n/)[0]) || "수집한 항목"
  )
}
