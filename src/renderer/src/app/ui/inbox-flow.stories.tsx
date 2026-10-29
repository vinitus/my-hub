import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { InboxStore, InboxView } from "@/features/inbox"
import { TodoStore } from "@/features/todos"
import { ShortcutStore } from "@/features/shortcuts"
import { CalendarStore, newCalendarEvent } from "@/entities/calendar-event"
import type { InboxSnapshot } from "../../../../shared/inbox"
import type { TodoSnapshot } from "../../../../shared/todos"
import type { CalendarSnapshot } from "../../../../shared/calendar"
import type { ShortcutSnapshot } from "../../../../shared/shortcuts"
import { useInboxActions } from "../model/use-inbox-actions"
import { useHomeCreate } from "../model/use-home-create"
import { HomeCreateDialog } from "./home-create-dialog"

function InboxFlow({
  failSave = false,
  failProcess = false,
}: {
  failSave?: boolean
  failProcess?: boolean
}) {
  const [saved, setSaved] = useState({
    todo: 0,
    event: 0,
    shortcut: 0,
    note: 0,
  })
  const [stores] = useState(() => {
    let inbox: InboxSnapshot = {
      items: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          content: "https://example.com/review",
          kind: "link",
          source: "브라우저에서 붙여넣기",
          createdAt: "2026-10-30T01:00:00.000Z",
          processedAt: null,
          destination: null,
        },
      ],
      revision: "inbox-0",
      path: "fixture/inbox.json",
    }
    let todos: TodoSnapshot = {
      items: [],
      revision: "todos-0",
      path: "fixture/todos.json",
    }
    let calendar: CalendarSnapshot = {
      events: [],
      revision: "events-0",
      path: "fixture/calendar.json",
    }
    let shortcuts: ShortcutSnapshot = {
      items: [],
      revision: "shortcuts-0",
      path: "fixture/shortcuts.json",
    }
    let revision = 0
    function check(expected: string, actual: string) {
      if (failSave) throw new Error("대상 저장 실패 테스트")
      if (expected !== actual) throw new Error("목록이 변경되었습니다.")
    }
    const todoStore = new TodoStore({
      load: async () => todos,
      save: async ({ todo, expectedRevision }) => {
        check(expectedRevision, todos.revision)
        todos = {
          ...todos,
          items: [...todos.items, todo],
          revision: `todos-${++revision}`,
        }
        setSaved((current) => ({ ...current, todo: current.todo + 1 }))
        return todos
      },
      remove: async () => todos,
    })
    const calendarStore = new CalendarStore({
      load: async () => calendar,
      save: async ({ event, expectedRevision }) => {
        check(expectedRevision, calendar.revision)
        calendar = {
          ...calendar,
          events: [...calendar.events, event],
          revision: `events-${++revision}`,
        }
        setSaved((current) => ({ ...current, event: current.event + 1 }))
        return calendar
      },
      remove: async () => calendar,
      openLinks: async () => {},
      chooseFile: async () => null,
      onReminder: () => () => {},
    })
    const shortcutStore = new ShortcutStore({
      load: async () => shortcuts,
      save: async ({ shortcut, expectedRevision }) => {
        check(expectedRevision, shortcuts.revision)
        shortcuts = {
          ...shortcuts,
          items: [...shortcuts.items, shortcut],
          revision: `shortcuts-${++revision}`,
        }
        setSaved((current) => ({ ...current, shortcut: current.shortcut + 1 }))
        return shortcuts
      },
      remove: async () => shortcuts,
      reorder: async () => shortcuts,
      launch: async () => {},
      icon: async () => null,
      choose: async () => null,
      inspectDrop: async () => {
        throw new Error("이 fixture는 링크를 사용합니다.")
      },
    })
    const inboxStore = new InboxStore({
      load: async () => inbox,
      capture: async () => inbox,
      process: async ({ id, processed, destination, expectedRevision }) => {
        if (failProcess) throw new Error("처리 상태 기록 실패 테스트")
        if (expectedRevision !== inbox.revision)
          throw new Error("인박스가 변경되었습니다.")
        inbox = {
          ...inbox,
          revision: `inbox-${++revision}`,
          items: inbox.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  processedAt: processed ? "2026-10-30T02:00:00.000Z" : null,
                  destination: processed ? (destination ?? null) : null,
                }
              : item
          ),
        }
        return inbox
      },
      remove: async () => inbox,
      open: async () => {},
      chooseFiles: async () => null,
      captureFiles: async () => inbox,
    })
    return { inboxStore, todoStore, calendarStore, shortcutStore }
  })
  const creation = useHomeCreate(stores)
  const inbox = useInboxActions({
    store: stores.inboxStore,
    openCreation: creation.open,
    noteBusy: false,
    createEvent: () => newCalendarEvent(new Date("2026-10-30T01:00:00.000Z")),
    saveNote: async () => {
      if (failSave) return undefined
      setSaved((current) => ({ ...current, note: current.note + 1 }))
      return { saved: true, name: "수집한 링크.md" }
    },
  })
  return (
    <>
      <InboxView {...inbox.viewProps} />
      <HomeCreateDialog {...creation} />
      <output data-testid="inbox-saved-counts" className="sr-only">
        {JSON.stringify(saved)}
      </output>
    </>
  )
}
const meta = {
  title: "앱/인박스 이동",
  component: InboxFlow,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof InboxFlow>
export default meta
type Story = StoryObj<typeof meta>
export const Move: Story = {}
export const SaveFailure: Story = { args: { failSave: true } }
export const ProcessFailure: Story = { args: { failProcess: true } }
