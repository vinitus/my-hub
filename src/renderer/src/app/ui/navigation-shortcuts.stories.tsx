import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { AppSidebar } from "@/widgets/app-sidebar"
import { SidebarProvider } from "@/shared/ui/sidebar"
import { Input } from "@/shared/ui/input"
import { NAVIGATION_ITEMS, type AppView } from "../config/navigation"
import { useNavigationShortcuts } from "../model/use-navigation-shortcuts"

function NavigationShortcuts() {
  const [view, setView] = useState<AppView>("notes")
  const showNavigationNumbers = useNavigationShortcuts(setView)
  return (
    <SidebarProvider>
      <AppSidebar
        navigationItems={NAVIGATION_ITEMS}
        activeView={view}
        onNavigate={setView}
        showNavigationNumbers={showNavigationNumbers}
        scheduleStatus={null}
        weather={null}
        busy={false}
        ready
        library={null}
        onNewNote={() => {}}
        onOpenNote={() => {}}
        onSelectNote={() => {}}
        onToggleNoteFavorite={() => {}}
        onOpenSettings={() => {}}
        onRefresh={() => {}}
      />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-4">
        <output data-testid="active-workspace">{view}</output>
        <Input aria-label="단축키 테스트 입력" />
      </main>
    </SidebarProvider>
  )
}
const meta = {
  title: "앱/워크스페이스 단축키",
  component: NavigationShortcuts,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NavigationShortcuts>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
