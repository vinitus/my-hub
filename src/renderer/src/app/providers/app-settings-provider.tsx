/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type AppSettingsPatch,
} from "../../../../shared/app-settings"

type AppSettingsContextValue = {
  settings: AppSettings
  ready: boolean
  error: string
  updateSettings: (patch: AppSettingsPatch) => Promise<boolean>
}

const AppSettingsContext = React.createContext<
  AppSettingsContextValue | undefined
>(undefined)

function savedTheme(): AppSettings["theme"] | undefined {
  const value = localStorage.getItem("theme")
  return value === "dark" || value === "light" || value === "system"
    ? value
    : undefined
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "앱 설정을 저장하지 못했습니다."
}

export function AppSettingsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const api = window.api?.settings
  const [settings, setSettings] = React.useState<AppSettings>(() => ({
    ...DEFAULT_APP_SETTINGS,
    ...(savedTheme() ? { theme: savedTheme()! } : {}),
  }))
  const settingsRef = React.useRef(settings)
  const [ready, setReady] = React.useState(!api)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (!api) return
    let active = true
    void api
      .read()
      .then(async (stored) => {
        if (!active) return
        const theme = savedTheme()
        const loaded = theme ? { ...stored, theme } : stored
        settingsRef.current = loaded
        setSettings(loaded)
        if (theme && theme !== stored.theme) {
          const migrated = await api.update({ theme })
          if (!active) return
          settingsRef.current = migrated
          setSettings(migrated)
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause))
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [api])

  const updateSettings = React.useCallback(
    async (patch: AppSettingsPatch) => {
      try {
        const next = api
          ? await api.update(patch)
          : { ...settingsRef.current, ...patch }
        settingsRef.current = next
        setSettings(next)
        setError("")
        return true
      } catch (cause) {
        setError(errorMessage(cause))
        return false
      }
    },
    [api]
  )

  const value = React.useMemo(
    () => ({ settings, ready, error, updateSettings }),
    [settings, ready, error, updateSettings]
  )
  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  const context = React.useContext(AppSettingsContext)
  if (!context)
    throw new Error("useAppSettings must be used within its provider")
  return context
}
