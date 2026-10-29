import type { Meta, StoryObj } from "@storybook/react-vite"
import { SidebarProvider } from "@/shared/ui/sidebar"
import { SiteHeader } from "./site-header"
const meta = {
  title: "위젯/헤더",
  component: SiteHeader,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <SidebarProvider
        className="min-h-20"
        style={{ "--header-height": "48px" } as React.CSSProperties}
      >
        <div className="w-full">
          <Story />
        </div>
      </SidebarProvider>
    ),
  ],
  args: {
    title: "메모",
    onQuickCommand: () => {},
    onAIQuickCommand: () => {},
    onInboxCapture: () => {},
  },
} satisfies Meta<typeof SiteHeader>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}
