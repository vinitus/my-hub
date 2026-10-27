import type { Meta, StoryObj } from "@storybook/react-vite"
import { Skeleton } from "./skeleton"
const meta = {
  title: "공용 UI/Skeleton",
  component: Skeleton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { className: "h-16 w-64 rounded-xl", "aria-label": "불러오는 중" },
} satisfies Meta<typeof Skeleton>
export default meta
type Story = StoryObj<typeof meta>
export const Loading: Story = {}
