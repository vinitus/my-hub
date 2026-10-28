import {
  mkdir,
  readFile,
  readdir,
  stat,
  lstat,
  writeFile,
  link,
  unlink,
  rename,
} from "node:fs/promises"
import { join, isAbsolute, basename, dirname, extname } from "node:path"
import { randomUUID } from "node:crypto"
import {
  DEFAULT_NOTE_NAME,
  normalizeNoteName,
  type NoteLibrarySnapshot,
} from "../shared/notes"
import { MAX_NOTE_BYTES, readMarkdown } from "./note-files"

export class NoteLibrary {
  private readonly paths: { documents: string; userData: string }
  private directoryPromise: Promise<string> | undefined
  private readonly settingsPath: string
  private readonly favoritesPath: string
  constructor(paths: { documents: string; userData: string }) {
    this.paths = paths
    this.settingsPath = join(paths.userData, "notes-settings.json")
    this.favoritesPath = join(paths.userData, "note-favorites.json")
  }

  directory() {
    this.directoryPromise ??= this.loadDirectory()
    return this.directoryPromise
  }

  private async loadDirectory() {
    let directory = join(this.paths.documents, "My Hub", "Notes")
    try {
      const settings: unknown = JSON.parse(
        await readFile(this.settingsPath, "utf8")
      )
      if (
        !settings ||
        typeof settings !== "object" ||
        !("directory" in settings) ||
        typeof settings.directory !== "string" ||
        !isAbsolute(settings.directory)
      ) {
        throw new Error(
          "메모 폴더 설정을 읽을 수 없습니다. 폴더를 다시 선택해 주세요."
        )
      }
      directory = settings.directory
      if (!(await stat(directory)).isDirectory())
        throw new Error("메모 저장 위치가 폴더가 아닙니다.")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      // 설정은 있지만 지정 폴더가 사라진 경우 기본 폴더로 조용히 전환하지 않는다.
      try {
        await stat(this.settingsPath)
      } catch (settingsError) {
        if ((settingsError as NodeJS.ErrnoException).code !== "ENOENT")
          throw settingsError
        await mkdir(directory, { recursive: true })
        return directory
      }
      throw new Error(
        "메모 폴더에 접근할 수 없습니다. 폴더를 다시 선택해 주세요.",
        { cause: error }
      )
    }
    return directory
  }

  async setDirectory(directory: string) {
    if (!isAbsolute(directory) || !(await stat(directory)).isDirectory())
      throw new Error("메모를 저장할 폴더를 선택해 주세요.")
    // 읽을 수 있는 폴더인지 확인한 뒤에만 설정을 바꾼다. 기존 파일은 이동하지 않는다.
    await readdir(directory)
    await mkdir(this.paths.userData, { recursive: true })
    const temporary = join(
      this.paths.userData,
      `.notes-settings-${randomUUID()}.tmp`
    )
    try {
      await writeFile(temporary, JSON.stringify({ directory }), {
        encoding: "utf8",
        flag: "wx",
      })
      await rename(temporary, this.settingsPath)
    } finally {
      await unlink(temporary).catch(() => {})
    }
    this.directoryPromise = Promise.resolve(directory)
    return this.snapshot()
  }

  async snapshot(): Promise<NoteLibrarySnapshot> {
    const directory = await this.directory()
    const favorites = await this.readFavorites()
    const entries = await readdir(directory, { withFileTypes: true })
    const notes = await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isFile() && extname(entry.name).toLowerCase() === ".md"
        )
        .map(async (entry) => {
          const path = join(directory, entry.name)
          try {
            return {
              name: entry.name,
              path,
              modifiedAt: (await stat(path)).mtimeMs,
              ...(favorites.has(path) ? { favorite: true } : {}),
            }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
            throw error
          }
        })
    )
    return {
      directory,
      notes: notes
        .filter((note) => note !== null)
        .sort(
          (a, b) => b.modifiedAt - a.modifiedAt || a.name.localeCompare(b.name)
        ),
    }
  }

  private async readFavorites() {
    try {
      const value: unknown = JSON.parse(
        await readFile(this.favoritesPath, "utf8")
      )
      if (
        !value ||
        typeof value !== "object" ||
        !("paths" in value) ||
        !Array.isArray(value.paths) ||
        !value.paths.every((path) => typeof path === "string")
      )
        throw new Error("메모 즐겨찾기 설정이 올바르지 않습니다.")
      return new Set(value.paths)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return new Set<string>()
      throw error
    }
  }

  async setFavorite(path: string, favorite: boolean) {
    const directory = await this.directory()
    if (!isAbsolute(path) || dirname(path) !== directory)
      throw new Error("현재 메모 폴더의 항목만 즐겨찾기할 수 있습니다.")
    const entry = (await this.snapshot()).notes.find(
      (note) => note.path === path
    )
    if (!entry) throw new Error("메모 목록에서 파일을 선택해 주세요.")
    const paths = await this.readFavorites()
    if (favorite) paths.add(path)
    else paths.delete(path)
    await mkdir(this.paths.userData, { recursive: true })
    const temporary = join(
      this.paths.userData,
      `.note-favorites-${randomUUID()}.tmp`
    )
    try {
      await writeFile(temporary, JSON.stringify({ paths: [...paths] }), {
        encoding: "utf8",
        flag: "wx",
      })
      await rename(temporary, this.favoritesPath)
    } finally {
      await unlink(temporary).catch(() => {})
    }
    return this.snapshot()
  }

  async open(name: string) {
    if (
      typeof name !== "string" ||
      basename(name) !== name ||
      /[/\\]/.test(name) ||
      extname(name).toLowerCase() !== ".md"
    )
      throw new Error("메모 목록에서 파일을 선택해 주세요.")
    const path = join(await this.directory(), name)
    if (!(await lstat(path)).isFile())
      throw new Error("일반 Markdown 파일만 열 수 있습니다.")
    return { path, name, markdown: await readMarkdown(path) }
  }

  async create(markdown: string, requestedName = DEFAULT_NOTE_NAME) {
    if (Buffer.byteLength(markdown) > MAX_NOTE_BYTES)
      throw new Error("메모는 5MB 이하여야 합니다.")
    const directory = await this.directory()
    const normalized = normalizeNoteName(requestedName)
    const stem = normalized.slice(0, -3)
    const temporary = join(directory, `.memo-${randomUUID()}.tmp`)
    try {
      await writeFile(temporary, markdown, { encoding: "utf8", flag: "wx" })
      for (let number = 1; number <= 10000; number++) {
        const name = number === 1 ? normalized : `${stem} (${number}).md`
        const path = join(directory, name)
        try {
          // 완성된 임시 파일을 배치한다. 이미 존재하는 파일은 절대 덮어쓰지 않는다.
          await link(temporary, path)
          return { path, name, markdown }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
        }
      }
      throw new Error("같은 제목의 메모가 너무 많습니다. 제목을 바꿔 주세요.")
    } finally {
      await unlink(temporary).catch(() => {})
    }
  }
}
