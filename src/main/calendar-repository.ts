import {
  mkdir,
  readFile,
  stat,
  writeFile,
  rename,
  unlink,
} from "node:fs/promises"
import { join, dirname } from "node:path"
import { randomUUID, createHash } from "node:crypto"
import { z } from "zod"
import {
  CalendarEventSchema,
  CalendarSaveSchema,
  CalendarDeleteSchema,
  type CalendarAPI,
  type CalendarSnapshot,
} from "../shared/calendar"

const FileSchema = z
  .object({
    version: z.literal(1),
    events: z.array(CalendarEventSchema).max(10000),
  })
  .strict()

export class CalendarRepository {
  private readonly path: string
  private tail: Promise<unknown> = Promise.resolve()
  constructor(userData: string) {
    this.path = join(userData, "calendar.json")
  }

  load = async (): Promise<CalendarSnapshot> => {
    let raw: string
    try {
      if ((await stat(this.path)).size > 5 * 1024 * 1024)
        throw new Error("일정 파일은 5MB 이하여야 합니다.")
      raw = await readFile(this.path, "utf8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { events: [], revision: "missing", path: this.path }
      throw error
    }
    try {
      const { events } = FileSchema.parse(JSON.parse(raw))
      if (new Set(events.map((event) => event.id)).size !== events.length)
        throw new Error("중복된 일정 ID")
      return {
        events,
        revision: createHash("sha256").update(raw).digest("hex"),
        path: this.path,
      }
    } catch (cause) {
      throw new Error(
        "일정 파일을 읽을 수 없습니다. 원본 파일을 보존했습니다.",
        { cause }
      )
    }
  }

  private mutate(
    action: (snapshot: CalendarSnapshot) => CalendarSnapshot["events"],
    expectedRevision: string
  ) {
    const result = this.tail.then(async () => {
      const current = await this.load()
      if (expectedRevision !== current.revision)
        throw new Error(
          "다른 곳에서 일정이 변경되었습니다. 새로고침 후 일정을 다시 열어 주세요."
        )
      const events = action(current)
      const raw =
        JSON.stringify(FileSchema.parse({ version: 1, events }), null, 2) + "\n"
      if (Buffer.byteLength(raw) > 5 * 1024 * 1024)
        throw new Error("일정 파일은 5MB 이하여야 합니다.")
      await mkdir(dirname(this.path), { recursive: true })
      const temporary = join(
        dirname(this.path),
        `.calendar-${randomUUID()}.tmp`
      )
      try {
        await writeFile(temporary, raw, { encoding: "utf8", flag: "wx" })
        await rename(temporary, this.path)
      } finally {
        await unlink(temporary).catch(() => {})
      }
      return {
        events,
        path: this.path,
        revision: createHash("sha256").update(raw).digest("hex"),
      }
    })
    this.tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  save: CalendarAPI["save"] = async (request) => {
    const parsed = CalendarSaveSchema.safeParse(request)
    if (!parsed.success)
      throw new Error(
        parsed.error.issues[0]?.message ?? "일정을 확인해 주세요."
      )
    const { event, expectedRevision } = parsed.data
    return this.mutate(
      (current) => [
        ...current.events.filter((item) => item.id !== event.id),
        event,
      ],
      expectedRevision
    )
  }
  remove: CalendarAPI["remove"] = async (request) => {
    const parsed = CalendarDeleteSchema.safeParse(request)
    if (!parsed.success) throw new Error("삭제할 일정을 확인해 주세요.")
    return this.mutate(
      (current) =>
        current.events.filter((event) => event.id !== parsed.data.id),
      parsed.data.expectedRevision
    )
  }
}
