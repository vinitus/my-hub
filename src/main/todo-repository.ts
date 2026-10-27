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
  TodoSchema,
  TodoSaveSchema,
  TodoIdSchema,
  type TodosAPI,
  type TodoSnapshot,
} from "../shared/todos"

const FileSchema = z
  .object({ version: z.literal(1), items: z.array(TodoSchema).max(500) })
  .strict()
const revision = (raw: string) => createHash("sha256").update(raw).digest("hex")
export class TodoRepository {
  private readonly path: string
  private readonly directory: string
  private tail: Promise<unknown> = Promise.resolve()
  constructor(directory: string) {
    this.directory = directory
    this.path = join(directory, "todos.json")
  }

  load = async (): Promise<TodoSnapshot> => {
    let bytes: Buffer
    try {
      if ((await stat(this.path)).size > 1024 * 1024)
        throw new Error("할일 목록은 1MB 이하여야 합니다.")
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
        "할일 목록을 읽을 수 없습니다. 원본 파일을 보존했습니다.",
        { cause }
      )
    }
  }

  private mutate(
    expectedRevision: string,
    change: (items: TodoSnapshot["items"]) => Promise<TodoSnapshot["items"]>
  ) {
    const result = this.tail.then(async () => {
      const current = await this.load()
      if (current.revision !== expectedRevision)
        throw new Error(
          "할일 목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요."
        )
      const items = await change(current.items)
      const raw =
        JSON.stringify(FileSchema.parse({ version: 1, items }), null, 2) + "\n"
      if (Buffer.byteLength(raw) > 1024 * 1024)
        throw new Error("할일 목록은 1MB 이하여야 합니다.")
      await mkdir(this.directory, { recursive: true })
      const temporary = join(this.directory, `.todos-${randomUUID()}.tmp`)
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

  save: TodosAPI["save"] = async (request) => {
    const parsed = TodoSaveSchema.safeParse(request)
    if (!parsed.success)
      throw new Error(
        parsed.error.issues[0]?.message ?? "할일을 확인해 주세요."
      )
    return this.mutate(parsed.data.expectedRevision, async (items) => {
      const todo = parsed.data.todo
      const existing = items.some((item) => item.id === todo.id)
      return existing
        ? items.map((item) => (item.id === todo.id ? todo : item))
        : [...items, todo]
    })
  }
  remove: TodosAPI["remove"] = async (request) => {
    const parsed = TodoIdSchema.safeParse(request)
    if (!parsed.success) throw new Error("삭제할 할일을 확인해 주세요.")
    return this.mutate(parsed.data.expectedRevision, async (items) =>
      items.filter((item) => item.id !== parsed.data.id)
    )
  }
}
