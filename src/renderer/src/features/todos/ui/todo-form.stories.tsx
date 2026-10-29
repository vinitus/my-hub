import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Todo } from "../../../../../shared/todos"
import { TodoForm } from "./todo-workspace"

const item: Todo = {
  id: "6b49dcec-24aa-4b4e-93d4-d9c7333a7c71",
  title: "폼 상태 보존 확인",
  dueDate: "2026-11-03",
  completed: true,
  favorite: true,
}

const meta = {
  title: "할일/등록 폼",
  component: TodoForm,
  args: {
    item,
    dialog: true,
    busy: false,
    onSave: async (): Promise<boolean> => true,
    onCancel: () => {},
  },
  render: function Form(args) {
    const [attempts, setAttempts] = useState(0)
    const [saved, setSaved] = useState<Todo | null>(null)
    const [closed, setClosed] = useState(0)
    return (
      <div className="w-[420px] max-w-full p-4">
        <TodoForm
          {...args}
          onSave={async (todo) => {
            setAttempts((current) => current + 1)
            await new Promise((resolve) => setTimeout(resolve, 120))
            const success = await args.onSave(todo)
            if (success) setSaved(todo)
            return success
          }}
          onCancel={() => setClosed((current) => current + 1)}
        />
        <output className="sr-only" data-testid="todo-form-result">
          {JSON.stringify({ attempts, saved, closed })}
        </output>
      </div>
    )
  },
} satisfies Meta<typeof TodoForm>
export default meta
type Story = StoryObj<typeof meta>
export const New: Story = { args: { item: null } }
export const Editing: Story = {}
export const Rejected: Story = { args: { onSave: async () => false } }
export const ThrownError: Story = {
  args: {
    onSave: async () => {
      throw new Error("폼 저장 실패 fixture")
    },
  },
}
export const Saving: Story = { args: { busy: true } }
