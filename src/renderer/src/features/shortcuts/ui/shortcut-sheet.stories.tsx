import type { Meta, StoryObj } from "@storybook/react-vite"
import { ShortcutSheet } from "./shortcut-sheet"
const item = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "문서",
  kind: "website" as const,
  target: "https://example.com/",
}
const meta = {
  title: "바로가기/편집",
  component: ShortcutSheet,
  parameters: { layout: "fullscreen" },
  args: {
    item,
    existing: true,
    busy: false,
    error: "",
    onChoose: async () => ({ name: "작업 폴더", target: "C:\\Fixtures" }),
    onSave: async () => true,
    onDelete: async () => true,
    onClose: () => {},
  },
} satisfies Meta<typeof ShortcutSheet>
export default meta
type Story = StoryObj<typeof meta>
export const Website: Story = {}
export const New: Story = {
  args: { existing: false, item: { ...item, name: "", target: "" } },
}
export const Folder: Story = {
  args: {
    item: {
      ...item,
      kind: "folder",
      target: "C:\\Fixtures\\Projects\\Long project folder name",
    },
  },
}
export const Program: Story = {
  args: {
    item: { ...item, kind: "program", target: "C:\\Fixtures\\Editor.lnk" },
  },
}
export const Saving: Story = { args: { busy: true } }
export const Error: Story = {
  args: { error: "대상을 찾지 못했습니다. 경로를 확인해 주세요." },
}
