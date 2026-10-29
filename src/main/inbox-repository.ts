import {
  mkdir,
  readFile,
  stat,
  writeFile,
  rename,
  unlink,
} from "node:fs/promises"
import { join, isAbsolute, normalize } from "node:path"
import { randomUUID, createHash } from "node:crypto"
import { z } from "zod"
import {
  InboxCaptureSchema,
  InboxIdSchema,
  InboxItemSchema,
  InboxProcessSchema,
  type InboxAPI,
  type InboxSnapshot,
} from "../shared/inbox"
import { websiteUrl } from "../shared/shortcuts"

const FileSchema = z
  .object({ version: z.literal(1), items: z.array(InboxItemSchema).max(2000) })
  .strict()
const revision = (raw: string) => createHash("sha256").update(raw).digest("hex")
export class InboxRepository {
  private readonly path: string
  private readonly directory: string
  private tail: Promise<unknown> = Promise.resolve()
  constructor(directory: string) {
    this.directory = directory
    this.path = join(directory, "inbox.json")
  }
  load = async (): Promise<InboxSnapshot> => {
    let bytes: Buffer
    try {
      if ((await stat(this.path)).size > 10 * 1024 * 1024)
        throw new Error("인박스는 10MB 이하여야 합니다.")
      bytes = await readFile(this.path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { items: [], revision: "missing", path: this.path }
      throw error
    }
    try {
      const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
      const { items } = FileSchema.parse(JSON.parse(raw))
      if (new Set(items.map((item) => item.id)).size !== items.length)
        throw new Error("중복된 ID")
      return { items, revision: revision(raw), path: this.path }
    } catch (cause) {
      throw new Error("인박스를 읽을 수 없습니다. 원본 파일을 보존했습니다.", {
        cause,
      })
    }
  }
  private mutate(
    expectedRevision: string,
    change: (
      items: InboxSnapshot["items"]
    ) => Promise<InboxSnapshot["items"]> | InboxSnapshot["items"]
  ) {
    const result = this.tail.then(async () => {
      const current = await this.load()
      if (current.revision !== expectedRevision)
        throw new Error(
          "인박스가 변경되었습니다. 새로고침 후 다시 시도해 주세요."
        )
      const items = await change(current.items)
      const raw =
        JSON.stringify(FileSchema.parse({ version: 1, items }), null, 2) + "\n"
      if (Buffer.byteLength(raw) > 10 * 1024 * 1024)
        throw new Error("인박스는 10MB 이하여야 합니다.")
      await mkdir(this.directory, { recursive: true })
      const temporary = join(this.directory, `.inbox-${randomUUID()}.tmp`)
      try {
        await writeFile(temporary, raw, { encoding: "utf8", flag: "wx" })
        await rename(temporary, this.path)
      } finally {
        await unlink(temporary).catch(() => {})
      }
      return { items, revision: revision(raw), path: this.path }
    })
    this.tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
  capture: InboxAPI["capture"] = async (request) => {
    const parsed = InboxCaptureSchema.safeParse(request)
    if (!parsed.success)
      throw new Error(
        parsed.error.issues[0]?.message ?? "수집할 항목을 확인해 주세요."
      )
    return this.mutate(parsed.data.expectedRevision, async (items) => {
      const drafts = []
      for (const draft of parsed.data.drafts) {
        let content = draft.content
        if (draft.kind === "link") content = websiteUrl(content)
        if (draft.kind === "file") {
          if (
            !isAbsolute(content) ||
            [...content].some((character) => character.charCodeAt(0) < 32)
          )
            throw new Error("파일의 절대 경로를 확인해 주세요.")
          content = normalize(content)
          const details = await stat(content)
          if (!details.isFile() && !details.isDirectory())
            throw new Error("파일이나 폴더를 선택해 주세요.")
        }
        drafts.push({
          ...draft,
          content,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          processedAt: null,
          destination: null,
        })
      }
      return [...drafts, ...items]
    })
  }
  process: InboxAPI["process"] = async (request) => {
    const parsed = InboxProcessSchema.safeParse(request)
    if (!parsed.success) throw new Error("처리할 항목을 확인해 주세요.")
    return this.mutate(parsed.data.expectedRevision, (items) => {
      if (!items.some((item) => item.id === parsed.data.id))
        throw new Error("항목을 찾을 수 없습니다.")
      return items.map((item) =>
        item.id === parsed.data.id
          ? {
              ...item,
              processedAt: parsed.data.processed
                ? new Date().toISOString()
                : null,
              destination: parsed.data.processed
                ? (parsed.data.destination ?? null)
                : null,
            }
          : item
      )
    })
  }
  remove: InboxAPI["remove"] = async (request) => {
    const parsed = InboxIdSchema.parse(request)
    return this.mutate(parsed.expectedRevision, (items) =>
      items.filter((item) => item.id !== parsed.id)
    )
  }
  resolve = async (request: unknown) => {
    const { id, expectedRevision } = InboxIdSchema.parse(request)
    const snapshot = await this.load()
    if (snapshot.revision !== expectedRevision)
      throw new Error("인박스가 변경되었습니다. 새로고침해 주세요.")
    const item = snapshot.items.find((item) => item.id === id)
    if (!item) throw new Error("항목을 찾을 수 없습니다.")
    return item
  }
}
