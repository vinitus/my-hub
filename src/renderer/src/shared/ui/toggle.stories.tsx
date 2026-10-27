import type { Meta, StoryObj } from "@storybook/react-vite"
import { Toggle } from "./toggle"
const meta = {
  title: "공용 UI/Toggle",
  component: Toggle,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { children: "굵게", "aria-label": "굵게" },
} satisfies Meta<typeof Toggle>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Pressed: Story = { args: { defaultPressed: true } }
export const Disabled: Story = { args: { disabled: true } }
