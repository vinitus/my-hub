import { useState, useSyncExternalStore } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CalendarStore } from "@/entities/calendar-event"
import { TodoStore } from "@/features/todos"
import { ShortcutStore } from "@/features/shortcuts"
import { HomePage } from "@/pages/home"
import type {
  CalendarEvent,
  CalendarSnapshot,
} from "../../../../shared/calendar"
import type { TodoSnapshot } from "../../../../shared/todos"
import type { ShortcutSnapshot } from "../../../../shared/shortcuts"
import { useHomeCreate } from "../model/use-home-create"
import { HomeCreateDialog } from "./home-create-dialog"

const event: CalendarEvent = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "",
  description: "",
  allDay: false,
  start: "2026-10-28T09:00:00+09:00",
  end: "2026-10-28T10:00:00+09:00",
  color: "blue",
  referenceUrls: [],
  notifyOS: false,
  notifyInApp: true,
  openLinks: "never",
}
const meta = {
  title: "앱/홈 등록 모달",
  component: HomeCreateDialog,
  parameters: { layout: "fullscreen" },
  args: {
    session: { kind: "todo", revision: "fixture-0" },
    busy: false,
    error: "",
    onClose: () => {},
    onRetry: () => {},
    onSaveTodo: async (): Promise<boolean> => true,
    onSaveEvent: async (): Promise<boolean> => true,
    onSaveShortcut: async (): Promise<boolean> => true,
    onChoose: async () => ({
      name: "편집기",
      target: "C:\\Fixtures\\Editor.lnk",
    }),
    onChooseFile: async () => "C:\\Fixtures\\agenda.md",
  },
} satisfies Meta<typeof HomeCreateDialog>
export default meta
type Story = StoryObj<typeof meta>
export const Todo: Story = {}
export const Event: Story = {
  args: { session: { kind: "event", revision: "fixture-0", event } },
}
export const Shortcut: Story = {
  args: {
    session: {
      kind: "shortcut",
      revision: "fixture-0",
      item: { id: event.id, name: "", kind: "website", target: "" },
    },
  },
}
export const Loading: Story = {
  args: { session: { kind: "todo", revision: null } },
}
export const LoadError: Story = {
  args: {
    session: { kind: "todo", revision: null },
    error: "목록을 불러오지 못했습니다.",
  },
}
export const SaveError: Story = {
  args: {
    error: "다른 창에서 목록이 변경되었습니다.",
    onSaveTodo: async () => false,
  },
}
export const Saving: Story = { args: { busy: true } }
export const DatedCompleted: Story = {
  args: {
    session: {
      kind: "todo",
      revision: "fixture-0",
      todo: {
        id: event.id,
        title: "확정한 할일",
        dueDate: "2026-11-03",
        completed: true,
      },
    },
  },
}

// 실제 controller·store를 로컬 메모리 API로 연결한다. 파일·계정·Electron 브리지는 사용하지 않는다.
function HomeRegistration({ failSave = false }: { failSave?: boolean }) {
  const [stores] = useState(() => {
    let todos: TodoSnapshot = {
      items: [],
      revision: "fixture-0",
      path: "fixtures/todos.json",
    }
    let calendar: CalendarSnapshot = {
      events: [],
      revision: "fixture-0",
      path: "fixtures/calendar.json",
    }
    let shortcuts: ShortcutSnapshot = {
      items: [],
      revision: "fixture-0",
      path: "fixtures/shortcuts.json",
    }
    const check = (expected: string, revision: string) => {
      if (failSave) throw new Error("저장 실패 테스트")
      if (expected !== revision)
        throw new Error("다른 창에서 목록이 변경되었습니다.")
    }
    return {
      todoStore: new TodoStore({
        load: async () => todos,
        save: async ({ todo, expectedRevision }) => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          check(expectedRevision, todos.revision)
          todos = {
            ...todos,
            items: [...todos.items, todo],
            revision: "fixture-1",
          }
          return todos
        },
        remove: async () => todos,
      }),
      calendarStore: new CalendarStore({
        load: async () => calendar,
        save: async ({ event: item, expectedRevision }) => {
          check(expectedRevision, calendar.revision)
          calendar = {
            ...calendar,
            events: [...calendar.events, item],
            revision: "fixture-1",
          }
          return calendar
        },
        remove: async () => calendar,
        openLinks: async () => {},
        chooseFile: async () => "C:\\Fixtures\\agenda.md",
        onReminder: () => () => {},
      }),
      shortcutStore: new ShortcutStore({
        load: async () => shortcuts,
        save: async ({ shortcut, expectedRevision }) => {
          check(expectedRevision, shortcuts.revision)
          shortcuts = {
            ...shortcuts,
            items: [...shortcuts.items, shortcut],
            revision: "fixture-1",
          }
          return shortcuts
        },
        remove: async () => shortcuts,
        reorder: async () => shortcuts,
        choose: async () => ({
          name: "편집기",
          target: "C:\\Fixtures\\Editor.lnk",
        }),
        launch: async () => {},
        icon: async () => null,
        inspectDrop: async () => ({
          id: event.id,
          name: "폴더",
          kind: "folder",
          target: "C:\\Fixtures",
        }),
      }),
    }
  })
  const creation = useHomeCreate({
    ...stores,
    createEvent: () => ({ ...event }),
  })
  const todos = useSyncExternalStore(
    stores.todoStore.subscribe,
    stores.todoStore.getSnapshot
  )
  const calendar = useSyncExternalStore(
    stores.calendarStore.subscribe,
    stores.calendarStore.getSnapshot
  )
  const shortcuts = useSyncExternalStore(
    stores.shortcutStore.subscribe,
    stores.shortcutStore.getSnapshot
  )
  return (
    <div className="flex h-screen min-h-0 flex-col">
      <HomePage
        active
        onSave={async () => true}
        onCreateTodo={() => creation.open("todo")}
        onCreateEvent={() => creation.open("event")}
        onCreateShortcut={() => creation.open("shortcut")}
      />
      <output data-testid="saved-counts" className="sr-only">
        {JSON.stringify({
          todos: todos.snapshot?.items.length ?? 0,
          events: calendar.snapshot?.events.length ?? 0,
          shortcuts: shortcuts.snapshot?.items.length ?? 0,
        })}
      </output>
      <output data-testid="saved-todos" className="sr-only">
        {JSON.stringify(todos.snapshot?.items ?? [])}
      </output>
      <HomeCreateDialog
        {...creation}
        onChooseFile={async () => "C:\\Fixtures\\agenda.md"}
      />
    </div>
  )
}
export const HomeActions: Story = { render: () => <HomeRegistration /> }
export const HomeSaveFailure: Story = {
  render: () => <HomeRegistration failSave />,
}
