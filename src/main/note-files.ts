import {
  readFile,
  writeFile,
  rename,
  unlink,
  stat,
  link,
} from "node:fs/promises"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"
import { normalizeNoteName } from "../shared/notes"

export const MAX_NOTE_BYTES = 5 * 1024 * 1024

export async function readMarkdown(path: string) {
  if ((await stat(path)).size > MAX_NOTE_BYTES)
    throw new Error("5MB 이하의 메모만 열 수 있습니다.")
  const bytes = await readFile(path)
  if (bytes.length > MAX_NOTE_BYTES)
    throw new Error("5MB 이하의 메모만 열 수 있습니다.")
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
}

export async function renameMarkdown(path: string, name: string) {
  const target = join(dirname(path), normalizeNoteName(name))
  if (target === path) return path
  if (
    process.platform === "win32" &&
    target.toLowerCase() === path.toLowerCase()
  ) {
    await rename(path, target)
    return target
  }
  // link는 대상이 이미 있으면 실패한다. rename의 기존 파일 덮어쓰기를 피한다.
  try {
    await link(path, target)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error(
        "같은 이름의 파일이 이미 있습니다. 다른 제목을 입력해 주세요.",
        { cause: error }
      )
    throw error
  }
  try {
    await unlink(path)
  } catch (error) {
    await unlink(target).catch(() => {})
    throw error
  }
  return target
}

export async function writeMarkdown(
  path: string,
  markdown: string,
  expected?: string
) {
  if (Buffer.byteLength(markdown) > MAX_NOTE_BYTES)
    throw new Error("메모는 5MB 이하여야 합니다.")
  if (expected !== undefined && (await readMarkdown(path)) !== expected) {
    throw new Error(
      "다른 프로그램에서 파일이 변경되었습니다. 다른 이름으로 저장하거나 파일을 다시 열어 주세요."
    )
  }
  // 같은 디렉터리에 먼저 완성한 뒤 교체하여 쓰기 실패 시 원본을 보존한다.
  const temporary = join(dirname(path), `.memo-${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, markdown, { encoding: "utf8", flag: "wx" })
    await rename(temporary, path)
  } finally {
    await unlink(temporary).catch(() => {})
  }
}
