import { useState, type ComponentProps, type CSSProperties } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { SiteHeader } from "@/widgets/site-header"
import { SidebarProvider } from "@/shared/ui/sidebar"
import { ItemModeControl } from "./item-mode-control"

function Preview(args: ComponentProps<typeof ItemModeControl>) {
  const [personal, setPersonal] = useState(args.personal)
  const [action, setAction] = useState("")
  return (
    <SidebarProvider
      style={{ "--header-height": "48px" } as CSSProperties}
      className="min-h-0"
    >
      <div className="w-full min-w-0 rounded-xl border bg-background">
        <SiteHeader
          title="홈"
          onQuickCommand={() => setAction("search")}
          onAIQuickCommand={() => setAction("ai")}
          onInboxCapture={() => setAction("inbox")}
          modeControl={
            args.enabled && personal ? (
              <ItemModeControl
                {...args}
                personal={personal}
                onToggle={() => {
                  setPersonal(!personal)
                  setAction("toggle")
                }}
              />
            ) : undefined
          }
        />
        <div className="space-y-2 p-4 text-sm text-muted-foreground">
          <p>개인 모드일 때 상단에 보라색 표시가 나타납니다.</p>
          <output data-testid="mode-header-action">{action}</output>
        </div>
      </div>
    </SidebarProvider>
  )
}
const meta = {
  title: "앱/개인 모드 표시",
  component: ItemModeControl,
  parameters: { layout: "fullscreen" },
  render: (args) => <Preview {...args} />,
  args: {
    enabled: true,
    personal: false,
    shortcut: "ctrl+shift+m",
    onToggle: () => {},
  },
} satisfies Meta<typeof ItemModeControl>
export default meta
type Story = StoryObj<typeof meta>
export const Work: Story = {}
export const Personal: Story = { args: { personal: true } }
export const Off: Story = { args: { enabled: false } }
export const Switching: Story = { args: { pending: true, personal: true } }
export const Narrow: Story = {
  args: { personal: true },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
}
export const MinimumWidth: Story = {
  args: { personal: true },
  decorators: [
    (Story) => (
      <div className="w-52 max-w-full">
        <Story />
      </div>
    ),
  ],
}
