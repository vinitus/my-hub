import { app, shell } from "electron"
import { stat } from "node:fs/promises"
import { dirname, extname, isAbsolute, normalize, resolve } from "node:path"
import type { Shortcut } from "../shared/shortcuts"

const MAX_BYTES = 256 * 1024

function iconPath(value: string, link: string): string | null {
  const expanded = value
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/%([^%]+)%/g, (match, key: string) => process.env[key] ?? match)
  if (!expanded || expanded.includes("\0")) return null
  return isAbsolute(expanded)
    ? normalize(expanded)
    : resolve(dirname(link), expanded)
}

function fileIconSources(item: Shortcut): string[] {
  if (
    process.platform !== "win32" ||
    extname(item.target).toLowerCase() !== ".lnk"
  )
    return [item.target]
  try {
    const details = shell.readShortcutLink(item.target)
    // .lnk 자체에 아이콘이 없으면 실제 실행 파일의 아이콘을 읽는다.
    // 등록된 경로와 실행 인수는 바꾸지 않고 아이콘 읽기에만 해석 결과를 사용한다.
    const sources = [details.icon, details.target]
      .filter((value): value is string => !!value)
      .map((value) => iconPath(value, item.target))
      .filter((value): value is string => !!value)
    return [...new Set([...sources, item.target])]
  } catch {
    return [item.target]
  }
}

// HTML/SVG를 이미지로 전달하지 않는다. 브라우저가 지원하는 비트맵 형식만 식별한다.
function imageMime(bytes: Buffer): string | null {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png"
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg"
  if (["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii")))
    return "image/gif"
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp"
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0)
    return "image/x-icon"
  return null
}

async function websiteIcon(target: string): Promise<string | null> {
  // 제3자 favicon 서비스에 주소를 보내지 않고, 등록한 사이트에만 요청한다.
  const response = await fetch(new URL("/favicon.ico", target), {
    signal: AbortSignal.timeout(4000),
    redirect: "error",
    credentials: "omit",
  })
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    return null
  }
  if (Number(response.headers.get("content-length")) > MAX_BYTES) {
    await response.body.cancel()
    return null
  }
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = Buffer.concat(chunks)
  const mime = imageMime(bytes)
  return mime ? `data:${mime};base64,${bytes.toString("base64")}` : null
}

export class ShortcutIcons {
  private readonly cache = new Map<
    string,
    { expires: number; result: Promise<string | null> }
  >()
  private running = 0
  private readonly waiters: Array<() => void> = []

  async get(item: Shortcut): Promise<string | null> {
    let stamp = ""
    let sources = [item.target]
    if (item.kind !== "website") {
      try {
        await stat(item.target)
        sources = fileIconSources(item)
        // 실행 파일이나 별도 아이콘만 교체된 경우에도 캐시를 갱신한다.
        stamp = (
          await Promise.all(
            sources.map(async (path) => {
              try {
                const details = await stat(path)
                return `${path}:${details.mtimeMs}:${details.size}`
              } catch {
                return `${path}:missing`
              }
            })
          )
        ).join("|")
      } catch {
        return null
      }
    }
    const key = `${item.kind}:${item.target}:${stamp}`
    const cached = this.cache.get(key)
    if (cached && cached.expires > Date.now()) return cached.result
    const result = this.load(item, sources)
    // 실패 결과도 캐시해 화면을 다시 그릴 때 같은 요청이 반복되지 않게 한다.
    this.cache.set(key, { expires: Date.now() + 5 * 60 * 1000, result })
    if (this.cache.size > 512)
      this.cache.delete(this.cache.keys().next().value!)
    return result
  }

  private async load(
    item: Shortcut,
    sources: string[]
  ): Promise<string | null> {
    if (this.running >= 6)
      await new Promise<void>((resolve) => this.waiters.push(resolve))
    else this.running++
    try {
      if (item.kind === "website") return await websiteIcon(item.target)
      for (const path of sources) {
        try {
          const icon = await app.getFileIcon(path, { size: "normal" })
          if (!icon.isEmpty()) return icon.toDataURL()
        } catch {
          /* 다음 아이콘 경로 또는 원래 .lnk로 재시도한다. */
        }
      }
      return null
    } catch {
      return null
    } finally {
      const next = this.waiters.shift()
      if (next) next()
      else this.running--
    }
  }
}
