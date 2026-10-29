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
import { QuickCommand, AIQuickCommand } from "@/features/quick-command"
import { Calculator } from "@/features/calculator"
import { InboxCaptureDialog, InboxStore } from "@/features/inbox"
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
import { useActionLauncher } from "./model/use-action-launcher"
import { useInboxActions } from "./model/use-inbox-actions"
import { DEFAULT_APP_SETTINGS } from "../../../shared/app-settings"

const TodoWorkspace = lazy(() => import("@/pages/todos"))
const CalendarWorkspace = lazy(() => import("@/pages/calendar"))
const ShortcutWorkspace = lazy(() => import("@/pages/shortcuts"))
const InboxWorkspace = lazy(() => import("@/pages/inbox"))
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
  const [inboxDialogOpen, setInboxDialogOpen] = useState(false)
  const [calendarFocus, setCalendarFocus] = useState<{
    id: number
    date: string
  } | null>(null)
  const {
    commandOpen,
    setCommandOpen,
    aiCommandOpen,
    setAICommandOpen,
    settingsOpen,
    setSettingsOpen,
    codexSetup,
    setCodexSetup,
    codexPromptOpen,
  } = useAppDialogs(inboxDialogOpen)
  const [todoStore] = useState(() => new TodoStore(window.api?.todos))
  const [calendarStore] = useState(
    () => new CalendarStore(window.api?.calendar)
  )
  const [shortcutStore] = useState(
    () => new ShortcutStore(window.api?.shortcuts)
  )
  const [inboxStore] = useState(() => new InboxStore(window.api?.inbox))
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
      !aiCommandOpen &&
      !settingsOpen &&
      !codexPromptOpen &&
      !calculatorOpen &&
      !inboxDialogOpen &&
      creation.session === null
  )
  const saveScratchpad = useScratchpadSave(
    memo.saveText,
    window.api?.codex?.suggestNoteTitle
  )
  const inbox = useInboxActions({
    store: inboxStore,
    inspectShortcut: window.api?.shortcuts?.inspectDrop,
    openCreation: creation.open,
    saveNote: memo.saveText,
    noteBusy: memo.busy,
  })
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
  const launcher = useActionLauncher({
    open: commandOpen,
    library: memo.library,
    noteBusy: memo.busy,
    refreshNotes: memo.refresh,
    onOpenTodos: () => navigate("todos"),
    openNote: async (name) => {
      navigate("notes")
      await memo.openNote(name)
    },
    todoStore,
    calendarStore,
    shortcutStore,
    onOpenEvent: (event) => {
      navigate("calendar")
      setCalendarFocus((current) => ({
        id: (current?.id ?? 0) + 1,
        date: event.start,
      }))
    },
    commands: [
      {
        id: "capture:inbox",
        kind: "command",
        title: "인박스에 수집",
        description: "생각·링크·파일 빠르게 모으기",
        label: "수집",
        execute: () => setInboxDialogOpen(true),
      },
      ...NAVIGATION_ITEMS.map((item) => ({
        id: `navigate:${item.id}`,
        kind: "command" as const,
        title: `${item.label} 열기`,
        description: "화면 이동",
        label: "열기",
        execute: () => navigate(item.id),
      })),
      {
        id: "create:note",
        kind: "command",
        title: "새 메모",
        description: "메모 작성",
        label: "만들기",
        disabled: memo.busy,
        execute: async () => {
          navigate("notes")
          await memo.newNote()
        },
      },
      {
        id: "create:todo",
        kind: "command",
        title: "새 할일",
        description: "할일 추가",
        label: "만들기",
        execute: () => creation.open("todo"),
      },
      {
        id: "create:event",
        kind: "command",
        title: "새 일정",
        description: "일정 추가",
        label: "만들기",
        execute: () => creation.open("event"),
      },
      {
        id: "create:shortcut",
        kind: "command",
        title: "프로그램 등록",
        description: "프로그램·폴더·웹사이트 바로가기 추가",
        label: "등록",
        execute: () => creation.open("shortcut"),
      },
      {
        id: "calendar:today",
        kind: "command",
        title: "오늘 일정",
        description: "캘린더에서 오늘의 일정 보기",
        label: "열기",
        execute: () => {
          navigate("calendar")
          setCalendarFocus((current) => ({
            id: (current?.id ?? 0) + 1,
            date: new Date().toISOString(),
          }))
        },
      },
      {
        id: "calculator",
        kind: "command",
        title: "계산기",
        description: "빠른 계산",
        label: "열기",
        execute: () => setCalculatorOpen(true),
      },
      {
        id: "settings",
        kind: "command",
        title: "설정",
        description: "앱 설정과 AI 연결",
        label: "열기",
        execute: () => setSettingsOpen(true),
      },
    ],
  })
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
          onAIQuickCommand={() => setAICommandOpen(true)}
          onInboxCapture={() => setInboxDialogOpen(true)}
          launcherShortcut={settings.launcherShortcut}
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
          <QuickCommand
            open={commandOpen}
            onOpenChange={setCommandOpen}
            {...launcher}
            shortcut={settings.launcherShortcut}
          />
          <AIQuickCommand
            open={aiCommandOpen}
            onOpenChange={setAICommandOpen}
          />
          <CalendarReminderCenter />
          <HomeCreateDialog {...creation} />
          <InboxCaptureDialog
            {...inbox.viewProps}
            open={inboxDialogOpen}
            onOpenChange={setInboxDialogOpen}
          />
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
            launcherShortcut={settings.launcherShortcut}
            onLauncherShortcutChange={(launcherShortcut) =>
              void updateSettings({ launcherShortcut })
            }
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
        {visited.has("inbox") && (
          <div
            className={
              view === "inbox" ? "flex min-h-0 flex-1 flex-col" : "hidden"
            }
          >
            <Suspense
              fallback={
                <p role="status" className="p-6 text-sm text-muted-foreground">
                  인박스를 불러오는 중…
                </p>
              }
            >
              <InboxWorkspace {...inbox.viewProps} />
            </Suspense>
          </div>
        )}
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
              <CalendarWorkspace
                store={calendarStore}
                focusRequest={calendarFocus}
              />
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
