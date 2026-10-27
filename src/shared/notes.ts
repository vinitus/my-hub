// Renderer는 임의 경로에 쓰지 않고, main이 발급한 파일 ID로만 기존 파일을 저장한다.
export type NoteFile = {
  id: string
  path: string
  name: string
  markdown: string
}

export type SaveNoteRequest = {
  id: string | null
  markdown: string
  saveAs?: boolean
  name?: string
}

export type NotesAPI = {
  open: () => Promise<NoteFile | null>
  save: (request: SaveNoteRequest) => Promise<NoteFile | null>
  rename: (request: { id: string; name: string }) => Promise<NoteFile>
  confirmReplace: () => Promise<"save" | "discard" | "cancel">
  setDirty: (dirty: boolean) => void
  onSaveBeforeClose: (callback: () => void) => () => void
  completeClose: (saved: boolean) => void
}

export const DEFAULT_NOTE_NAME = "제목 없는 메모.md"

// 같은 규칙을 제목 입력, 저장 대화상자, main의 파일명 변경에 사용한다.
export function normalizeNoteName(value: string) {
  const stem = value.trim().replace(/\.md$/i, "")
  if (
    !stem ||
    /[<>:"/\\|?*]/.test(stem) ||
    [...stem].some((char) => char.charCodeAt(0) < 32) ||
    /[. ]$/.test(stem) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem) ||
    new TextEncoder().encode(stem + ".md").length > 240
  )
    throw new Error(
      "사용할 수 없는 파일명입니다. 경로 문자 없이 제목을 입력해 주세요."
    )
  return stem + ".md"
}
