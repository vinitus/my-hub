import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CalendarStore } from "@/entities/calendar-event"
import { ShortcutStore } from "@/features/shortcuts"
import { TodoStore } from "@/features/todos"
import { useLiveStatusClock } from "../model/use-live-status-clock"
import { LiveScheduleStatus } from "./live-schedule-status"
import { LiveStatusPanel } from "./live-status-panel"

// Local callbacks only: no native bridge, filesystem, accounts, or network.
function lifecycleFixture(prefix: string, calls: string[]) {
  function store(name: string) {
    return {
      initialize: async () => {
        calls.push(`${prefix}:${name}:initialize`)
      },
      refresh: async () => {
        calls.push(`${prefix}:${name}:refresh`)
      },
    }
  }
  return {
    calendarStore: store("calendar"),
    shortcutStore: store("shortcut"),
    todoStore: store("todo"),
  }
}
function ClockProbe({
  stores,
}: {
  stores: Parameters<typeof useLiveStatusClock>[0]
}) {
  const now = useLiveStatusClock(stores)
  return <output data-testid="clock-now">{now}</output>
}
function ClockLifecycle({ mode }: { mode: "single" | "panel" | "both" }) {
  const [fixtures] = useState(() => {
    const calls: string[] = []
    return {
      calls,
      a: lifecycleFixture("a", calls),
      b: lifecycleFixture("b", calls),
    }
  })
  const [mounted, setMounted] = useState(false)
  const [replaced, setReplaced] = useState(false)
  const [extras, setExtras] = useState(true)
  const [revision, setRevision] = useState(0)
  const [calls, setCalls] = useState("[]")
  const stores = replaced ? fixtures.b : fixtures.a
  return (
    <div className="grid gap-2" data-revision={revision}>
      <button onClick={() => setMounted(true)}>Mount clocks</button>
      <button onClick={() => setRevision((value) => value + 1)}>
        Rerender clocks
      </button>
      <button onClick={() => setReplaced(true)}>Replace stores</button>
      <button onClick={() => setExtras((value) => !value)}>
        Toggle extra stores
      </button>
      <button onClick={() => setMounted(false)}>Unmount clocks</button>
      <button onClick={() => setCalls(JSON.stringify(fixtures.calls))}>
        Read calls
      </button>
      <output data-testid="clock-calls">{calls}</output>
      {mounted && (
        <>
          <ClockProbe
            stores={{
              calendarStore: stores.calendarStore,
              ...(mode !== "single" && extras ? stores : {}),
            }}
          />
          {mode === "both" && (
            <ClockProbe stores={{ calendarStore: stores.calendarStore }} />
          )}
        </>
      )}
    </div>
  )
}

function LiveWidgets({ state }: { state: "ready" | "loading" | "error" }) {
  const [stores] = useState(() => {
    async function load<T>(snapshot: T): Promise<T> {
      if (state === "loading") return new Promise<T>(() => {})
      if (state === "error") throw new Error("고정된 조회 오류")
      return snapshot
    }
    const unused = async (): Promise<never> => {
      throw new Error("Unused story action")
    }
    return {
      calendarStore: new CalendarStore({
        load: () =>
          load({
            events: [],
            revision: "fixture",
            path: "fixture/calendar.json",
          }),
        save: unused,
        remove: unused,
        openLinks: unused,
        chooseFile: unused,
        onReminder: () => () => {},
      }),
      shortcutStore: new ShortcutStore({
        load: () =>
          load({
            items: [],
            revision: "fixture",
            path: "fixture/shortcuts.json",
          }),
        save: unused,
        remove: unused,
        reorder: unused,
        choose: unused,
        launch: unused,
        icon: unused,
        inspectDrop: unused,
      }),
      todoStore: new TodoStore({
        load: () =>
          load({ items: [], revision: "fixture", path: "fixture/todos.json" }),
        save: unused,
        remove: unused,
      }),
    }
  })
  return (
    <div className="grid h-[700px] gap-4">
      <LiveScheduleStatus store={stores.calendarStore} />
      <LiveStatusPanel
        {...stores}
        open
        onOpenChange={() => {}}
        onOpenCalendar={() => {}}
        onOpenShortcuts={() => {}}
        onOpenTodos={() => {}}
      />
    </div>
  )
}
const meta = {
  title: "Widgets/Live Status",
  component: LiveWidgets,
  args: { state: "ready" },
  parameters: { layout: "padded" },
} satisfies Meta<typeof LiveWidgets>
export default meta
type Story = StoryObj<typeof meta>
export const Ready: Story = {}
export const Loading: Story = { args: { state: "loading" } }
export const Failed: Story = { name: "Error", args: { state: "error" } }
export const SingleClock: Story = {
  render: () => <ClockLifecycle mode="single" />,
}
export const PanelClock: Story = {
  render: () => <ClockLifecycle mode="panel" />,
}
export const SimultaneousClocks: Story = {
  render: () => <ClockLifecycle mode="both" />,
}
