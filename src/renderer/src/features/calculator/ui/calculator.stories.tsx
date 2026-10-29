import type { Meta, StoryObj } from "@storybook/react-vite"
import { Calculator } from "./calculator"

const meta = {
  title: "계산기/Calculator",
  component: Calculator,
} satisfies Meta<typeof Calculator>
export default meta
type Story = StoryObj<typeof meta>
export const Collapsible: Story = {}
export const Standalone: Story = { args: { collapsible: false } }
