import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { QuickCommand } from "./action-launcher"
import { AIQuickCommand } from "./ai-quick-command"
import type { LauncherAction } from "../model/action-search"
const localActions: LauncherAction[] = [
  {
    id: "note:C:/메모/팀 회의.md",
    kind: "note",
    title: "팀 회의 메모",
    description: "즐겨찾는 메모",
    label: "열기",
    execute: () => "메모를 열었습니다.",
  },
  {
    id: "event:meeting",
    kind: "event",
    title: "팀 회의",
    description: "2026. 10. 30. 오후 3:00",
    label: "열기",
    execute: () => "일정을 열었습니다.",
  },
  {
    id: "todo:report",
    kind: "todo",
    title: "보고서 작성",
    description: "미완료 · 마감 2026-10-30",
    label: "완료",
    execute: () => "보고서 작성 완료",
  },
  {
    id: "shortcut:code",
    kind: "shortcut",
    title: "VS Code",
    description: "등록된 프로그램",
    label: "실행",
    execute: () => "VS Code 열기 요청을 보냈습니다.",
  },
  {
    id: "command:settings",
    kind: "command",
    title: "설정",
    description: "앱 설정과 AI 연결",
    label: "열기",
    execute: () => "설정을 열었습니다.",
  },
]
const meta = {
  title: "통합 액션 런처/검색과 실행",
  component: QuickCommand,
  parameters: { layout: "fullscreen" },
  args: { open: true, onOpenChange: () => {}, actions: localActions },
  render: function Input(args) {
    const [open, setOpen] = useState(args.open)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          통합 검색 열기
        </button>
        <QuickCommand {...args} open={open} onOpenChange={setOpen} />
      </>
    )
  },
} satisfies Meta<typeof QuickCommand>
export default meta
type Story = StoryObj<typeof meta>
export const Open: Story = {}
export const LocalActions: Story = {}
export const Empty: Story = { args: { actions: [] } }
export const Loading: Story = { args: { actions: [], loading: true } }
export const UnavailableSource: Story = {
  args: { error: "일정 목록에 접근할 수 없습니다." },
}
export const AlternateShortcut: Story = {
  args: { shortcut: "ctrl+alt+k", open: false },
}
export const ShortcutSeparation: Story = {
  render: function Separate(args) {
    const [open, setOpen] = useState(false)
    const [aiOpen, setAIOpen] = useState(false)
    return (
      <>
        <p>Ctrl+K 통합 검색 · Ctrl+Shift+K AI 빠른 입력</p>
        <QuickCommand {...args} open={open} onOpenChange={setOpen} />
        <AIQuickCommand
          open={aiOpen}
          onOpenChange={setAIOpen}
          runCommand={async () => ({
            status: "success",
            message: "AI 요청 완료",
            changed: [],
          })}
          apply={async () => ({
            status: "success",
            message: "적용 완료",
            changed: [],
          })}
          undo={async () => ({
            status: "success",
            message: "취소 완료",
            changed: [],
          })}
          discard={async () => {}}
        />
      </>
    )
  },
}
