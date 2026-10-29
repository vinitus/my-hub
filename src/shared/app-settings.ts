import { z } from "zod"

export const APP_PANEL_WIDTHS = {
  left: { min: 200, max: 320, default: 288 },
  right: { min: 200, max: 480, default: 280 },
} as const

export const QuickMenuActionSchema = z.enum([
  "note",
  "todo",
  "event",
  "shortcut",
  "calculator",
  "home",
  "notes",
  "calendar",
])
export const QuickMenuItemSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("action"), action: QuickMenuActionSchema })
    .strict(),
  z.object({ kind: z.literal("shortcut"), id: z.uuid() }).strict(),
])
export type QuickMenuItem = z.infer<typeof QuickMenuItemSchema>
export type QuickMenuActionId = z.infer<typeof QuickMenuActionSchema>
export function quickMenuItemKey(item: QuickMenuItem) {
  return item.kind === "action"
    ? `action:${item.action}`
    : `shortcut:${item.id}`
}
const QuickMenuItemsSchema = z
  .array(QuickMenuItemSchema)
  .max(8)
  .refine(
    (items) => new Set(items.map(quickMenuItemKey)).size === items.length,
    "메뉴 항목은 중복할 수 없습니다."
  )

export const AppSettingsSchema = z
  .object({
    theme: z.enum(["dark", "light", "system"]),
    shortcutMenuMotion: z.enum(["on", "system", "off"]),
    shortcutMenuItems: QuickMenuItemsSchema,
    sidebarOpen: z.boolean(),
    leftSidebarWidth: z
      .number()
      .int()
      .min(APP_PANEL_WIDTHS.left.min)
      .max(APP_PANEL_WIDTHS.left.max),
    rightPanelOpen: z.boolean(),
    rightPanelWidth: z
      .number()
      .int()
      .min(APP_PANEL_WIDTHS.right.min)
      .max(APP_PANEL_WIDTHS.right.max),
  })
  .strict()

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "system",
  shortcutMenuMotion: "on",
  shortcutMenuItems: [
    { kind: "action", action: "note" },
    { kind: "action", action: "todo" },
    { kind: "action", action: "event" },
    { kind: "action", action: "shortcut" },
    { kind: "action", action: "calculator" },
  ],
  sidebarOpen: true,
  leftSidebarWidth: APP_PANEL_WIDTHS.left.default,
  rightPanelOpen: true,
  rightPanelWidth: APP_PANEL_WIDTHS.right.default,
}

export const AppSettingsPatchSchema = AppSettingsSchema.partial().strict()
export type AppSettings = z.infer<typeof AppSettingsSchema>
export type AppSettingsPatch = z.infer<typeof AppSettingsPatchSchema>
export type AppSettingsAPI = {
  read: () => Promise<AppSettings>
  update: (patch: AppSettingsPatch) => Promise<AppSettings>
}
