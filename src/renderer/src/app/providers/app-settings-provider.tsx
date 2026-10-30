/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { AppSettingsStore } from "../model/app-settings-store"

type AppSettingsContextValue = ReturnType<AppSettingsStore["getSnapshot"]> & {
  updateSettings: AppSettingsStore["update"]
  refreshSettings: AppSettingsStore["refresh"]
}
const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(
  undefined
)

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [store] = useState(
    () =>
      new AppSettingsStore(window.api?.settings, {
        read: () => localStorage.getItem("theme"),
        write: (theme) => localStorage.setItem("theme", theme),
        remove: () => localStorage.removeItem("theme"),
      })
  )
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => {
    void store.initialize()
    return window.api?.settings?.onChange?.(() => void store.refresh(true))
  }, [store])
  const value = useMemo(
    () => ({
      ...state,
      updateSettings: store.update,
      refreshSettings: store.refresh,
    }),
    [state, store]
  )
  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext)
  if (!context)
    throw new Error("useAppSettings must be used within its provider")
  return context
}
