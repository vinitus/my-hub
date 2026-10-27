import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { NoteWorkspace } from "@/features/notes/note-workspace"
import { useNote } from "@/features/notes/use-note"
import { QuickCommand } from "@/features/quick-command/quick-command"
import { SettingsSheet } from "@/features/settings/settings-sheet"
import { readCodexSetupChoice } from "@/features/settings/codex-onboarding"
import { CodexSetupPrompt } from "@/features/settings/codex-setup-prompt"
import { lazy, Suspense, useEffect, useEffectEvent, useState } from "react"
import type { CodexConnection } from "../../shared/codex"
import { NAVIGATION_ITEMS, type AppView } from "@/lib/navigation"
import { useNavigationShortcuts } from "@/hooks/use-navigation-shortcuts"

const CalendarWorkspace = lazy(
  () => import("@/features/calendar/calendar-workspace")
)
const ShortcutWorkspace = lazy(
  () => import("@/features/shortcuts/shortcut-workspace")
)
// shadcn dashboard-01을 바탕으로 만든 앱 레이아웃. 구조 안내: ../README.md
// SidebarProvider의 CSS 변수는 사이드바와 SiteHeader에서 함께 사용한다.
export function App() {
  const [selectedView, setView] = useState<AppView>("notes")
  // 개발 중 Fast Refresh가 제거된 채팅 메뉴의 상태를 유지해도 메모로 돌아간다.
  const view = NAVIGATION_ITEMS.some((item) => item.id === selectedView)
    ? selectedView
    : "notes"
  const [commandOpen, setCommandOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [codexSetup, setCodexSetup] = useState<"intro" | "login" | null>(() => {
    if (!window.api?.codex) return null
    const choice = readCodexSetupChoice()
    return choice === "started" ? "login" : choice === null ? "intro" : null
  })
  const codexPromptOpen = codexSetup !== null && !settingsOpen && !commandOpen
  const finishStartupCheck = useEffectEvent(
    (status: CodexConnection["status"]) => {
      // 조회를 기다리는 동안 사용자가 다른 모달을 열었다면 그 작업을 방해하지 않는다.
      if (
        document.querySelector(
          '[role="dialog"][data-open], [role="alertdialog"][data-open]'
        )
      )
        return
      if (status === "missing" || status === "disconnected")
        setCodexSetup("login")
      else if (status === "error") setCodexSetup("login")
    }
  )
  useEffect(() => {
    const api = window.api?.codex
    if (!api?.check || readCodexSetupChoice() !== "completed") return
    let alive = true
    void api.check().then(
      (state) => {
        if (alive) finishStartupCheck(state.status)
      },
      () => {
        if (alive) finishStartupCheck("error")
      }
    )
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    const openSettings = (event: KeyboardEvent) => {
      if (
        !event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey ||
        event.isComposing ||
        (event.code !== "KeyO" && event.key.toLowerCase() !== "o")
      )
        return
      event.preventDefault()
      if (
        event.repeat ||
        document.querySelector(
          '[role="dialog"][data-open], [role="alertdialog"][data-open]'
        )
      )
        return
      setSettingsOpen(true)
    }
    window.addEventListener("keydown", openSettings, true)
    return () => window.removeEventListener("keydown", openSettings, true)
  }, [])
  const [calendarVisited, setCalendarVisited] = useState(false)
  const [shortcutsVisited, setShortcutsVisited] = useState(false)
  const memo = useNote(
    view === "notes" && !commandOpen && !settingsOpen && !codexPromptOpen
  )
  const navigate = (next: AppView) => {
    if (next === "calendar") setCalendarVisited(true)
    if (next === "shortcuts") setShortcutsVisited(true)
    setView(next)
  }
  const showNavigationNumbers = useNavigationShortcuts(navigate)
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
        showNavigationNumbers={showNavigationNumbers}
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
        onOpenSettings={() => {
          setSettingsOpen(true)
        }}
        onRefresh={() => void memo.refresh()}
      />
      <SidebarInset className="min-h-0 overflow-hidden">
        <SiteHeader
          title={NAVIGATION_ITEMS.find((item) => item.id === view)!.label}
          onQuickCommand={() => setCommandOpen(true)}
        />

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
      <QuickCommand open={commandOpen} onOpenChange={setCommandOpen} />
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        directory={memo.library?.directory}
        ready={memo.ready}
        busy={memo.busy}
        error={memo.error}
        onChooseDirectory={() => void memo.chooseDirectory()}
      />
      {codexSetup !== null && (
        <CodexSetupPrompt
          open={codexPromptOpen}
          initialStep={codexSetup}
          onDismiss={() => setCodexSetup(null)}
        />
      )}
    </SidebarProvider>
  )
}

export default App
