import type { Meta, StoryObj } from "@storybook/react-vite"
import { Input } from "./input"
const meta = {
  title: "공용 UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { "aria-label": "제목", placeholder: "제목을 입력하세요" },
} satisfies Meta<typeof Input>
export default meta
type Story = StoryObj<typeof meta>
export const Empty: Story = {}
export const Filled: Story = { args: { defaultValue: "팀 회의" } }
export const Disabled: Story = { args: { disabled: true } }
export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "잘못된 입력" },
}
