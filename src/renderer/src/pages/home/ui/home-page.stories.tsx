import type { Meta, StoryObj } from "@storybook/react-vite"
import { HomePage } from "./home-page"

const meta = {
  title: "홈/다용도 화면",
  component: HomePage,
  parameters: { layout: "fullscreen" },
  args: {
    noteName: "회의 아이디어.md",
    noteBusy: false,
    noteError: "",
    onSaveMemo: async () => true,
    onOpenNotes: () => {},
    onCreateTodo: () => {},
    onCreateEvent: () => {},
    onCreateShortcut: () => {},
  },
  tags: ["autodocs"],
} satisfies Meta<typeof HomePage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Saving: Story = { args: { noteBusy: true } }
export const SaveError: Story = {
  args: { noteError: "메모 저장 폴더에 접근할 수 없습니다." },
}
