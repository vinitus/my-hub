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
    ]),
    message: z.string().max(10000),
    changed: z.array(z.enum(["calendar", "todos"])),
  })
  .strict()
export type CommandResult = z.infer<typeof CommandResultSchema>
export type CommandAPI = {
  execute: (input: string) => Promise<CommandResult>
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
