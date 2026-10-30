import { useRef } from "react"
import type { useNote } from "@/features/notes"

export function useScratchpadSave(
  saveText: ReturnType<typeof useNote>["saveText"],
  suggestTitle: ((text: string) => Promise<string>) | undefined,
  scope = "shared"
) {
  // This identity is needed by the next save, but is never rendered. Keep it
  // outside React state; NoteStore still decides whether the file can be reused.
  const previous = useRef<{
    key: string
    markdown: string
    scope: string
  } | null>(null)
  return async (text: string) => {
    if (!suggestTitle)
      throw new Error(
        "AI 제목 생성을 사용하려면 앱을 완전히 종료하고 다시 실행해 주세요."
      )
    const reference =
      previous.current?.scope === scope
        ? { key: previous.current.key, markdown: previous.current.markdown }
        : null
    const name = await suggestTitle(text)
    const result = await saveText(text, reference, name)
    if (result)
      previous.current = { key: result.key, markdown: result.markdown, scope }
    if (!result?.saved)
      throw new Error(
        "메모로 저장하지 못했습니다. 메모 화면의 저장 상태를 확인해 주세요."
      )
    return { name: result.name }
  }
}
