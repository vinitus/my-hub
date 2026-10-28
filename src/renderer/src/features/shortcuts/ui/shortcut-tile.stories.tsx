import type { Meta, StoryObj } from "@storybook/react-vite"
import { FolderIcon, GlobeIcon, MonitorIcon } from "lucide-react"
import { ShortcutTile } from "./shortcut-tile"
const item = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "website" as const,
  name: "프로젝트 문서",
  target: "https://example.com/docs",
}
const meta = {
  title: "바로가기/타일",
  component: ShortcutTile,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: {
    item,
    disabled: false,
    icon: <GlobeIcon />,
    onLaunch: () => {},
    onEdit: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof ShortcutTile>
export default meta
type Story = StoryObj<typeof meta>
export const Website: Story = {}
export const Folder: Story = {
  args: {
    item: {
      ...item,
      kind: "folder",
      target: "C:/Fixtures/Projects/Long folder name",
    },
    icon: <FolderIcon />,
  },
}
export const Program: Story = {
  args: {
    item: { ...item, kind: "program", target: "C:/Fixtures/Editor.lnk" },
    icon: <MonitorIcon />,
  },
}
export const NoIcon: Story = { args: { icon: null } }
export const LongName: Story = {
  args: {
    item: {
      ...item,
      name: "아주 긴 프로젝트의 문서와 작업 폴더를 여는 바로가기",
    },
  },
}
export const Disabled: Story = { args: { disabled: true } }
