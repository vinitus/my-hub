import type { Meta, StoryObj } from "@storybook/react-vite"
import { CalendarReminderCard } from "./calendar-reminder-center"
const meta = {
  title: "캘린더/앱 내 알림",
  component: CalendarReminderCard,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: {
    item: { id: "fixture", title: "팀 회의", openLinks: "never" },
    onOpenLinks: () => {},
    onDismiss: () => {},
  },
} satisfies Meta<typeof CalendarReminderCard>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const OpenLinks: Story = {
  args: {
    item: { id: "fixture", title: "팀 회의", openLinks: "on-notification" },
  },
}
export const LongTitle: Story = {
  args: {
    item: {
      id: "fixture",
      title: "다음 분기 프로젝트 계획과 작업 분담을 논의하는 전체 팀 회의",
      openLinks: "never",
    },
  },
}
