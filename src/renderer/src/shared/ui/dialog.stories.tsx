import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "./button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog"

const meta = {
  title: "공용 UI/Dialog",
  component: Dialog,
  parameters: { layout: "centered" },
  args: {},
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button />}>등록 열기</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>등록</DialogTitle>
          <DialogDescription>
            홈 화면을 유지하며 새 항목을 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  ),
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>
export const Closed: Story = {}
export const Open: Story = { args: { defaultOpen: true } }
