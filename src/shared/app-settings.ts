import { z } from "zod"

export const AppSettingsSchema = z
  .object({
    theme: z.enum(["dark", "light", "system"]),
    sidebarOpen: z.boolean(),
    leftSidebarWidth: z.number().int().min(200).max(640),
    rightPanelOpen: z.boolean(),
    rightPanelWidth: z.number().int().min(200).max(480),
  })
  .strict()

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "system",
  sidebarOpen: true,
  leftSidebarWidth: 288,
  rightPanelOpen: true,
  rightPanelWidth: 280,
}

export const AppSettingsPatchSchema = AppSettingsSchema.partial().strict()
export type AppSettings = z.infer<typeof AppSettingsSchema>
export type AppSettingsPatch = z.infer<typeof AppSettingsPatchSchema>
export type AppSettingsAPI = {
  read: () => Promise<AppSettings>
  update: (patch: AppSettingsPatch) => Promise<AppSettings>
}
