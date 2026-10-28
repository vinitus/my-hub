import type { Meta, StoryObj } from "@storybook/react-vite"
import { FileTextIcon, CalendarIcon } from "lucide-react"
import { SidebarProvider } from "@/shared/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
const meta = {
  title: "위젯/사이드바",
  component: AppSidebar,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <SidebarProvider>
        <Story />
      </SidebarProvider>
    ),
  ],
  args: {
    scheduleStatus: <p className="p-3 text-sm">예정된 일정 없음</p>,
    weather: <p>날씨 지역 선택</p>,
    navigationItems: [
      { id: "notes", label: "메모", number: "2", icon: FileTextIcon },
      { id: "calendar", label: "캘린더", number: "3", icon: CalendarIcon },
    ],
    activeView: "notes",
    showNavigationNumbers: false,
    busy: false,
    ready: true,
    library: {
      directory: "C:/Fixtures/Notes",
      notes: [
        {
          name: "회의록.md",
          path: "C:/Fixtures/Notes/회의록.md",
          modifiedAt: 1793142000000,
          favorite: true,
        },
      ],
    },
    onNavigate: () => {},
    onNewNote: () => {},
    onOpenNote: () => {},
    onSelectNote: () => {},
    onToggleNoteFavorite: () => {},
    onOpenSettings: () => {},
    onRefresh: () => {},
  },
} satisfies Meta<typeof AppSidebar>
export default meta
type Story = StoryObj<typeof meta>
export const Populated: Story = {}
export const Empty: Story = {
  args: { library: { directory: "C:/Fixtures/Notes", notes: [] } },
}
export const Loading: Story = { args: { ready: false, library: null } }
export const NavigationHints: Story = { args: { showNavigationNumbers: true } }
