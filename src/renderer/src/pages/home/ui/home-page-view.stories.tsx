import type { Meta, StoryObj } from "@storybook/react-vite"
import { HomePageView } from "./home-page-view"

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
