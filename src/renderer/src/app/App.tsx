import { TodoStore } from "@/features/todos"
import { AppSidebar } from "@/widgets/app-sidebar"
import { SiteHeader } from "@/widgets/site-header"
import { LiveScheduleStatus, LiveStatusPanel } from "@/widgets/live-status"
import { ShortcutStore } from "@/features/shortcuts"
import { WeatherWidget } from "@/features/weather"
import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar"
import { NotesPage } from "@/pages/notes"
import { CalendarReminderCenter } from "@/features/calendar"
import { CalendarStore } from "@/entities/calendar-event"
import { useNote } from "@/features/notes"
import { QuickCommand } from "@/features/quick-command"
import {
  SettingsSheet,
  readCodexSetupChoice,
  CodexSetupPrompt,
} from "@/features/settings"
import {
  lazy,
  Suspense,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react"
import type { CodexConnection } from "../../../shared/codex"
import { NAVIGATION_ITEMS, type AppView } from "@/app/config/navigation"
import { useNavigationShortcuts } from "@/app/model/use-navigation-shortcuts"
import { useAppSettings } from "./providers/app-settings-provider"
import { usePanelRef } from "react-resizable-panels"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/ui/resizable"

const TodoWorkspace = lazy(() => import("@/pages/todos"))
const CalendarWorkspace = lazy(() => import("@/pages/calendar"))
const ShortcutWorkspace = lazy(() => import("@/pages/shortcuts"))
// shadcn dashboard-01을 바탕으로 만든 앱 레이아웃. 구조 안내: ../../README.md
// SidebarProvider의 CSS 변수는 사이드바와 SiteHeader에서 함께 사용한다.
export function App() {
  const {
    settings,
    ready: settingsReady,
    updateSettings,
    error: settingsError,
  } = useAppSettings()
  const leftPanelRef = usePanelRef()
  const rightPanelRef = usePanelRef()
  const sidebarProviderRef = useRef<HTMLDivElement>(null)
  const [selectedView, setView] = useState<AppView>("notes")
  // 개발 중 Fast Refresh가 제거된 채팅 메뉴의 상태를 유지해도 메모로 돌아간다.
  const view = NAVIGATION_ITEMS.some((item) => item.id === selectedView)
    ? selectedView
    : "notes"
  const [commandOpen, setCommandOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [todoStore] = useState(() => new TodoStore(window.api?.todos))
  const [calendarStore] = useState(
    () => new CalendarStore(window.api?.calendar)
  )
  const [shortcutStore] = useState(
    () => new ShortcutStore(window.api?.shortcuts)
  )
  useEffect(
    () =>
      window.api?.commands?.onChange((domains) => {
        if (domains.includes("calendar")) void calendarStore.refresh()
        if (domains.includes("todos")) void todoStore.refresh()
      }),
    [calendarStore, todoStore]
  )
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
  const [todosVisited, setTodosVisited] = useState(false)
  const [calendarVisited, setCalendarVisited] = useState(false)
  const [shortcutsVisited, setShortcutsVisited] = useState(false)
  useEffect(() => {
    if (!settingsReady) return
    if (settings.sidebarOpen)
      leftPanelRef.current?.resize(settings.leftSidebarWidth)
    else leftPanelRef.current?.collapse()
  }, [
    settingsReady,
    settings.sidebarOpen,
    settings.leftSidebarWidth,
    leftPanelRef,
  ])
  useEffect(() => {
    if (!settingsReady) return
    if (settings.rightPanelOpen)
      rightPanelRef.current?.resize(settings.rightPanelWidth)
    else rightPanelRef.current?.collapse()
  }, [
    settingsReady,
    settings.rightPanelOpen,
    settings.rightPanelWidth,
    rightPanelRef,
  ])
  const memo = useNote(
    view === "notes" && !commandOpen && !settingsOpen && !codexPromptOpen
  )
  const navigate = (next: AppView) => {
    if (next === "todos") setTodosVisited(true)
    if (next === "calendar") setCalendarVisited(true)
    if (next === "shortcuts") setShortcutsVisited(true)
    setView(next)
  }
  const showNavigationNumbers = useNavigationShortcuts(navigate)
  const saveLeftPanelLayout = () => {
    const panel = leftPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) {
      if (settings.sidebarOpen) void updateSettings({ sidebarOpen: false })
      return
    }
    const leftSidebarWidth = Math.min(
      640,
      Math.max(200, Math.round(panel.getSize().inPixels))
    )
    sidebarProviderRef.current?.style.setProperty(
      "--sidebar-width",
      `${leftSidebarWidth}px`
    )
    if (!settings.sidebarOpen || settings.leftSidebarWidth !== leftSidebarWidth)
      void updateSettings({ sidebarOpen: true, leftSidebarWidth })
  }
  const saveRightPanelLayout = () => {
    const panel = rightPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) {
      if (settings.rightPanelOpen)
        void updateSettings({ rightPanelOpen: false })
      return
    }
    const rightPanelWidth = Math.min(
      480,
      Math.max(200, Math.round(panel.getSize().inPixels))
    )
    if (
      !settings.rightPanelOpen ||
      settings.rightPanelWidth !== rightPanelWidth
    )
      void updateSettings({ rightPanelOpen: true, rightPanelWidth })
  }
  return (
    <SidebarProvider
      ref={sidebarProviderRef}
      className="h-svh overflow-hidden"
      open={settings.sidebarOpen}
      onOpenChange={(sidebarOpen) => void updateSettings({ sidebarOpen })}
      style={
        {
          "--sidebar-width": `${settings.leftSidebarWidth}px`,
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <ResizablePanelGroup
        orientation="horizontal"
        className="app-sidebar-resizable-layout min-h-0 flex-1"
        onLayoutChanged={saveLeftPanelLayout}
      >
        <ResizablePanel
          id="left-sidebar"
          panelRef={leftPanelRef}
          defaultSize={settings.sidebarOpen ? settings.leftSidebarWidth : 0}
          minSize={200}
          maxSize={640}
          collapsedSize={0}
          collapsible
          onResize={(size) => {
            sidebarProviderRef.current?.style.setProperty(
              "--sidebar-width",
              `${size.inPixels}px`
            )
          }}
          className="min-w-0"
        >
          <AppSidebar
            scheduleStatus={<LiveScheduleStatus store={calendarStore} />}
            weather={<WeatherWidget />}
            navigationItems={NAVIGATION_ITEMS}
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
            onToggleNoteFavorite={(path, favorite) => {
              void memo.setFavorite(path, favorite)
            }}
            onOpenSettings={() => {
              setSettingsOpen(true)
            }}
            onRefresh={() => void memo.refresh()}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="workspace" minSize={200} className="min-w-0">
          <SidebarInset
            className={`min-h-0 overflow-hidden md:m-2 md:rounded-xl md:shadow-sm ${settings.sidebarOpen ? "md:ml-0" : "md:ml-2"}`}
          >
            <SiteHeader
              title={NAVIGATION_ITEMS.find((item) => item.id === view)!.label}
              onQuickCommand={() => setCommandOpen(true)}
            />

            <ResizablePanelGroup
              orientation="horizontal"
              className="relative min-h-0 flex-1"
              onLayoutChanged={saveRightPanelLayout}
            >
              <ResizablePanel id="main-view" minSize={0} className="min-w-0">
                <div className="flex h-full min-w-0 flex-col">
                  {/* 창 전체 대신 메모 본문만 스크롤한다. 상위 flex 요소의 min-h-0도 유지한다. */}
                  <div
                    className={
                      view === "notes"
                        ? "flex min-h-0 flex-1 flex-col"
                        : "hidden"
                    }
                  >
                    <NotesPage memo={memo} />
                  </div>
                  {shortcutsVisited && (
                    <div
                      className={
                        view === "shortcuts"
                          ? "flex min-h-0 flex-1 flex-col"
                          : "hidden"
                      }
                    >
                      <Suspense
                        fallback={
                          <p
                            role="status"
                            className="p-6 text-sm text-muted-foreground"
                          >
                            바로가기를 불러오는 중…
                          </p>
                        }
                      >
                        <ShortcutWorkspace
                          active={view === "shortcuts"}
                          store={shortcutStore}
                        />
                      </Suspense>
                    </div>
                  )}
                  {todosVisited && (
                    <div
                      className={
                        view === "todos"
                          ? "flex min-h-0 flex-1 flex-col"
                          : "hidden"
                      }
                    >
                      <Suspense
                        fallback={
                          <p
                            role="status"
                            className="p-6 text-sm text-muted-foreground"
                          >
                            할일을 불러오는 중…
                          </p>
                        }
                      >
                        <TodoWorkspace store={todoStore} />
                      </Suspense>
                    </div>
                  )}
                  {calendarVisited && (
                    <div
                      className={
                        view === "calendar"
                          ? "flex min-h-0 flex-1 flex-col"
                          : "hidden"
                      }
                    >
                      <Suspense
                        fallback={
                          <p
                            role="status"
                            className="p-6 text-sm text-muted-foreground"
                          >
                            캘린더를 불러오는 중…
                          </p>
                        }
                      >
                        <CalendarWorkspace store={calendarStore} />
                      </Suspense>
                    </div>
                  )}
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                id="right-status-panel"
                panelRef={rightPanelRef}
                defaultSize={
                  settings.rightPanelOpen ? settings.rightPanelWidth : 40
                }
                minSize={200}
                maxSize={480}
                collapsedSize={40}
                collapsible
              >
                <LiveStatusPanel
                  calendarStore={calendarStore}
                  shortcutStore={shortcutStore}
                  todoStore={todoStore}
                  open={settings.rightPanelOpen}
                  onOpenChange={(rightPanelOpen) =>
                    void updateSettings({ rightPanelOpen })
                  }
                  onOpenCalendar={() => navigate("calendar")}
                  onOpenShortcuts={() => navigate("shortcuts")}
                  onOpenTodos={() => navigate("todos")}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </SidebarInset>
        </ResizablePanel>
      </ResizablePanelGroup>
      <QuickCommand open={commandOpen} onOpenChange={setCommandOpen} />
      <CalendarReminderCenter />
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        directory={memo.library?.directory}
        ready={memo.ready}
        busy={memo.busy}
        error={memo.error}
        onChooseDirectory={() => void memo.chooseDirectory()}
        settingsError={settingsError}
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
