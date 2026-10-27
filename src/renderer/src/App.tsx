import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { NoteWorkspace } from "@/features/notes/note-workspace"
import { useNote } from "@/features/notes/use-note"

// shadcn dashboard-01을 바탕으로 만든 앱 레이아웃. 구조 안내: ../README.md
// SidebarProvider의 CSS 변수는 사이드바와 SiteHeader에서 함께 사용한다.
export function App() {
  const memo = useNote()
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
        onNewNote={() => void memo.newNote()}
        onOpenNote={() => void memo.open()}
        busy={memo.busy}
        library={memo.library}
        ready={memo.ready}
        currentPath={memo.note.file?.path}
        onSelectNote={(name) => void memo.openNote(name)}
        onChooseDirectory={() => void memo.chooseDirectory()}
        onRefresh={() => void memo.refresh()}
      />
      <SidebarInset className="min-h-0 overflow-hidden">
        <SiteHeader />

        {/* 창 전체 대신 메모 본문만 스크롤한다. 상위 flex 요소의 min-h-0도 유지한다. */}
        <NoteWorkspace memo={memo} />
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
