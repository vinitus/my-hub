import type { Meta, StoryObj } from "@storybook/react-vite"
import { HomePageView } from "./home-page-view"
import { useState } from "react"

const meta = {
  title: "홈/낙서장 표시 상태",
  component: HomePageView,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="flex h-screen min-h-0 flex-col">
        <Story />
      </div>
    ),
  ],
  args: {
    text: "자유롭게 적은 회의 준비 내용\n- 자료 확인\n- 질문 정리",
    saveState: { status: "idle" },
    onTextChange: () => {},
    onCreateTodo: () => {},
    onCreateEvent: () => {},
    onCreateShortcut: () => {},
    onCreateInbox: () => {},
  },
} satisfies Meta<typeof HomePageView>
export default meta
type Story = StoryObj<typeof meta>
export const Draft: Story = {}
export const Saving: Story = { args: { saveState: { status: "saving" } } }
export const Saved: Story = {
  args: { saveState: { status: "saved", name: "회의 준비.md" } },
}
export const SaveError: Story = {
  args: {
    saveState: { status: "error", message: "파일에 접근할 수 없습니다." },
  },
}
export const RecentInbox: Story = {
  args: {
    recentInboxItems: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "text",
        content: "오래된 수집 항목",
        source: "직접 입력",
        createdAt: "2026-10-20T01:00:00.000Z",
        processedAt: null,
        destination: null,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        kind: "text",
        content: "다음 주 계획",
        source: "홈 빠른 추가",
        createdAt: "2026-10-29T01:00:00.000Z",
        processedAt: null,
        destination: null,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        kind: "text",
        content:
          "아주 긴 이름을 가진 프로젝트 회의에서 정리한 참고 자료와 앞으로 진행할 작업 목록",
        source: "직접 입력",
        createdAt: "2026-10-30T01:00:00.000Z",
        processedAt: "2026-10-30T02:00:00.000Z",
        destination: { kind: "todo", title: "자료 검토" },
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        kind: "text",
        content: "조사 기록",
        source: "직접 입력",
        createdAt: "2026-10-28T01:00:00.000Z",
        processedAt: null,
        destination: null,
      },
    ],
  },
  render: function Recent(args) {
    const [opened, setOpened] = useState("")
    return (
      <>
        <HomePageView {...args} onOpenInbox={setOpened} />
        <output className="sr-only" data-testid="recent-inbox-opened">
          {opened}
        </output>
      </>
    )
  },
}
export const NarrowWorkspace: Story = {
  ...RecentInbox,
  decorators: [
    (Story) => (
      <div className="flex h-screen w-56 min-w-0 flex-col">
        <Story />
      </div>
    ),
  ],
}
