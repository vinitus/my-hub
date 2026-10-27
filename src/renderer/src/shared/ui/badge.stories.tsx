import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "./badge"
const meta = {
  title: "공용 UI/Badge",
  component: Badge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { children: "연결됨" },
} satisfies Meta<typeof Badge>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Secondary: Story = { args: { variant: "secondary" } }
export const Error: Story = {
  args: { variant: "destructive", children: "실패" },
}
export const Outline: Story = { args: { variant: "outline" } }
