import {
  mkdir,
  readFile,
  stat,
  writeFile,
  rename,
  unlink,
} from "node:fs/promises"
import { join } from "node:path"
import { randomUUID, createHash } from "node:crypto"
import { z } from "zod"
import {
  ShortcutSchema,
  ShortcutSaveSchema,
  ShortcutIdSchema,
  ShortcutReorderSchema,
  type ShortcutsAPI,
  type ShortcutSnapshot,
} from "../shared/shortcuts"
import { validateShortcut } from "./shortcut-target"

const FileSchema = z
  .object({ version: z.literal(1), items: z.array(ShortcutSchema).max(500) })
  .strict()
const revision = (raw: string) => createHash("sha256").update(raw).digest("hex")
export class ShortcutRepository {
  private readonly path: string
  private readonly directory: string
  private tail: Promise<unknown> = Promise.resolve()
  constructor(directory: string) {
    this.directory = directory
    this.path = join(directory, "shortcuts.json")
  }

  load = async (): Promise<ShortcutSnapshot> => {
    let bytes: Buffer
    try {
      if ((await stat(this.path)).size > 1024 * 1024)
        throw new Error("바로가기 목록은 1MB 이하여야 합니다.")
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
      throw new Error(
        "바로가기 목록을 읽을 수 없습니다. 원본 파일을 보존했습니다.",
        { cause }
      )
    }
  }

  private mutate(
    expectedRevision: string,
    change: (
      items: ShortcutSnapshot["items"]
    ) => Promise<ShortcutSnapshot["items"]>
  ) {
    const result = this.tail.then(async () => {
      const current = await this.load()
      if (current.revision !== expectedRevision)
        throw new Error(
          "바로가기 목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요."
        )
      const items = await change(current.items)
      const raw =
        JSON.stringify(FileSchema.parse({ version: 1, items }), null, 2) + "\n"
      if (Buffer.byteLength(raw) > 1024 * 1024)
        throw new Error("바로가기 목록은 1MB 이하여야 합니다.")
      await mkdir(this.directory, { recursive: true })
      const temporary = join(this.directory, `.shortcuts-${randomUUID()}.tmp`)
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

  save: ShortcutsAPI["save"] = async (request) => {
    const parsed = ShortcutSaveSchema.safeParse(request)
    if (!parsed.success)
      throw new Error(
        parsed.error.issues[0]?.message ?? "바로가기를 확인해 주세요."
      )
    return this.mutate(parsed.data.expectedRevision, async (items) => {
      const shortcut = await validateShortcut(parsed.data.shortcut)
      const existing = items.some((item) => item.id === shortcut.id)
      return existing
        ? items.map((item) => (item.id === shortcut.id ? shortcut : item))
        : [...items, shortcut]
    })
  }
  remove: ShortcutsAPI["remove"] = async (request) => {
    const parsed = ShortcutIdSchema.safeParse(request)
    if (!parsed.success) throw new Error("삭제할 바로가기를 확인해 주세요.")
    return this.mutate(parsed.data.expectedRevision, async (items) =>
      items.filter((item) => item.id !== parsed.data.id)
    )
  }
  reorder: ShortcutsAPI["reorder"] = async (request) => {
    const parsed = ShortcutReorderSchema.safeParse(request)
    if (!parsed.success) throw new Error("Invalid shortcut order.")
    return this.mutate(parsed.data.expectedRevision, async (items) => {
      const byId = new Map(items.map((item) => [item.id, item]))
      if (
        parsed.data.ids.length !== items.length ||
        parsed.data.ids.some((id) => !byId.has(id))
      )
        throw new Error("Shortcut order does not match the saved list.")
      return parsed.data.ids.map((id) => byId.get(id)!)
    })
  }

  // 실행 시 renderer가 임의의 경로나 URL을 전달하지 못하게 등록된 ID만 받는다.
  resolve = async (request: unknown) => {
    const parsed = ShortcutIdSchema.safeParse(request)
    if (!parsed.success) throw new Error("실행할 바로가기를 확인해 주세요.")
    const current = await this.load()
    if (current.revision !== parsed.data.expectedRevision)
      throw new Error(
        "바로가기 목록이 변경되었습니다. 새로고침 후 다시 실행해 주세요."
      )
    const item = current.items.find((item) => item.id === parsed.data.id)
    if (!item) throw new Error("등록되지 않은 바로가기입니다.")
    return validateShortcut(item)
  }
}
