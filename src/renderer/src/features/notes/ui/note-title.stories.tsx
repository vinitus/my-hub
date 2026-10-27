import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { NoteTitle } from "./note-title"
const meta = {
  title: "메모/파일명",
  component: NoteTitle,
  args: {
    name: "회의록.md",
    busy: false,
    onRename: async (): Promise<boolean> => true,
    onSave: () => {},
  },
} satisfies Meta<typeof NoteTitle>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {
  render: function Rename(args) {
    const [name, setName] = useState(args.name)
    return (
      <NoteTitle
        {...args}
        name={name}
        onRename={async (value) => {
          setName(value)
          return true
        }}
      />
    )
  },
}
export const Busy: Story = { args: { busy: true } }
export const LongName: Story = {
  args: { name: "아주 긴 프로젝트의 다음 분기 계획 및 회의록.md" },
}
export const RenameRejected: Story = { args: { onRename: async () => false } }
