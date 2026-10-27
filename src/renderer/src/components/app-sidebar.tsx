import type { ComponentProps } from "react"
import {
  FileTextIcon,
  FilePlus2Icon,
  FolderOpenIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type Props = ComponentProps<typeof Sidebar> & {
  onNewNote: () => void
  onOpenNote: () => void
  busy: boolean
}

// 메모의 문서 상태는 App/useNote에서 관리한다. 사이드바는 같은 파일 작업을 호출한다.
export function AppSidebar({ onNewNote, onOpenNote, busy, ...props }: Props) {
  const { theme, setTheme } = useTheme()
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileTextIcon className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">My Hub</p>
            <p className="text-xs text-muted-foreground">
              생각을 기록하는 공간
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>워크스페이스</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive tooltip="메모">
                <FileTextIcon />
                <span>메모</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>파일</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={onNewNote} disabled={busy}>
                <FilePlus2Icon />
                <span>새 메모</span>
                <kbd className="ml-auto text-xs text-muted-foreground">
                  ⌘/Ctrl N
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={onOpenNote} disabled={busy}>
                <FolderOpenIcon />
                <span>Markdown 열기</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              <span>테마 전환</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-2 text-xs leading-relaxed text-muted-foreground">
          메모는 내 컴퓨터의 .md 파일로 저장합니다.
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
