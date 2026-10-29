import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  CalculatorIcon,
  CalendarPlusIcon,
  FilePlusIcon,
  LayoutGridIcon,
  ListTodoIcon,
} from "lucide-react"
import { FloatingQuickMenu, type QuickAction } from "./floating-quick-menu"

const fixtures = [
  { id: "note", label: "메모 작성", icon: <FilePlusIcon /> },
  { id: "todo", label: "할 일 추가", icon: <ListTodoIcon /> },
  { id: "event", label: "일정 추가", icon: <CalendarPlusIcon /> },
  { id: "shortcut", label: "바로가기 추가", icon: <LayoutGridIcon /> },
  { id: "calculator", label: "계산기", icon: <CalculatorIcon /> },
]
const actions: QuickAction[] = fixtures.map((action) => ({
  ...action,
  onSelect: () => {},
}))

const meta = {
  title: "공용 UI/FloatingQuickMenu",
  component: FloatingQuickMenu,
  parameters: { layout: "fullscreen" },
  args: {
    actions,
    open: true,
    anchor: null,
    size: { width: 320, height: 400 },
    onClose: () => {},
    onSelect: () => {},
  },
  decorators: [
    (Story, context) => (
      <div
        className="relative bg-background"
        style={{
          width: context.args.size.width,
          height: context.args.size.height,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FloatingQuickMenu>
export default meta
type Story = StoryObj<typeof meta>
export const Closed: Story = { args: { open: false } }
export const Open: Story = {}
export const NearEdge: Story = { args: { anchor: { x: 8, y: 8 } } }
export const SmallWorkspace: Story = {
  args: { size: { width: 220, height: 260 } },
}
export const DisabledAction: Story = {
  args: {
    actions: actions.map((action) => ({
      ...action,
      disabled: action.id === "note",
    })),
  },
}
export const EightActions: Story = {
  args: {
    actions: [
      ...actions,
      ...["홈 열기", "메모 열기", "캘린더 열기"].map((label, index) => ({
        id: `extra-${index}`,
        label,
        icon: <LayoutGridIcon />,
        onSelect: () => {},
      })),
    ],
  },
}
