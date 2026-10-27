import type { Meta, StoryObj } from "@storybook/react-vite"
import type { CalendarEvent } from "../../../../shared/calendar"
import { sidebarScheduleStatus } from "./schedule-status"
import { ScheduleStatusCard } from "./schedule-status-card"

const now = new Date(2026, 9, 28, 8, 36).getTime()
const event = (
  id: string,
  title: string,
  start: string,
  end: string
): CalendarEvent => ({
  id,
  title,
  start,
  end,
  description: "",
  color: "blue",
  allDay: false,
  referenceUrls: [],
  openLinks: "never",
  notifyOS: false,
  notifyInApp: false,
})

const meta = {
  title: "현황/일정 상태 카드",
  component: ScheduleStatusCard,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story, context) => (
      <div className={context.parameters.theme === "dark" ? "dark" : undefined}>
        <div
          className="rounded-xl bg-sidebar p-3 text-sidebar-foreground"
          style={{ width: context.parameters.cardWidth ?? 288 }}
        >
          <Story />
        </div>
      </div>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof ScheduleStatusCard>

export default meta
type Story = StoryObj<typeof meta>

export const NextIn24Minutes: Story = {
  name: "다음 일정까지 24분",
  args: {
    now,
    status: sidebarScheduleStatus(
      [
        event(
          "next",
          "팀 회의",
          "2026-10-28T09:00:00+09:00",
          "2026-10-28T10:00:00+09:00"
        ),
      ],
      now
    ),
  },
}

export const NextIn5Minutes: Story = {
  name: "5분 후 · 주황색",
  args: {
    now,
    status: sidebarScheduleStatus(
      [
        event(
          "urgent",
          "팀 회의",
          new Date(now + 5 * 60_000).toISOString(),
          new Date(now + 30 * 60_000).toISOString()
        ),
      ],
      now
    ),
  },
}

export const StartingSoon: Story = {
  name: "곧 시작 · 주황색",
  args: {
    now,
    status: sidebarScheduleStatus(
      [
        event(
          "soon",
          "팀 회의",
          new Date(now + 30_000).toISOString(),
          new Date(now + 30 * 60_000).toISOString()
        ),
      ],
      now
    ),
  },
}

export const OngoingAndNext: Story = {
  name: "진행 중 일정과 다음 일정",
  args: {
    now,
    status: sidebarScheduleStatus(
      [
        event(
          "current",
          "아침 작업",
          "2026-10-28T08:00:00+09:00",
          "2026-10-28T08:50:00+09:00"
        ),
        event(
          "next",
          "팀 회의",
          "2026-10-28T09:56:00+09:00",
          "2026-10-28T10:30:00+09:00"
        ),
      ],
      now
    ),
  },
}

export const OngoingNoMoreToday: Story = {
  name: "진행 중이며 오늘 남은 일정 없음",
  args: {
    now,
    status: sidebarScheduleStatus(
      [
        event(
          "current",
          "아침 작업",
          "2026-10-28T08:00:00+09:00",
          "2026-10-28T08:50:00+09:00"
        ),
      ],
      now
    ),
  },
}

export const NextTomorrow: Story = {
  name: "다음 일정 내일 09:00",
  args: {
    now,
    status: sidebarScheduleStatus(
      [
        event(
          "tomorrow",
          "기획 회의",
          "2026-10-29T09:00:00+09:00",
          "2026-10-29T10:00:00+09:00"
        ),
      ],
      now
    ),
  },
}

export const NoScheduledEvents: Story = {
  name: "예정된 일정 없음",
  args: {
    now,
    status: sidebarScheduleStatus([], now),
  },
}

export const Dark: Story = {
  name: "다크 모드",
  args: NextIn24Minutes.args,
  parameters: { theme: "dark" },
}

export const NarrowWithLongTitle: Story = {
  name: "좁은 사이드바와 긴 제목",
  args: {
    now,
    status: sidebarScheduleStatus(
      [
        event(
          "long-title",
          "My Hub 다음 버전 기능 검토 및 디자인 개선 회의",
          "2026-10-28T09:56:00+09:00",
          "2026-10-28T10:30:00+09:00"
        ),
      ],
      now
    ),
  },
  parameters: { cardWidth: 248 },
}
