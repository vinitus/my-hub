import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { CodexPreferencesSchema, type CodexPreferences } from "../shared/codex"

// My Hub 전용 설정이며, 공유 CLI의 config.toml은 변경하지 않는다.
export class CodexSettings {
  private readonly directory: string
  private readonly path: string
  private tail: Promise<unknown> = Promise.resolve()
  constructor(directory: string) {
    this.directory = directory
    this.path = join(directory, "codex-settings.json")
  }
  async read(): Promise<CodexPreferences> {
    await this.tail
    let raw: string
    try {
      raw = await readFile(this.path, "utf8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { model: null, reasoningEffort: null }
      throw error
    }
    const parsed = CodexPreferencesSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) throw new Error("저장된 모델 설정을 읽을 수 없습니다.")
    return parsed.data
  }
  save(request: unknown): Promise<CodexPreferences> {
    const preferences = CodexPreferencesSchema.parse(request)
    const save = this.tail.then(async () => {
      await mkdir(this.directory, { recursive: true })
      const temporary = join(this.directory, `.codex-${randomUUID()}.tmp`)
      try {
        await writeFile(
          temporary,
          JSON.stringify(preferences, null, 2) + "\n",
          { encoding: "utf8", flag: "wx" }
        )
        await rename(temporary, this.path)
      } finally {
        await unlink(temporary).catch(() => {})
      }
      return preferences
    })
    this.tail = save.catch(() => {})
    return save
  }
}
