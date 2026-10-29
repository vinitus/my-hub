import type { CommandResult } from "../model/command-runner"
import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { AIQuickCommand } from "./ai-quick-command"
// 모든 요청은 스토리의 로컬 응답을 사용하며 IPC나 실제 계정에 접근하지 않는다.
const commandCallbacks = {
  apply: async (): Promise<CommandResult> => ({
    status: "success",
    message: "2건 저장 완료",
    changed: ["calendar", "todos"],
    undoToken: "00000000-0000-4000-8000-000000000002",
  }),
  undo: async (): Promise<CommandResult> => ({
    status: "success",
    message: "2건 실행 취소 완료",
    changed: ["calendar", "todos"],
  }),
  discard: async () => {},
  runCommand: async (): Promise<CommandResult> => ({
    status: "success",
    message: "일정 1건 저장 완료",
    changed: ["calendar"],
  }),
}

const meta = {
  title: "AI 빠른 입력/요청",
  component: AIQuickCommand,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: () => {},
    ...commandCallbacks,
  },
  render: function Input(args) {
    const [open, setOpen] = useState(args.open)
    const [calls, setCalls] = useState({
      run: 0,
      apply: 0,
      undo: 0,
      discard: 0,
    })
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          빠른 입력 열기
        </button>
        <AIQuickCommand
          {...args}
          open={open}
          onOpenChange={setOpen}
          runCommand={async (input) => {
            setCalls((current) => ({ ...current, run: current.run + 1 }))
            return (args.runCommand ?? commandCallbacks.runCommand)(input)
          }}
          apply={async (token) => {
            setCalls((current) => ({ ...current, apply: current.apply + 1 }))
            return (args.apply ?? commandCallbacks.apply)(token)
          }}
          undo={async (token) => {
            setCalls((current) => ({ ...current, undo: current.undo + 1 }))
            return (args.undo ?? commandCallbacks.undo)(token)
          }}
          discard={async (token) => {
            setCalls((current) => ({
              ...current,
              discard: current.discard + 1,
            }))
            return (args.discard ?? commandCallbacks.discard)(token)
          }}
        />
        <output className="sr-only" data-testid="command-task-calls">
          {JSON.stringify(calls)}
        </output>
      </>
    )
  },
} satisfies Meta<typeof AIQuickCommand>
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

const preview: CommandResult = {
  status: "preview",
  message: "회의 시간을 변경하고 보고서 할일을 삭제합니다.",
  changed: [],
  preview: {
    token: "00000000-0000-4000-8000-000000000001",
    changes: [
      {
        id: "00000000-0000-4000-8000-000000000003",
        domain: "calendar",
        operation: "update",
        before:
          "팀 회의\n2026-10-29T15:00:00+09:00 → 2026-10-29T16:00:00+09:00",
        after: "팀 회의\n2026-10-29T16:00:00+09:00 → 2026-10-29T17:00:00+09:00",
      },
      {
        id: "00000000-0000-4000-8000-000000000004",
        domain: "todos",
        operation: "remove",
        before: "보고서 작성\n마감: 2026-10-30 · 미완료",
        after: null,
      },
    ],
  },
}
export const Preview: Story = { args: { runCommand: async () => preview } }
export const Discard: Story = { args: { runCommand: async () => preview } }
export const Undo: Story = {
  args: {
    runCommand: async () => ({
      status: "success",
      message: "2건 저장 완료",
      changed: ["calendar", "todos"],
      undoToken: "00000000-0000-4000-8000-000000000002",
    }),
  },
}
export const ApplyConflict: Story = {
  args: {
    runCommand: async () => preview,
    apply: async () => ({
      status: "error",
      message:
        "목록이 변경되었습니다. 최신 목록을 확인하고 다시 요청해 주세요.",
      changed: [],
    }),
  },
}
export const PartialUndo: Story = {
  args: {
    runCommand: async () => ({
      status: "partial",
      message: "1건만 저장했습니다.",
      changed: ["todos"],
      undoToken: "00000000-0000-4000-8000-000000000002",
    }),
    undo: async () => ({
      status: "success",
      message: "1건 실행 취소 완료",
      changed: ["todos"],
    }),
  },
}

export const Pending: Story = {
  args: { runCommand: () => new Promise<CommandResult>(() => {}) },
}
export const ThrownRequest: Story = {
  args: {
    runCommand: async () => {
      throw new Error("요청 예외 fixture")
    },
  },
}
export const ThrownApply: Story = {
  args: {
    runCommand: async () => preview,
    apply: async () => {
      throw new Error("적용 예외 fixture")
    },
  },
}
export const ThrownDiscard: Story = {
  args: {
    runCommand: async () => preview,
    discard: async () => {
      throw new Error("폐기 예외 fixture")
    },
  },
}
export const ThrownUndo: Story = {
  args: {
    runCommand: meta.args.apply,
    undo: async () => {
      throw new Error("복원 예외 fixture")
    },
  },
}
