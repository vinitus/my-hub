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
    onSave: async () => true,
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
