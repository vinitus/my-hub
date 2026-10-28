import { TodoStore } from "@/features/todos"
import { AppSidebar } from "@/widgets/app-sidebar"
import { SiteHeader } from "@/widgets/site-header"
import { LiveScheduleStatus, LiveStatusPanel } from "@/widgets/live-status"
import { ShortcutStore } from "@/features/shortcuts"
import { WeatherWidget } from "@/features/weather"
import { NotesPage } from "@/pages/notes"
import { HomePage } from "@/pages/home"
import { CalendarReminderCenter } from "@/features/calendar"
import { CalendarStore } from "@/entities/calendar-event"
import { useNote } from "@/features/notes"
import { QuickCommand } from "@/features/quick-command"
import { SettingsSheet, CodexSetupPrompt } from "@/features/settings"
import { lazy, Suspense, useEffect, useState } from "react"
import { NAVIGATION_ITEMS, type AppView } from "@/app/config/navigation"
import { useNavigationShortcuts } from "@/app/model/use-navigation-shortcuts"
import { useAppSettings } from "./providers/app-settings-provider"
import { WorkspaceLayout } from "./ui/workspace-layout"
import { useAppDialogs } from "./model/use-app-dialogs"

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
  const [selectedView, setView] = useState<AppView>("home")
  // 개발 중 Fast Refresh가 제거된 메뉴의 상태를 유지해도 홈으로 돌아간다.
  const view = NAVIGATION_ITEMS.some((item) => item.id === selectedView)
    ? selectedView
    : "home"
  const {
    commandOpen,
    setCommandOpen,
    settingsOpen,
    setSettingsOpen,
    codexSetup,
    setCodexSetup,
    codexPromptOpen,
  } = useAppDialogs()
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
  const [todosVisited, setTodosVisited] = useState(false)
  const [calendarVisited, setCalendarVisited] = useState(false)
  const [shortcutsVisited, setShortcutsVisited] = useState(false)
  // 등록 요청은 lazy 페이지의 로드 후 소비한다. 페이지를 재마운트하지 않아 초안·필터를 보존한다.
  const [todoCreateRequest, setTodoCreateRequest] = useState(0)
  const [calendarCreateRequest, setCalendarCreateRequest] = useState(0)
  const [shortcutCreateRequest, setShortcutCreateRequest] = useState(0)
  const memo = useNote(
    view === "notes" && !commandOpen && !settingsOpen && !codexPromptOpen
  )
  const navigate = (next: AppView) => {
    if (next === "todos") setTodosVisited(true)
    if (next === "calendar") setCalendarVisited(true)
    if (next === "shortcuts") setShortcutsVisited(true)
    setView(next)
  }
  const [scratchpadFileId, setScratchpadFileId] = useState<string | null>(null)
  const saveScratchpad = async (text: string) => {
    if (!window.api?.notes)
      throw new Error("파일 저장은 Electron 앱에서 사용할 수 있습니다.")
    const file = await window.api.notes.save({
      id: scratchpadFileId,
      markdown: text,
      name: "낙서장.md",
      saveAs: scratchpadFileId === null,
    })
    if (!file) return false
    setScratchpadFileId(file.id)
    void memo.refresh()
    return true
  }
  const createTodo = () => {
    setTodoCreateRequest((request) => request + 1)
    navigate("todos")
  }
  const createEvent = () => {
    setCalendarCreateRequest((request) => request + 1)
    navigate("calendar")
  }
  const createShortcut = () => {
    setShortcutCreateRequest((request) => request + 1)
    navigate("shortcuts")
  }
  const showNavigationNumbers = useNavigationShortcuts(navigate)
  return (
    <WorkspaceLayout
      settings={settings}
      ready={settingsReady}
      onChange={(patch) => void updateSettings(patch)}
      sidebar={
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
      }
      header={
        <SiteHeader
          title={NAVIGATION_ITEMS.find((item) => item.id === view)!.label}
          onQuickCommand={() => setCommandOpen(true)}
        />
      }
      statusPanel={
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
      }
      overlays={
        <>
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
        </>
      }
    >
      <div className="flex h-full min-w-0 flex-col">
        <div
          className={
            view === "home" ? "flex min-h-0 flex-1 flex-col" : "hidden"
          }
        >
          <HomePage
            active={view === "home"}
            onSave={saveScratchpad}
            onCreateTodo={createTodo}
            onCreateEvent={createEvent}
            onCreateShortcut={createShortcut}
          />
        </div>
        {/* 창 전체 대신 메모 본문만 스크롤한다. 상위 flex 요소의 min-h-0도 유지한다. */}
        <div
          className={
            view === "notes" ? "flex min-h-0 flex-1 flex-col" : "hidden"
          }
        >
          <NotesPage memo={memo} />
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
              <ShortcutWorkspace
                active={view === "shortcuts"}
                store={shortcutStore}
                createRequest={shortcutCreateRequest}
              />
            </Suspense>
          </div>
        )}
        {todosVisited && (
          <div
            className={
              view === "todos" ? "flex min-h-0 flex-1 flex-col" : "hidden"
            }
          >
            <Suspense
              fallback={
                <p role="status" className="p-6 text-sm text-muted-foreground">
                  할일을 불러오는 중…
                </p>
              }
            >
              <TodoWorkspace
                store={todoStore}
                createRequest={todoCreateRequest}
              />
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
              <CalendarWorkspace
                store={calendarStore}
                createRequest={calendarCreateRequest}
              />
            </Suspense>
          </div>
        )}
      </div>
    </WorkspaceLayout>
  )
}

export default App
