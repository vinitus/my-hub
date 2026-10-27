import { access, stat } from "node:fs/promises"
import { constants } from "node:fs"
import { createRequire } from "node:module"
import { homedir } from "node:os"
import { delimiter, dirname, join, isAbsolute } from "node:path"

async function executable(path: string) {
  try {
    await access(path, constants.X_OK)
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

// npm의 .cmd/.ps1을 셸로 실행하지 않고 설치된 네이티브 바이너리를 찾는다.
export async function findCodexExecutable(
  directories = [
    ...(process.env.PATH ?? "").split(delimiter),
    ...(process.platform === "win32"
      ? [
          process.env.APPDATA ? join(process.env.APPDATA, "npm") : "",
          process.env.LOCALAPPDATA
            ? join(process.env.LOCALAPPDATA, "Programs/OpenAI/Codex/bin")
            : "",
        ]
      : ["/usr/local/bin", "/opt/homebrew/bin"]),
    join(homedir(), ".local/bin"),
  ],
  platform = process.platform,
  arch = process.arch
): Promise<string | null> {
  for (const directory of new Set(
    directories.map((item) => item.replace(/^"|"$/g, ""))
  )) {
    if (!isAbsolute(directory)) continue
    const direct = join(directory, platform === "win32" ? "codex.exe" : "codex")
    if (await executable(direct)) return direct
    if (platform !== "win32" || !["x64", "arm64"].includes(arch)) continue
    const root = join(directory, "node_modules/@openai/codex")
    let vendor = join(root, "vendor")
    try {
      vendor = join(
        dirname(
          createRequire(join(root, "package.json")).resolve(
            `@openai/codex-win32-${arch}/package.json`
          )
        ),
        "vendor"
      )
    } catch {
      /* 이전 npm 패키지는 자체 vendor 디렉터리에 바이너리를 포함한다. */
    }
    const target =
      arch === "arm64" ? "aarch64-pc-windows-msvc" : "x86_64-pc-windows-msvc"
    for (const folder of ["bin", "codex"]) {
      const candidate = join(vendor, target, folder, "codex.exe")
      if (await executable(candidate)) return candidate
    }
  }
  return null
}
