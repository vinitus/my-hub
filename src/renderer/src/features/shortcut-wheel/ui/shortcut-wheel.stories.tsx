import type { Meta, StoryObj } from "@storybook/react-vite"
import { Input } from "@/shared/ui/input"
import { ShortcutWheel, ShortcutWheelOverlay } from "./shortcut-wheel"

const meta = {
  title: "바로가기 휠/애니메이션",
  component: ShortcutWheelOverlay,
  parameters: { layout: "fullscreen" },
  args: { position: { x: 180, y: 240 } },
  render: (args) => (
    <div className="h-screen">
      <ShortcutWheelOverlay {...args} />
    </div>
  ),
} satisfies Meta<typeof ShortcutWheelOverlay>
export default meta
type Story = StoryObj<typeof meta>
export const Open: Story = {}
export const NearEdge: Story = { args: { position: { x: 16, y: 16 } } }
export const Closed: Story = { args: { position: null } }
export const HoldToOpen: Story = {
  render: () => (
    <div className="h-screen p-6">
      <p className="mb-4 text-sm text-muted-foreground">
        Ctrl 또는 휠 버튼을 길게 누르면 커서 위치에 표시됩니다.
      </p>
      <Input aria-label="휠 단축키 테스트 입력" className="max-w-sm" />
      <ShortcutWheel />
    </div>
  ),
}
