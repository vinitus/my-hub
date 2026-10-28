import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { TodoWorkspace } from "./todo-workspace"

const meta = {
  title: "할일/작업 화면",
  component: TodoWorkspace,
  args: {
    items: [
      {
        id: "6b49dcec-24aa-4b4e-93d4-d9c7333a7c71",
        title: "프로젝트 계획 정리",
        dueDate: "2026-10-30",
        completed: false,
        favorite: true,
      },
      {
        id: "761cdedf-ef12-4800-8bbc-8212e46f5e3a",
        title: "회의록 공유",
        dueDate: "2026-10-28",
        completed: true,
        favorite: false,
      },
    ],
    revision: "fixture",
    ready: true,
    busy: false,
    error: "",
    notice: "",
    onSave: async () => true,
    onRemove: async () => true,
    onRefresh: () => {},
  },
  render: function Workspace(args) {
    const [items, setItems] = useState(args.items)
    return (
      <TodoWorkspace
        {...args}
        items={items}
        onSave={async (todo) => {
          setItems((current) =>
            current.some((item) => item.id === todo.id)
              ? current.map((item) => (item.id === todo.id ? todo : item))
              : [...current, todo]
          )
          return true
        }}
        onRemove={async (id) => {
          setItems((current) => current.filter((item) => item.id !== id))
          return true
        }}
      />
    )
  },
} satisfies Meta<typeof TodoWorkspace>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Empty: Story = { args: { items: [] } }
export const Undated: Story = {
  args: {
    items: [
      {
        id: "58c81594-3baf-46e2-9700-c7fa688a3e73",
        title: "기한 없이 진행하는 할일",
        completed: false,
      },
    ],
  },
}
export const Loading: Story = { args: { ready: false, items: [], busy: true } }
export const Saving: Story = { args: { busy: true } }
export const Error: Story = {
  args: { error: "목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요." },
}
export const LongTitle: Story = {
  args: {
    items: [
      {
        ...meta.args.items[0],
        title:
          "긴 제목의 할일을 작은 화면에서도 읽고 수정할 수 있도록 줄바꿈을 확인합니다. ".repeat(
            4
          ),
      },
    ],
  },
}
