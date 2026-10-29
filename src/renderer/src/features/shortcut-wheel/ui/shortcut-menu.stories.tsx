import { useState, type ComponentProps } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  CalculatorIcon,
  CalendarPlusIcon,
  FilePlusIcon,
  LayoutGridIcon,
  ListTodoIcon,
} from "lucide-react"
import { Textarea } from "@/shared/ui/textarea"
import { ShortcutMenu } from "./shortcut-menu"

const fixtures = [
  { id: "note", label: "메모 작성", icon: <FilePlusIcon /> },
  { id: "todo", label: "할 일 추가", icon: <ListTodoIcon /> },
  { id: "event", label: "일정 추가", icon: <CalendarPlusIcon /> },
  { id: "shortcut", label: "바로가기 추가", icon: <LayoutGridIcon /> },
  { id: "calculator", label: "계산기", icon: <CalculatorIcon /> },
]
function InteractivePreview({
  actions,
  disabled = false,
  motion,
}: ComponentProps<typeof ShortcutMenu>) {
  const [selected, setSelected] = useState("없음")
  return (
    <div className="relative h-[520px] w-full bg-background p-4">
      <Textarea aria-label="낙서장 테스트" className="h-64" />
      <p role="status">선택한 작업: {selected}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        커서를 이 영역에 두고 Ctrl 또는 휠 버튼을 200ms 누르세요. 놓으면
        닫힙니다.
      </p>
      <ShortcutMenu
        disabled={disabled}
        motion={motion}
        actions={actions.map((action) => ({
          ...action,
          onSelect: () => {
            action.onSelect()
            setSelected(action.label)
          },
        }))}
      />
    </div>
  )
}
const meta = {
  title: "바로가기 휠/커서 메뉴",
  component: ShortcutMenu,
  parameters: { layout: "fullscreen" },
  args: {
    motion: "system",
    actions: fixtures.map((action) => ({ ...action, onSelect: () => {} })),
  },
  render: (args) => <InteractivePreview {...args} />,
} satisfies Meta<typeof ShortcutMenu>
export default meta
type Story = StoryObj<typeof meta>
export const Interactive: Story = {}
export const Disabled: Story = { args: { disabled: true } }
export const MotionEnabled: Story = { args: { motion: "on" } }
export const MotionDisabled: Story = { args: { motion: "off" } }
export const EightActions: Story = {
  args: {
    actions: [
      ...fixtures.map((action) => ({ ...action, onSelect: () => {} })),
      ...["홈 열기", "메모 열기", "캘린더 열기"].map((label, index) => ({
        id: `extra-${index}`,
        label,
        icon: <LayoutGridIcon />,
        onSelect: () => {},
      })),
    ],
  },
}
export const OffsetWorkspace: Story = {
  decorators: [
    (Story) => (
      <div className="ml-20 w-[calc(100%-6rem)] pt-16">
        <Story />
      </div>
    ),
  ],
}
