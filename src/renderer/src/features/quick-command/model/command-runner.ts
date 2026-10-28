import {
  CommandInputSchema,
  CommandResultSchema,
  MAX_COMMAND_LENGTH,
  type CommandResult,
} from "../../../../../shared/command"
export { MAX_COMMAND_LENGTH }
export type { CommandResult }

export async function executeCommand(input: string): Promise<CommandResult> {
  const parsed = CommandInputSchema.safeParse(input)
  if (!parsed.success)
    return {
      status: "error",
      message: "요청을 500자 이내로 입력해 주세요.",
      changed: [],
    }
  if (!window.api?.commands?.execute)
    return {
      status: "needs-connection",
      message: "Electron을 다시 시작하고 설정에서 ChatGPT를 연결해 주세요.",
      changed: [],
    }
  return CommandResultSchema.parse(
    await window.api.commands.execute(parsed.data)
  )
}

export async function applyCommand(token: string): Promise<CommandResult> {
  return CommandResultSchema.parse(await window.api.commands.apply(token))
}
export async function undoCommand(token: string): Promise<CommandResult> {
  return CommandResultSchema.parse(await window.api.commands.undo(token))
}
export async function discardCommand(token: string): Promise<void> {
  await window.api.commands.discard(token)
}
