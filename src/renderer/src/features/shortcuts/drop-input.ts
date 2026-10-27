import { websiteUrl } from "../../../../shared/shortcuts"

// DataTransfer는 drop 핸들러 안에서 동기적으로 읽어야 한다. await 뒤에는 비어 있을 수 있다.
export function readShortcutDrop(
  data: Pick<DataTransfer, "files" | "getData">
): { file: File } | { url: string } {
  if (data.files.length > 1)
    throw new Error("한 번에 하나의 항목을 끌어 놓아 주세요.")
  if (data.files.length === 1) return { file: data.files[0] }
  const uriList = data.getData("text/uri-list")
  const lines = uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
  if (lines.length > 1)
    throw new Error("한 번에 하나의 웹사이트 링크를 끌어 놓아 주세요.")
  const value = lines[0] || data.getData("text/plain").trim()
  if (!value)
    throw new Error(
      "프로그램(.exe/.lnk), 폴더 또는 웹사이트 링크를 끌어 놓아 주세요."
    )
  return { url: websiteUrl(value) }
}
