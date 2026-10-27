import type { Meta, StoryObj } from "@storybook/react-vite"
import { Label } from "./label"
import { Input } from "./input"
const meta = {
  title: "공용 UI/Label",
  component: Label,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { children: "이름", htmlFor: "label-name" },
  render: (args) => (
    <div className="grid gap-2">
      <Label {...args} />
      <Input id="label-name" />
    </div>
  ),
} satisfies Meta<typeof Label>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
