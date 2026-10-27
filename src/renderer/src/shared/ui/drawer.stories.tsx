import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "./drawer"
import { Button } from "./button"
const meta = {
  title: "공용 UI/Drawer",
  component: Drawer,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {},
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger render={<Button />}>상세 보기</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>일정 상세</DrawerTitle>
          <DrawerDescription>오전 9시 팀 회의</DrawerDescription>
        </DrawerHeader>
      </DrawerContent>
    </Drawer>
  ),
} satisfies Meta<typeof Drawer>
export default meta
type Story = StoryObj<typeof meta>
export const Closed: Story = {}
export const Open: Story = { args: { defaultOpen: true } }
