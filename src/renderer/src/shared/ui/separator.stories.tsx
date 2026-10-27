import type { Meta, StoryObj } from "@storybook/react-vite"
import { Separator } from "./separator"
const meta = {
  title: "공용 UI/Separator",
  component: Separator,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { className: "w-64" },
} satisfies Meta<typeof Separator>
export default meta
type Story = StoryObj<typeof meta>
export const Horizontal: Story = {}
export const Vertical: Story = {
  args: { orientation: "vertical", className: "h-16" },
}
