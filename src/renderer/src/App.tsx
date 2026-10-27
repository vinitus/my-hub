import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { NoteWorkspace } from "@/features/notes/note-workspace"
import { useNote } from "@/features/notes/use-note"
import { ChatWorkspace } from "@/features/chat/chat-workspace"
import { lazy, Suspense, useState } from "react"

const CalendarWorkspace = lazy(
  () => import("@/features/calendar/calendar-workspace")
)
const ShortcutWorkspace = lazy(
  () => import("@/features/shortcuts/shortcut-workspace")
)
type View = "chat" | "notes" | "calendar" | "shortcuts"
const viewTitles: Record<View, string> = {
  chat: "채팅",
  notes: "메모",
  calendar: "캘린더",
  shortcuts: "바로가기",
}

// shadcn dashboard-01을 바탕으로 만든 앱 레이아웃. 구조 안내: ../README.md
// SidebarProvider의 CSS 변수는 사이드바와 SiteHeader에서 함께 사용한다.
export function App() {
  const [view, setView] = useState<View>("chat")
  const [calendarVisited, setCalendarVisited] = useState(false)
  const [shortcutsVisited, setShortcutsVisited] = useState(false)
  const memo = useNote(view === "notes")
  const navigate = (next: View) => {
    if (next === "calendar") setCalendarVisited(true)
    if (next === "shortcuts") setShortcutsVisited(true)
    setView(next)
  }
  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        activeView={view}
        onNavigate={navigate}
        onNewNote={() => {
          navigate("notes")
          void memo.newNote()
        }}
        onOpenNote={() => {
          navigate("notes")
          void memo.open()
        }}
        busy={memo.busy}
        library={memo.library}
        ready={memo.ready}
        currentPath={memo.note.file?.path}
        onSelectNote={(name) => {
          navigate("notes")
          void memo.openNote(name)
        }}
        onChooseDirectory={() => void memo.chooseDirectory()}
        onRefresh={() => void memo.refresh()}
      />
      <SidebarInset className="min-h-0 overflow-hidden">
        <SiteHeader title={viewTitles[view]} />

        <div
          className={
            view === "chat" ? "flex min-h-0 flex-1 flex-col" : "hidden"
          }
        >
          <ChatWorkspace active={view === "chat"} />
        </div>

        {/* 창 전체 대신 메모 본문만 스크롤한다. 상위 flex 요소의 min-h-0도 유지한다. */}
        <div
          className={
            view === "notes" ? "flex min-h-0 flex-1 flex-col" : "hidden"
          }
        >
          <NoteWorkspace memo={memo} />
        </div>
        {shortcutsVisited && (
          <div
            className={
              view === "shortcuts" ? "flex min-h-0 flex-1 flex-col" : "hidden"
            }
          >
            <Suspense
              fallback={
                <p role="status" className="p-6 text-sm text-muted-foreground">
                  바로가기를 불러오는 중…
                </p>
              }
            >
              <ShortcutWorkspace active={view === "shortcuts"} />
            </Suspense>
          </div>
        )}
        {calendarVisited && (
          <div
            className={
              view === "calendar" ? "flex min-h-0 flex-1 flex-col" : "hidden"
            }
          >
            <Suspense
              fallback={
                <p role="status" className="p-6 text-sm text-muted-foreground">
                  캘린더를 불러오는 중…
                </p>
              }
            >
              <CalendarWorkspace />
            </Suspense>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
