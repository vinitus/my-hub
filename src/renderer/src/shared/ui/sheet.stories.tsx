import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./sheet"
import { Button } from "./button"
const meta = {
  title: "공용 UI/Sheet",
  component: Sheet,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {},
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger render={<Button />}>설정 열기</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>설정</SheetTitle>
          <SheetDescription>앱 표시를 설정합니다.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
} satisfies Meta<typeof Sheet>
export default meta
type Story = StoryObj<typeof meta>
export const Closed: Story = {}
export const Open: Story = { args: { defaultOpen: true } }
