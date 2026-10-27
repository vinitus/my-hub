import type { ReactNode } from "react"
import { ThemeProvider } from "@/shared/lib/theme-provider"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  )
}
