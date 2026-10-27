import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { QuickCommand } from "./quick-command"
// executeCommand currently returns an in-memory connection notice and performs no IPC.
const meta = {
  title: "빠른 입력/요청",
  component: QuickCommand,
  parameters: { layout: "fullscreen" },
  args: { open: true, onOpenChange: () => {} },
  render: function Input(args) {
    const [open, setOpen] = useState(args.open)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          빠른 입력 열기
        </button>
        <QuickCommand {...args} open={open} onOpenChange={setOpen} />
      </>
    )
  },
} satisfies Meta<typeof QuickCommand>
export default meta
type Story = StoryObj<typeof meta>
export const Open: Story = {}
