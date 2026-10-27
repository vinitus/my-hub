import { useState, type ComponentProps, type ComponentType, type ReactNode } from "react"
import {
  FileTextIcon,
  FilePlus2Icon,
  FolderOpenIcon,
  SettingsIcon,
  RefreshCwIcon,
} from "lucide-react"
import type { NoteLibrarySnapshot } from "../../../../../shared/notes"
import { Input } from "@/shared/ui/input"
import { Button } from "@/shared/ui/button"
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
} from "@/shared/ui/sidebar"

type Props<View extends string> = ComponentProps<typeof Sidebar> & {
  scheduleStatus: ReactNode
  weather: ReactNode
  navigationItems: readonly {
    id: View
    label: string
    number: string
    icon: ComponentType<{ className?: string }>
  }[]
  onNewNote: () => void
  onOpenNote: () => void
  busy: boolean
  library: NoteLibrarySnapshot | null
  ready: boolean
  currentPath?: string
  onSelectNote: (name: string) => void
  onOpenSettings: () => void
  onRefresh: () => void
  activeView: View
  onNavigate: (view: View) => void
  showNavigationNumbers: boolean
}

// 메모의 문서 상태는 App/useNote에서 관리한다. 사이드바는 같은 파일 작업을 호출한다.
export function AppSidebar<View extends string>({
  scheduleStatus,
  weather,
  navigationItems,
  onNewNote,
  onOpenNote,
  busy,
  library,
  ready,
  currentPath,
  onSelectNote,
  onOpenSettings,
  onRefresh,
  activeView,
  onNavigate,
  showNavigationNumbers,
  ...props
}: Props<View>) {
  const [query, setQuery] = useState("")
  const notes =
    library?.notes.filter((note) =>
      note.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    ) ?? []
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="px-2 pt-2 pb-0">
        {scheduleStatus}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>워크스페이스</SidebarGroupLabel>
          <SidebarMenu>
            {navigationItems.map(({ id, label, number, icon: Icon }) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  isActive={activeView === id}
                  tooltip={`${label} (Ctrl+${number})`}
                  aria-keyshortcuts={`Control+${number}`}
                  onClick={() => onNavigate(id)}
                >
                  <Icon />
                  <span>{label}</span>
                  <kbd
                    aria-hidden="true"
                    className={`ml-auto flex size-5 shrink-0 items-center justify-center rounded border border-sidebar-foreground/20 bg-sidebar font-mono text-[11px] text-sidebar-foreground/70 ${showNavigationNumbers ? "visible" : "invisible"}`}
                  >
                    {number}
                  </kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        {activeView === "notes" && (
          <>
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
            <SidebarGroup>
              <div className="flex items-center justify-between pr-1">
                <SidebarGroupLabel>
                  저장된 메모 {library ? `(${library.notes.length})` : ""}
                </SidebarGroupLabel>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="메모 목록 새로고침"
                  title="메모 목록 새로고침"
                  disabled={busy}
                  onClick={onRefresh}
                >
                  <RefreshCwIcon />
                </Button>
              </div>
              <Input
                aria-label="메모 검색"
                placeholder="메모 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="mb-2 h-8"
              />
              <SidebarMenu>
                {notes.map((note) => (
                  <SidebarMenuItem key={note.path}>
                    <SidebarMenuButton
                      title={`${note.name}\n${new Date(note.modifiedAt).toLocaleString()}`}
                      isActive={note.path === currentPath}
                      disabled={busy}
                      onClick={() => onSelectNote(note.name)}
                    >
                      <FileTextIcon />
                      <span>{note.name.replace(/\.md$/i, "")}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
              {!notes.length && (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  {!ready
                    ? "메모를 불러오는 중…"
                    : query
                      ? "검색 결과가 없습니다."
                      : library
                        ? "아직 저장된 메모가 없습니다."
                        : "저장 폴더를 선택해 주세요."}
                </p>
              )}
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter className="gap-3 p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onOpenSettings}
              tooltip="설정 (Ctrl+O)"
              aria-keyshortcuts="Control+o"
            >
              <SettingsIcon />
              <span>설정</span>
              <kbd className="ml-auto text-xs text-muted-foreground">
                Ctrl O
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p
          className="truncate px-2 text-xs leading-relaxed text-muted-foreground"
          title={activeView === "notes" ? library?.directory : undefined}
        >
          {activeView === "notes"
            ? (library?.directory ?? "로컬 Markdown 메모")
            : activeView === "shortcuts"
              ? "프로그램 · 폴더 · 웹사이트"
              : "일정은 이 기기에 저장됩니다."}
        </p>
        {weather}
      </SidebarFooter>
    </Sidebar>
  )
}
