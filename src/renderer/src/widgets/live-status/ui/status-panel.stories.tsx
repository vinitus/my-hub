import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { CalendarEvent } from "../../../../../shared/calendar"
import { StatusPanel, type StatusPanelProps } from "./status-panel"

const now = new Date(2026, 9, 28, 8, 36).getTime()
function event(
  id: string,
  minutes: number,
  overrides: Partial<CalendarEvent> = {}
): CalendarEvent {
  return {
    id,
    title: "기획 회의",
    description: "",
    color: "blue",
    allDay: false,
    start: new Date(now + minutes * 60_000).toISOString(),
    end: new Date(now + (minutes + 60) * 60_000).toISOString(),
    referenceUrls: [],
    openLinks: "never",
    notifyOS: true,
    notifyInApp: true,
    ...overrides,
  } as CalendarEvent
}

function InteractivePanel(args: StatusPanelProps) {
  const [open, setOpen] = useState(args.open)
  const [launched, setLaunched] = useState("")
  return (
    <div className="relative flex h-[700px] w-full justify-end">
      {launched && (
        <span role="status" className="absolute bottom-2 left-2 text-xs">
          {launched} 실행 요청
        </span>
      )}
      <StatusPanel
        {...args}
        open={open}
        onOpenChange={setOpen}
        onLaunch={(item) => setLaunched(item.name)}
      />
    </div>
  )
}
const meta = {
  title: "현황/우측 패널",
  component: StatusPanel,
  parameters: { layout: "fullscreen" },
  render: (args) => <InteractivePanel {...args} />,
  args: {
    open: true,
    now,
    events: [],
    shortcuts: [],
    onOpenChange: () => {},
    onLaunch: () => {},
    onOpenCalendar: () => {},
    onOpenShortcuts: () => {},
  },
  tags: ["autodocs"],
} satisfies Meta<typeof StatusPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Populated: Story = {
  args: {
    events: [
      event("ongoing", -10, { title: "진행 중이라 숨겨지는 일정" }),
      event("meeting", 24, {
        referenceUrls: [
          "https://example.com/meeting",
          "C:\\Documents\\회의자료.pdf",
        ],
        openLinks: "at-start",
      }),
      event("notification", 120, {
        title: "문서 검토",
        referenceUrls: ["https://example.com/docs"],
        openLinks: "on-notification",
      }),
      event("never", 180, {
        title: "자동 실행 안 함",
        referenceUrls: ["https://example.com/never"],
      }),
      event("tomorrow", 24 * 60, {
        title: "내일 일정",
        referenceUrls: ["C:\\Documents\\계획.md"],
        openLinks: "at-start",
      }),
    ],
    shortcuts: [
      {
        id: "browser",
        name: "프로젝트 문서",
        kind: "website",
        target: "https://example.com/docs",
      },
      {
        id: "folder",
        name: "작업 폴더",
        kind: "folder",
        target: "C:\\Projects",
      },
    ],
  },
}
export const Empty: Story = {}
export const Loading: Story = {
  args: { calendarLoading: true, shortcutsLoading: true },
}
export const Error: Story = {
  args: {
    calendarError: "일정을 불러오지 못했습니다.",
    shortcutsError: "바로가기를 불러오지 못했습니다.",
  },
}
export const Collapsed: Story = { args: { open: false } }
export const LongContent: Story = {
  args: {
    ...Populated.args,
    events: [
      event("long", 5, {
        title: "아주 긴 회의 제목과 프로젝트 문서 검토 일정입니다",
        referenceUrls: [
          "C:\\Projects\\아주 긴 경로와 파일 이름이 있는 자료 폴더\\미팅 자료.pdf",
        ],
        openLinks: "at-start",
      }),
    ],
  },
}
