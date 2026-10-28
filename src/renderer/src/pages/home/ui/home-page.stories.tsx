import type { Meta, StoryObj } from "@storybook/react-vite"
import { HomePage } from "./home-page"

const meta = {
  title: "홈/다용도 화면",
  component: HomePage,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="flex h-screen min-h-0 flex-col">
        <Story />
      </div>
    ),
  ],
  args: {
    active: true,
    onSave: async (): Promise<boolean | { name: string }> => true,
    onCreateTodo: () => {},
    onCreateEvent: () => {},
    onCreateShortcut: () => {},
  },
  tags: ["autodocs"],
} satisfies Meta<typeof HomePage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Inactive: Story = { args: { active: false } }
export const SaveError: Story = {
  args: {
    onSave: async () => {
      throw new Error("파일에 접근할 수 없습니다.")
    },
  },
}

export const AiTitle: Story = {
  args: {
    onSave: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return { name: "분기별 회의 준비.md" }
    },
  },
}
export const AiUnavailable: Story = {
  args: {
    onSave: async () => {
      throw new Error("설정에서 ChatGPT 계정을 연결해 주세요.")
    },
  },
}
