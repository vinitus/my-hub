import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./select"
const meta = {
  title: "공용 UI/Select",
  component: Select,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { defaultValue: "blue", items: { blue: "파랑", green: "초록" } },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger aria-label="색상">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="blue">파랑</SelectItem>
        <SelectItem value="green">초록</SelectItem>
      </SelectContent>
    </Select>
  ),
} satisfies Meta<typeof Select>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
