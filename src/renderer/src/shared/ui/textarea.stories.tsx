import type { Meta, StoryObj } from "@storybook/react-vite"
import { Textarea } from "./textarea"

const meta = {
  title: "공용 UI/Textarea",
  component: Textarea,
  args: { "aria-label": "작성 내용" },
  decorators: [
    (Story) => (
      <div className="w-full max-w-md p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithContent: Story = {
  args: { defaultValue: "첫 번째 줄\n두 번째 줄" },
}
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "저장 중인 내용" },
}
