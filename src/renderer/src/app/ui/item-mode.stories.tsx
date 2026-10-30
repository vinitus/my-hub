import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ItemModeSettings } from "@/features/settings"
import { InboxView } from "@/features/inbox"
import { TodoStore, TodoWorkspace } from "@/features/todos"
import { ShortcutStore } from "@/features/shortcuts"
import { CalendarStore } from "@/entities/calendar-event"
import { QuickCommand } from "@/features/quick-command"
import {
  ContentVisibility,
  ContentVisibilityProvider,
} from "@/shared/lib/content-visibility"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { useItemMode } from "../model/use-item-mode"
import { ItemModeControl } from "./item-mode-control"
import { useActionLauncher } from "../model/use-action-launcher"
import { DEFAULT_APP_SETTINGS } from "../../../../shared/app-settings"
import { ITEM_KIND_LABELS, modeItemKey } from "../../../../shared/item-mode"
import type { CalendarEvent } from "../../../../shared/calendar"
import type { Todo } from "../../../../shared/todos"
import type { InboxItem } from "../../../../shared/inbox"

const id = "11111111-1111-4111-8111-111111111111"
const todo: Todo = { id, title: "PRIVATE-TODO", completed: false }
const inbox: InboxItem = {
  id,
  content: "PRIVATE-INBOX",
  kind: "text",
  source: "fixture",
  createdAt: "2026-10-30T01:00:00Z",
  processedAt: null,
  destination: null,
}
const event: CalendarEvent = {
  id,
  title: "PRIVATE-EVENT",
  description: "",
  color: "blue",
  allDay: true,
  start: "2026-10-30",
  end: "2026-10-31",
  referenceUrls: [],
  notifyInApp: false,
  notifyOS: false,
  openLinks: "never",
}
const notePath = "C:/Fixtures/private.md"
const refreshNotes = async () => {}
const catalog = Object.keys(ITEM_KIND_LABELS).map((kind) => ({
  kind: kind as keyof typeof ITEM_KIND_LABELS,
  key: modeItemKey(
    kind as keyof typeof ITEM_KIND_LABELS,
    kind === "note" ? notePath : id
  ),
  title: `PRIVATE-${kind.toUpperCase()}`,
}))

function ItemModeFlow({ failSwitch = false }: { failSwitch?: boolean }) {
  const [settings, setSettings] = useState({
    ...DEFAULT_APP_SETTINGS,
    modeEnabled: true,
    personalItemKeys: catalog.map((item) => item.key),
  })
  const [calls, setCalls] = useState(0)
  const [blocked, setBlocked] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [draft, setDraft] = useState("미저장 개인 메모")
  const [stores] = useState(() => {
    const todos = { items: [todo], revision: "fixture", path: "fixture/todos" }
    const calendar = {
      events: [event],
      revision: "fixture",
      path: "fixture/calendar",
    }
    const shortcuts = {
      items: [
        {
          id,
          name: "PRIVATE-SHORTCUT",
          kind: "website" as const,
          target: "https://example.com",
        },
      ],
      revision: "fixture",
      path: "fixture/shortcuts",
    }
    return {
      todo: new TodoStore({
        load: async () => todos,
        save: async () => todos,
        remove: async () => todos,
      }),
      calendar: new CalendarStore({
        load: async () => calendar,
        save: async () => calendar,
        remove: async () => calendar,
        openLinks: async () => {},
        chooseFile: async () => null,
        onReminder: () => () => {},
      }),
      shortcut: new ShortcutStore({
        load: async () => shortcuts,
        save: async () => shortcuts,
        remove: async () => shortcuts,
        reorder: async () => shortcuts,
        launch: async () => {},
        choose: async () => null,
        icon: async () => null,
        inspectDrop: async () => shortcuts.items[0],
      }),
    }
  })
  const mode = useItemMode({
    settings,
    ready: true,
    settingsOpen: false,
    canTransition: () => !blocked,
    setMode: async (next) => {
      setCalls((current) => current + 1)
      await new Promise((resolve) => setTimeout(resolve, 30))
      if (failSwitch) throw new Error("synthetic switch failure")
      return next
    },
  })
  const launcher = useActionLauncher({
    open: true,
    library: {
      directory: "C:/Fixtures",
      notes: [
        { path: notePath, name: "PRIVATE-NOTE.md", modifiedAt: 1793322000000 },
      ],
    },
    noteBusy: false,
    openNote: async () => {},
    refreshNotes,
    todoStore: stores.todo,
    calendarStore: stores.calendar,
    shortcutStore: stores.shortcut,
    onOpenEvent: () => {},
    onOpenTodos: () => {},
    commands: [],
    allows: mode.allows,
  })
  return (
    <ContentVisibilityProvider allows={mode.allows} scope={mode.scope}>
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          <ItemModeControl
            enabled={settings.modeEnabled}
            personal={mode.personal}
            pending={mode.pending}
            shortcut={settings.modeShortcut}
            onToggle={() => void mode.change(!mode.personal)}
          />
          <Button data-mode-focus-target onClick={() => setCommandOpen(true)}>
            검색 열기
          </Button>
          <label>
            <input
              data-testid="mode-block"
              type="checkbox"
              checked={blocked}
              onChange={(e) => setBlocked(e.target.checked)}
            />
            저장 중 모의 상태
          </label>
        </div>
        <output data-testid="mode-calls">{calls}</output>
        <output data-testid="mode-data-count">5</output>
        <div data-testid="mode-search-results">
          {launcher.actions.map((action) => (
            <p key={action.id}>{action.title}</p>
          ))}
        </div>
        <ContentVisibility
          contentKey={modeItemKey("note", notePath)}
          fallback={<p>개인 메모 숨김</p>}
        >
          <Input
            aria-label="개인 메모 초안"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </ContentVisibility>
        <div data-testid="mode-inbox">
          <InboxView
            items={[inbox]}
            busy={false}
            loading={false}
            error=""
            notice=""
            onCapture={async () => true}
            onFiles={async () => true}
            onChooseFiles={async () => true}
            onRefresh={() => {}}
            onOpen={() => {}}
            onProcess={() => {}}
            onRemove={async () => true}
            onConvert={() => {}}
          />
        </div>
        <div data-testid="mode-todos">
          <TodoWorkspace
            items={[todo]}
            revision="fixture"
            ready
            busy={false}
            error=""
            notice=""
            onSave={async () => true}
            onRemove={async () => true}
            onRefresh={() => {}}
          />
        </div>
        <ItemModeSettings
          settings={settings}
          personal={mode.personal}
          busy={mode.pending}
          items={catalog.filter((item) => mode.allows(item.key))}
          onPersonalChange={(next) => void mode.change(next)}
          onChange={async (patch) => {
            setSettings((current) => ({ ...current, ...patch }))
            return true
          }}
        />
        <QuickCommand
          open={commandOpen}
          onOpenChange={setCommandOpen}
          actions={launcher.actions}
        />
      </main>
    </ContentVisibilityProvider>
  )
}
const meta = {
  title: "앱/항목별 모드",
  component: ItemModeFlow,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ItemModeFlow>
export default meta
type Story = StoryObj<typeof meta>
export const WorkToPersonal: Story = {}
export const SwitchFailure: Story = { args: { failSwitch: true } }
