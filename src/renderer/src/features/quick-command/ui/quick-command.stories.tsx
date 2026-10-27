import type { CommandResult } from "../model/command-runner"
import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { QuickCommand } from "./quick-command"
// 모든 요청은 스토리의 로컬 응답을 사용하며 IPC나 실제 계정에 접근하지 않는다.
const meta = {
  title: "빠른 입력/요청",
  component: QuickCommand,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: () => {},
    runCommand: async (): Promise<CommandResult> => ({
      status: "success",
      message: "일정 1건 저장 완료",
      changed: ["calendar"],
    }),
  },
  render: function Input(args) {
    const [open, setOpen] = useState(args.open)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          빠른 입력 열기
        </button>
        <QuickCommand {...args} open={open} onOpenChange={setOpen} />
      </>
    )
  },
} satisfies Meta<typeof QuickCommand>
export default meta
type Story = StoryObj<typeof meta>
export const Open: Story = {}

export const NeedsConnection: Story = {
  args: {
    runCommand: async () => ({
      status: "needs-connection",
      message: "설정에서 ChatGPT를 연결해 주세요.",
      changed: [],
    }),
  },
}
export const Clarification: Story = {
  args: {
    runCommand: async () => ({
      status: "clarification",
      message: "할일의 마감일을 알려 주세요.",
      changed: [],
    }),
  },
}
export const Failure: Story = {
  args: {
    runCommand: async () => ({
      status: "error",
      message: "해석 중 목록이 변경되었습니다. 다시 요청해 주세요.",
      changed: [],
    }),
  },
}
export const Partial: Story = {
  args: {
    runCommand: async () => ({
      status: "partial",
      message:
        "1건만 저장했습니다. 나머지 작업은 중단했습니다. 목록을 확인해 주세요.",
      changed: ["todos"],
    }),
  },
}
