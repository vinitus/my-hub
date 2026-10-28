import { useState, type ComponentProps } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
} from "@/shared/ui/sidebar"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { DEFAULT_APP_SETTINGS } from "../../../../shared/app-settings"
import { WorkspaceLayout } from "./workspace-layout"

function InteractiveLayout(args: ComponentProps<typeof WorkspaceLayout>) {
  const [settings, setSettings] = useState(args.settings)
  const [ready, setReady] = useState(args.ready)
  const [writes, setWrites] = useState(0)
  return (
    <WorkspaceLayout
      {...args}
      settings={settings}
      ready={ready}
      onChange={(patch) => {
        setSettings((current) => ({ ...current, ...patch }))
        setWrites((count) => count + 1)
      }}
      sidebar={
        <Sidebar variant="inset" collapsible="offcanvas">
          <SidebarHeader>탐색</SidebarHeader>
          <SidebarContent className="p-3">
            <Input aria-label="탐색 입력" placeholder="유지되는 입력" />
          </SidebarContent>
        </Sidebar>
      }
      header={
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <span>작업 공간</span>
          {!ready && (
            <Button
              size="sm"
              onClick={() => {
                setSettings({
                  ...DEFAULT_APP_SETTINGS,
                  leftSidebarWidth: 360,
                  rightPanelWidth: 320,
                })
                setReady(true)
              }}
            >
              저장된 레이아웃 불러오기
            </Button>
          )}
        </header>
      }
      statusPanel={
        <aside className="h-full min-w-0 overflow-hidden border-l p-2">
          <Button
            aria-label="현황 접기 전환"
            size="sm"
            onClick={() => {
              setSettings((current) => ({
                ...current,
                rightPanelOpen: !current.rightPanelOpen,
              }))
            }}
          >
            전환
          </Button>
          {settings.rightPanelOpen && <Input aria-label="현황 입력" />}
        </aside>
      }
    >
      <div className="h-full overflow-auto p-3">
        <Input aria-label="본문 입력" />
        <output data-testid="layout-writes">{writes}</output>
        <output data-testid="layout-settings" className="sr-only">
          {JSON.stringify(settings)}
        </output>
      </div>
    </WorkspaceLayout>
  )
}

const meta = {
  title: "앱/작업 공간 레이아웃",
  component: WorkspaceLayout,
  parameters: { layout: "fullscreen" },
  args: {
    settings: DEFAULT_APP_SETTINGS,
    ready: true,
    onChange: () => {},
    sidebar: null,
    header: null,
    statusPanel: null,
    children: null,
  },
  render: (args) => <InteractiveLayout {...args} />,
} satisfies Meta<typeof WorkspaceLayout>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Restored: Story = {
  args: {
    settings: {
      ...DEFAULT_APP_SETTINGS,
      leftSidebarWidth: 360,
      rightPanelWidth: 320,
    },
  },
}
export const Collapsed: Story = {
  args: {
    settings: {
      ...DEFAULT_APP_SETTINGS,
      sidebarOpen: false,
      rightPanelOpen: false,
    },
  },
}
export const Hydration: Story = { args: { ready: false } }
