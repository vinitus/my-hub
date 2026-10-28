import { z } from "zod"

export const APP_PANEL_WIDTHS = {
  left: { min: 200, max: 640, default: 288 },
  right: { min: 200, max: 480, default: 280 },
} as const

export const AppSettingsSchema = z
  .object({
    theme: z.enum(["dark", "light", "system"]),
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
