import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "./button"
const meta = {
  title: "공용 UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { children: "저장" },
} satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Outline: Story = { args: { variant: "outline" } }
export const Destructive: Story = { args: { variant: "destructive" } }
export const Disabled: Story = { args: { disabled: true } }
export const Small: Story = { args: { size: "sm" } }
