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
export const RecentNotes: Story = {
  args: {
    recentNotes: [
      {
        name: "오래된 즐겨찾기.md",
        path: "C:/Notes/old.md",
        modifiedAt: Date.parse("2026-10-20T01:00:00Z"),
        favorite: true,
      },
      {
        name: "다음 주 계획.md",
        path: "C:/Notes/plans.md",
        modifiedAt: Date.parse("2026-10-29T01:00:00Z"),
      },
      {
        name: "아주 긴 이름을 가진 프로젝트 회의에서 정리한 참고 자료와 앞으로 진행할 작업 목록.md",
        path: "C:/Notes/latest.md",
        modifiedAt: Date.parse("2026-10-30T01:00:00Z"),
      },
      {
        name: "조사 기록.md",
        path: "C:/Notes/research.md",
        modifiedAt: Date.parse("2026-10-28T01:00:00Z"),
      },
    ],
  },
  render: function Recent(args) {
    const [opened, setOpened] = useState("")
    return (
      <>
        <HomePageView {...args} onOpenNote={setOpened} />
        <output className="sr-only" data-testid="recent-note-opened">
          {opened}
        </output>
      </>
    )
  },
}
