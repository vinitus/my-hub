import { z } from "zod"

export const ShortcutKindSchema = z.enum(["program", "folder", "website"])
export type ShortcutKind = z.infer<typeof ShortcutKindSchema>
export const SHORTCUT_LABELS: Record<ShortcutKind, string> = {
  program: "프로그램",
  folder: "폴더",
  website: "웹사이트",
}

export function websiteUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error("https://로 시작하는 웹사이트 주소를 입력해 주세요.")
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error(
      "로그인 정보가 없는 http 또는 https 주소만 등록할 수 있습니다."
    )
  if (url.href.length > 2081) throw new Error("웹사이트 주소가 너무 깁니다.")
  return url.href
}

export const ShortcutSchema = z
  .object({
    id: z.uuid(),
    name: z
      .string()
      .trim()
      .min(1, "이름을 입력해 주세요.")
      .max(80, "이름은 80자 이내로 입력해 주세요."),
    kind: ShortcutKindSchema,
    target: z
      .string()
      .trim()
      .min(1, "실행할 대상을 지정해 주세요.")
      .max(4096)
      .refine(
        (value) =>
          ![...value].some((character) => character.charCodeAt(0) < 32),
        "대상에 제어 문자를 사용할 수 없습니다."
      ),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.kind === "website") {
      try {
        websiteUrl(item.target)
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          path: ["target"],
          message: (error as Error).message,
        })
      }
    }
  })
export type Shortcut = z.infer<typeof ShortcutSchema>
export type ShortcutSnapshot = {
  items: Shortcut[]
  revision: string
  path: string
}
export const ShortcutSaveSchema = z
  .object({ shortcut: ShortcutSchema, expectedRevision: z.string().max(100) })
  .strict()
export const ShortcutIdSchema = z
  .object({ id: z.uuid(), expectedRevision: z.string().max(100) })
  .strict()
export const ShortcutReorderSchema = z
  .object({
    ids: z.array(z.uuid()).max(500),
    expectedRevision: z.string().max(100),
  })
  .strict()
  .refine((request) => new Set(request.ids).size === request.ids.length, {
    message: "諛붾줈媛湲곕뒗 以묐났?섏? ?딉땲??",
  })
export type ShortcutSelection = { name: string; target: string }
export const ShortcutDropSchema = z
  .object({
    kind: z.enum(["path", "website"]),
    target: z.string().trim().min(1).max(4096),
  })
  .strict()
export type ShortcutsAPI = {
  icon: (request: z.infer<typeof ShortcutIdSchema>) => Promise<string | null>
  inspectDrop: (
    request: z.infer<typeof ShortcutDropSchema>
  ) => Promise<Shortcut>
  load: () => Promise<ShortcutSnapshot>
  choose: (kind: "program" | "folder") => Promise<ShortcutSelection | null>
  save: (
    request: z.infer<typeof ShortcutSaveSchema>
  ) => Promise<ShortcutSnapshot>
  remove: (
    request: z.infer<typeof ShortcutIdSchema>
  ) => Promise<ShortcutSnapshot>
  reorder: (
    request: z.infer<typeof ShortcutReorderSchema>
  ) => Promise<ShortcutSnapshot>
  launch: (request: z.infer<typeof ShortcutIdSchema>) => Promise<void>
}
