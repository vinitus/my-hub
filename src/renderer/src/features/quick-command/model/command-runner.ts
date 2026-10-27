export const MAX_COMMAND_LENGTH = 500
export type CommandResult = {
  status: "needs-connection" | "success" | "error"
  message: string
}

// 향후 main/preload의 AI 작업 API를 연결할 지점이다.
// 실제 저장 응답을 받은 뒤에만 success를 반환하며 현재는 파일을 변경하지 않는다.
export async function executeCommand(input: string): Promise<CommandResult> {
  if (!input.trim() || input.length > MAX_COMMAND_LENGTH)
    return { status: "error", message: "요청을 500자 이내로 입력해 주세요." }
  return {
    status: "needs-connection",
    message: "AI 연결이 필요합니다. 일정이나 메모는 아직 변경되지 않았습니다.",
  }
}
