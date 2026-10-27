import type { Meta, StoryObj } from "@storybook/react-vite"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
const meta = {
  title: "공용 UI/Avatar",
  component: Avatar,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {},
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>MH</AvatarFallback>
    </Avatar>
  ),
} satisfies Meta<typeof Avatar>
export default meta
type Story = StoryObj<typeof meta>
export const Fallback: Story = {}
export const Image: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage
        alt="예시 사용자"
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%236366f1'/%3E%3C/svg%3E"
      />
      <AvatarFallback>MH</AvatarFallback>
    </Avatar>
  ),
}
