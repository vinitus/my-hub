import { useState, type ComponentProps } from "react"
import {
  FileTextIcon,
  FilePlus2Icon,
  FolderOpenIcon,
  MoonIcon,
  SunIcon,
  FolderCogIcon,
  RefreshCwIcon,
  CalendarDaysIcon,
  MessageSquareIcon,
} from "lucide-react"
import type { NoteLibrarySnapshot } from "../../../shared/notes"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
  library: NoteLibrarySnapshot | null
  ready: boolean
  currentPath?: string
  onSelectNote: (name: string) => void
  onChooseDirectory: () => void
  onRefresh: () => void
  activeView: "chat" | "notes" | "calendar"
  onNavigate: (view: "chat" | "notes" | "calendar") => void
}

// 메모의 문서 상태는 App/useNote에서 관리한다. 사이드바는 같은 파일 작업을 호출한다.
export function AppSidebar({
  onNewNote,
  onOpenNote,
  busy,
  library,
  ready,
  currentPath,
  onSelectNote,
  onChooseDirectory,
  onRefresh,
  activeView,
  onNavigate,
  ...props
}: Props) {
  const { theme, setTheme } = useTheme()
  const [query, setQuery] = useState("")
  const notes =
    library?.notes.filter((note) =>
      note.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    ) ?? []
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
              <SidebarMenuButton
                isActive={activeView === "chat"}
                tooltip="채팅"
                onClick={() => onNavigate("chat")}
              >
                <MessageSquareIcon />
                <span>채팅</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={activeView === "notes"}
                tooltip="메모"
                onClick={() => onNavigate("notes")}
              >
                <FileTextIcon />
                <span>메모</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={activeView === "calendar"}
                tooltip="캘린더"
                onClick={() => onNavigate("calendar")}
              >
                <CalendarDaysIcon />
                <span>캘린더</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
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
          {activeView === "notes" && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={onChooseDirectory}
                disabled={busy}
                title={library?.directory ?? "메모 폴더 선택"}
              >
                <FolderCogIcon />
                <span>메모 폴더 변경</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              <span>테마 전환</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p
          className="truncate px-2 text-xs leading-relaxed text-muted-foreground"
          title={activeView === "notes" ? library?.directory : undefined}
        >
          {activeView === "notes"
            ? (library?.directory ?? "로컬 Markdown 메모")
            : activeView === "chat"
              ? "대화는 이 기기에 저장됩니다."
              : "일정은 이 기기에 저장됩니다."}
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
