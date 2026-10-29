import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CalendarStore } from "@/entities/calendar-event"
import CalendarWorkspace from "./calendar-page"

function LauncherNavigation() {
  const [store] = useState(() => {
    const snapshot = {
      events: [],
      revision: "fixture-0",
      path: "fixtures/calendar.json",
    }
    return new CalendarStore({
      load: async () => snapshot,
      save: async () => snapshot,
      remove: async () => snapshot,
      openLinks: async () => {},
      chooseFile: async () => null,
      onReminder: () => () => {},
    })
  })
  const [focus, setFocus] = useState({ id: 1, date: "2026-11-13" })
  return (
    <div className="flex h-svh flex-col">
      <button
        type="button"
        onClick={() =>
          setFocus((current) => ({ id: current.id + 1, date: "2026-10-30" }))
        }
      >
        오늘 일정 (고정 날짜)
      </button>
      <CalendarWorkspace store={store} focusRequest={focus} />
    </div>
  )
}
const meta = {
  title: "페이지/캘린더 런처 이동",
  component: LauncherNavigation,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LauncherNavigation>
export default meta
type Story = StoryObj<typeof meta>
export const FocusDate: Story = {}
