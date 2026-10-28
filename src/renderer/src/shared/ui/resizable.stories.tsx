import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./resizable"

const meta = {
  title: "공용 UI/Resizable",
  component: ResizablePanelGroup,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof ResizablePanelGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => (
    <div className="h-64 w-full max-w-3xl rounded-md border">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={35} minSize={20}>
          <div className="flex h-full items-center justify-center p-6">
            왼쪽 패널
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={65} minSize={20}>
          <div className="flex h-full items-center justify-center p-6">
            오른쪽 패널
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
}
