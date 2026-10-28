import { z } from "zod"

export const MAX_COMMAND_LENGTH = 500
export const CommandInputSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_COMMAND_LENGTH)
export const CommandResultSchema = z
  .object({
    status: z.enum([
      "needs-connection",
      "success",
      "error",
      "clarification",
      "partial",
      "preview",
    ]),
    message: z.string().max(10000),
    preview: z
      .object({
        token: z.uuid(),
        changes: z
          .array(
            z
              .object({
                id: z.uuid(),
                domain: z.enum(["calendar", "todos"]),
                operation: z.enum(["create", "update", "remove"]),
                before: z.string().nullable(),
                after: z.string().nullable(),
              })
              .strict()
          )
          .max(20),
      })
      .strict()
      .optional(),
    undoToken: z.uuid().optional(),
    changed: z.array(z.enum(["calendar", "todos"])),
  })
  .strict()
export type CommandResult = z.infer<typeof CommandResultSchema>
export type CommandAPI = {
  execute: (input: string) => Promise<CommandResult>
  apply: (token: string) => Promise<CommandResult>
  discard: (token: string) => Promise<void>
  undo: (token: string) => Promise<CommandResult>
  onChange: (
    callback: (domains: CommandResult["changed"]) => void
  ) => () => void
}

// 모델은 작업 계획만 반환한다. UUID, revision, 파일 경로는 main이 결정한다.
export const CommandPlanSchema = z
  .object({
    kind: z.enum(["actions", "answer", "clarification"]),
    message: z.string().min(1).max(4000),
    actions: z
      .array(
        z
          .object({
            domain: z.enum(["calendar", "todos"]),
            operation: z.enum(["create", "update", "remove"]),
            id: z.string().nullable(),
            todo: z
              .object({
                title: z.string(),
                dueDate: z.string(),
                completed: z.boolean(),
              })
              .strict()
              .nullable(),
            event: z
              .object({
                title: z.string(),
                description: z.string(),
                color: z.enum(["blue", "green", "orange", "purple", "rose"]),
                allDay: z.boolean(),
                start: z.string(),
                end: z.string(),
              })
              .strict()
              .nullable(),
          })
          .strict()
      )
      .max(20),
  })
  .strict()
export type CommandPlan = z.infer<typeof CommandPlanSchema>
