import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { CalendarEvent } from "../../../../../shared/calendar"
import type { Todo } from "../../../../../shared/todos"
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
  const [completed, setCompleted] = useState("")
  return (
    <div className="relative flex h-[700px] w-full justify-end">
      {launched && (
        <span role="status" className="absolute bottom-2 left-2 text-xs">
          {launched} 실행 요청
        </span>
      )}
      {completed && (
        <span role="status" className="absolute bottom-2 left-36 text-xs">
          {completed} 완료 요청
        </span>
      )}
      <StatusPanel
        {...args}
        open={open}
        onOpenChange={setOpen}
        onLaunch={(item) => setLaunched(item.name)}
        onToggleTodo={(todo, isCompleted) =>
          setCompleted(isCompleted ? todo.title : "")
        }
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
    todos: [],
    onOpenChange: () => {},
    onLaunch: () => {},
    onOpenCalendar: () => {},
    onOpenShortcuts: () => {},
    onOpenTodos: () => {},
    onToggleTodo: () => {},
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
    todos: [
      {
        id: "7f35dce4-3e37-49d3-a39b-301d5e1fe63c",
        title: "이번 주 일정 정리",
        dueDate: "2026-10-30",
        completed: false,
        favorite: true,
      },
      {
        id: "f20e749f-6a32-419b-aa56-12c242bda9ef",
        title: "기한 없는 문서 초안 작성",
        completed: false,
      },
    ] satisfies Todo[],
  },
}
export const Empty: Story = {}
export const Loading: Story = {
  args: { calendarLoading: true, shortcutsLoading: true, todosLoading: true },
}
export const Error: Story = {
  args: {
    calendarError: "일정을 불러오지 못했습니다.",
    shortcutsError: "바로가기를 불러오지 못했습니다.",
    todosError: "할일을 불러오지 못했습니다.",
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
