import { z } from "zod"

export const TodoSchema = z
  .object({
    id: z.uuid(),
    title: z
      .string()
      .trim()
      .min(1, "제목을 입력해 주세요.")
      .max(200, "제목은 200자 이내로 입력해 주세요."),
    dueDate: z.iso.date("올바른 마감일을 입력해 주세요."),
    completed: z.boolean(),
  })
  .strict()
export type Todo = z.infer<typeof TodoSchema>
export type TodoSnapshot = { items: Todo[]; revision: string; path: string }
export const TodoSaveSchema = z
  .object({ todo: TodoSchema, expectedRevision: z.string().max(100) })
  .strict()
export const TodoIdSchema = z
  .object({ id: z.uuid(), expectedRevision: z.string().max(100) })
  .strict()
export type TodosAPI = {
  load: () => Promise<TodoSnapshot>
  save: (request: z.infer<typeof TodoSaveSchema>) => Promise<TodoSnapshot>
  remove: (request: z.infer<typeof TodoIdSchema>) => Promise<TodoSnapshot>
}
