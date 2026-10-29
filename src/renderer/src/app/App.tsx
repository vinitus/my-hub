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
import { Calculator } from "@/features/calculator"
import { ShortcutMenu } from "@/features/shortcut-wheel"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { SettingsSheet, CodexSetupPrompt } from "@/features/settings"
import { lazy, Suspense, useEffect, useState } from "react"
import { NAVIGATION_ITEMS } from "@/app/config/navigation"
import { useNavigationShortcuts } from "@/app/model/use-navigation-shortcuts"
import { useAppSettings } from "./providers/app-settings-provider"
import { WorkspaceLayout } from "./ui/workspace-layout"
import { useAppDialogs } from "./model/use-app-dialogs"
import { useHomeCreate } from "./model/use-home-create"
import { HomeCreateDialog } from "./ui/home-create-dialog"
import { useWorkspaceNavigation } from "./model/use-workspace-navigation"
import { useScratchpadSave } from "./model/use-scratchpad-save"

import { useConfiguredQuickMenu } from "./model/use-configured-quick-menu"
import { DEFAULT_APP_SETTINGS } from "../../../shared/app-settings"

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
  const { view, visited, navigate } = useWorkspaceNavigation()
  const [calculatorOpen, setCalculatorOpen] = useState(false)
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
  const creation = useHomeCreate({ todoStore, calendarStore, shortcutStore })
  const memo = useNote(
    view === "notes" &&
      !commandOpen &&
      !settingsOpen &&
      !codexPromptOpen &&
      !calculatorOpen &&
      creation.session === null
  )
  const saveScratchpad = useScratchpadSave(
    memo.saveText,
    window.api?.codex?.suggestNoteTitle
  )
  const menuItems =
    settings.shortcutMenuItems ?? DEFAULT_APP_SETTINGS.shortcutMenuItems
  const quickMenu = useConfiguredQuickMenu({
    items: menuItems,
    store: shortcutStore,
    settingsOpen,
    noteBusy: memo.busy || !memo.ready,
    handlers: {
      note: () => {
        navigate("notes")
        void memo.newNote()
      },
      todo: () => creation.open("todo"),
      event: () => creation.open("event"),
      shortcut: () => creation.open("shortcut"),
      calculator: () => setCalculatorOpen(true),
      home: () => navigate("home"),
      notes: () => navigate("notes"),
      calendar: () => navigate("calendar"),
    },
  })
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
          <HomeCreateDialog {...creation} />
          <Dialog open={calculatorOpen} onOpenChange={setCalculatorOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>계산기</DialogTitle>
                <DialogDescription>
                  사칙연산과 괄호를 사용해 계산합니다.
                </DialogDescription>
              </DialogHeader>
              <Calculator collapsible={false} />
            </DialogContent>
          </Dialog>
          <SettingsSheet
            shortcutMenuItems={menuItems}
            quickMenuOptions={quickMenu.options}
            quickMenuError={quickMenu.error}
            onShortcutMenuItemsChange={(shortcutMenuItems) =>
              void updateSettings({ shortcutMenuItems })
            }
            shortcutMenuMotion={settings.shortcutMenuMotion}
            onShortcutMenuMotionChange={(shortcutMenuMotion) =>
              void updateSettings({ shortcutMenuMotion })
            }
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
      <div className="relative flex h-full min-w-0 flex-col">
        <div
          className={
            view === "home" ? "flex min-h-0 flex-1 flex-col" : "hidden"
          }
        >
          <HomePage
            active={view === "home"}
            onSave={saveScratchpad}
            onCreateTodo={() => creation.open("todo")}
            onCreateEvent={() => creation.open("event")}
            onCreateShortcut={() => creation.open("shortcut")}
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
        {visited.has("shortcuts") && (
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
              />
            </Suspense>
          </div>
        )}
        {visited.has("todos") && (
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
              <TodoWorkspace store={todoStore} />
            </Suspense>
          </div>
        )}
        {visited.has("calendar") && (
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
              <CalendarWorkspace store={calendarStore} />
            </Suspense>
          </div>
        )}
        <ShortcutMenu
          key={view}
          motion={settings.shortcutMenuMotion}
          actions={quickMenu.actions}
          disabled={quickMenu.actions.length === 0}
        />
      </div>
    </WorkspaceLayout>
  )
}

export default App
