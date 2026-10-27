import type { Meta, StoryObj } from "@storybook/react-vite"
import { Checkbox } from "./checkbox"
const meta = {
  title: "공용 UI/Checkbox",
  component: Checkbox,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { "aria-label": "OS 알림" },
} satisfies Meta<typeof Checkbox>
export default meta
type Story = StoryObj<typeof meta>
export const Unchecked: Story = {}
export const Checked: Story = { args: { defaultChecked: true } }
export const Indeterminate: Story = { args: { indeterminate: true } }
export const Disabled: Story = { args: { disabled: true } }
