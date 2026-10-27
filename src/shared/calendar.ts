import { z } from "zod"

export const EVENT_COLORS = [
  "blue",
  "green",
  "orange",
  "purple",
  "rose",
] as const
const eventFields = {
  id: z.uuid(),
  title: z
    .string()
    .trim()
    .min(1, "일정 제목을 입력해 주세요.")
    .max(200, "제목은 200자 이내로 입력해 주세요."),
  description: z.string().max(10000),
  color: z.enum(EVENT_COLORS),
}
// 종일 일정의 end는 다음 날 0시(미포함). 시간 일정은 오프셋이 있는 ISO 문자열이다.
export const CalendarEventSchema = z
  .discriminatedUnion("allDay", [
    z
      .object({
        ...eventFields,
        allDay: z.literal(true),
        start: z.iso.date(),
        end: z.iso.date(),
      })
      .strict(),
    z
      .object({
        ...eventFields,
        allDay: z.literal(false),
        start: z.iso.datetime({ offset: true }),
        end: z.iso.datetime({ offset: true }),
      })
      .strict(),
  ])
  .refine(
    (event) =>
      event.allDay
        ? event.end > event.start
        : Date.parse(event.end) > Date.parse(event.start),
    { message: "종료는 시작보다 늦어야 합니다.", path: ["end"] }
  )

export type CalendarEvent = z.infer<typeof CalendarEventSchema>
export type CalendarSnapshot = {
  events: CalendarEvent[]
  revision: string
  path: string
}
export const CalendarSaveSchema = z
  .object({ event: CalendarEventSchema, expectedRevision: z.string().max(100) })
  .strict()
export const CalendarDeleteSchema = z
  .object({ id: z.uuid(), expectedRevision: z.string().max(100) })
  .strict()
export type CalendarAPI = {
  load: () => Promise<CalendarSnapshot>
  save: (
    request: z.infer<typeof CalendarSaveSchema>
  ) => Promise<CalendarSnapshot>
  remove: (
    request: z.infer<typeof CalendarDeleteSchema>
  ) => Promise<CalendarSnapshot>
}
