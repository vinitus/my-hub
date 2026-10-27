import type { Meta, StoryObj } from "@storybook/react-vite"
import { EventSheet } from "./event-sheet"
import type { CalendarEvent } from "../../../../../shared/calendar"
const event = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "팀 회의",
  description: "다음 주 작업 검토",
  allDay: false,
  start: "2026-10-28T09:00:00+09:00",
  end: "2026-10-28T10:00:00+09:00",
  color: "blue",
  referenceUrls: ["https://example.com/agenda", "https://example.com/notes"],
  notifyOS: true,
  notifyInApp: true,
  openLinks: "never",
} satisfies CalendarEvent
const meta = {
  title: "캘린더/일정 편집",
  component: EventSheet,
  parameters: { layout: "fullscreen" },
  args: {
    event,
    existing: true,
    busy: false,
    serverError: "",
    onSave: async () => true,
    onDelete: async () => true,
    onClose: () => {},
    onChooseFile: async () => "C:\\Fixtures\\agenda.md",
  },
} satisfies Meta<typeof EventSheet>
export default meta
type Story = StoryObj<typeof meta>
export const Existing: Story = {}
export const New: Story = {
  args: { existing: false, event: { ...event, title: "", referenceUrls: [] } },
}
export const AllDay: Story = {
  args: {
    event: { ...event, allDay: true, start: "2026-10-28", end: "2026-10-29" },
  },
}
export const AutoOpenLinks: Story = {
  args: {
    event: {
      ...event,
      openLinks: "at-start",
      notifyOS: false,
      notifyInApp: false,
    },
  },
}
export const Saving: Story = { args: { busy: true } }
export const Error: Story = {
  args: {
    serverError: "다른 창에서 일정이 변경되었습니다. 다시 확인해 주세요.",
  },
}
