import { stat } from "node:fs/promises"
import { isAbsolute, extname, normalize, basename } from "node:path"
import { randomUUID } from "node:crypto"
import { ShortcutDropSchema } from "../shared/shortcuts"
import { ShortcutSchema, websiteUrl, type Shortcut } from "../shared/shortcuts"

// 저장 시와 실행 직전에 같은 검증을 통과시킨다. 대상은 명령 문자열로 해석하지 않는다.
export async function validateShortcut(value: unknown): Promise<Shortcut> {
  const parsed = ShortcutSchema.safeParse(value)
  if (!parsed.success)
    throw new Error(
      parsed.error.issues[0]?.message ?? "바로가기를 확인해 주세요."
    )
  const item = parsed.data
  if (item.kind === "website")
    return { ...item, target: websiteUrl(item.target) }
  if (!isAbsolute(item.target))
    throw new Error("찾아보기로 선택하거나 절대 경로를 입력해 주세요.")
  const target = normalize(item.target)
  let details
  try {
    details = await stat(target)
  } catch {
    throw new Error(
      "대상을 찾을 수 없습니다. 경로를 확인하거나 다시 선택해 주세요."
    )
  }
  if (item.kind === "folder") {
    if (!details.isDirectory()) throw new Error("폴더를 선택해 주세요.")
  } else if (
    process.platform === "darwin" &&
    extname(target).toLowerCase() === ".app" &&
    details.isDirectory()
  ) {
    // macOS의 앱 번들은 디렉터리다.
  } else if (
    !details.isFile() ||
    ![".exe", ".lnk"].includes(extname(target).toLowerCase())
  ) {
    throw new Error(
      "프로그램 실행 파일(.exe) 또는 Windows 바로가기(.lnk)를 선택해 주세요."
    )
  }
  return { ...item, target }
}

// 드롭은 등록 양식을 채울 뿐 저장하거나 실행하지 않는다.
export async function inspectShortcutDrop(request: unknown): Promise<Shortcut> {
  const parsed = ShortcutDropSchema.safeParse(request)
  if (!parsed.success) throw new Error("드롭한 대상을 확인할 수 없습니다.")
  const { kind, target } = parsed.data
  if (kind === "website") {
    const url = websiteUrl(target)
    return validateShortcut({
      id: randomUUID(),
      kind: "website",
      name: new URL(url).hostname.slice(0, 80),
      target: url,
    })
  }
  if (!isAbsolute(target))
    throw new Error("실제 파일이나 폴더를 끌어 놓아 주세요.")
  let details
  try {
    details = await stat(target)
  } catch {
    throw new Error("드롭한 대상을 찾을 수 없습니다. 다시 끌어 놓아 주세요.")
  }
  const app =
    process.platform === "darwin" && extname(target).toLowerCase() === ".app"
  const type = details.isDirectory() && !app ? "folder" : "program"
  const name =
    type === "folder" ? basename(target) : basename(target, extname(target))
  return validateShortcut({
    id: randomUUID(),
    kind: type,
    name: name.slice(0, 80) || "폴더",
    target,
  })
}
