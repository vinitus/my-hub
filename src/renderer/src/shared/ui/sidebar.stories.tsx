import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSkeleton,
  SidebarInset,
  SidebarTrigger,
} from "./sidebar"
const meta = {
  title: "공용 UI/SidebarProvider",
  component: SidebarProvider,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: { className: "min-h-80" },
  render: (args) => (
    <SidebarProvider {...args}>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive>메모</SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuSkeleton showIcon />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger />
        <p>작업 화면</p>
      </SidebarInset>
    </SidebarProvider>
  ),
} satisfies Meta<typeof SidebarProvider>
export default meta
type Story = StoryObj<typeof meta>
export const Expanded: Story = {}
export const Collapsed: Story = { args: { defaultOpen: false } }
