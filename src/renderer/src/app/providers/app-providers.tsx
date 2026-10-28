import type { ReactNode } from "react"
import { ThemeProvider } from "@/shared/lib/theme-provider"
import { AppSettingsProvider, useAppSettings } from "./app-settings-provider"

function SettingsThemeProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useAppSettings()
  return (
    <ThemeProvider
      theme={settings.theme}
      onThemeChange={(theme) => void updateSettings({ theme })}
    >
      {children}
    </ThemeProvider>
  )
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppSettingsProvider>
      <SettingsThemeProvider>{children}</SettingsThemeProvider>
    </AppSettingsProvider>
  )
}
