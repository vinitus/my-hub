import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "./tooltip"
import { Button } from "./button"
const meta = {
  title: "공용 UI/Tooltip",
  component: Tooltip,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {},
  render: (args) => (
    <TooltipProvider>
      <Tooltip {...args}>
        <TooltipTrigger render={<Button variant="outline" />}>
          도움말
        </TooltipTrigger>
        <TooltipContent>Ctrl+K로 빠른 입력을 엽니다.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
} satisfies Meta<typeof Tooltip>
export default meta
type Story = StoryObj<typeof meta>
export const OnHover: Story = {}
export const Open: Story = { args: { open: true } }
