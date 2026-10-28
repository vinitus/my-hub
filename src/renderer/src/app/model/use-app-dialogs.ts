import { useEffect, useState } from "react"
import { readCodexSetupChoice } from "@/features/settings"
import { hasOpenDialog } from "@/shared/lib/has-open-dialog"

export function useAppDialogs() {
  const [commandOpen, setCommandOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [codexSetup, setCodexSetup] = useState<"intro" | "login" | null>(() => {
    if (!window.api?.codex) return null
    const choice = readCodexSetupChoice()
    return choice === "started" ? "login" : choice === null ? "intro" : null
  })

  useEffect(() => {
    const api = window.api?.codex
    if (!api?.check || readCodexSetupChoice() !== "completed") return
    let active = true
    const showLogin = () => {
      // 조회 중 열린 다른 모달을 가리지 않는다. 종료된 구독의 늦은 응답도 무시한다.
      if (active && !hasOpenDialog()) setCodexSetup("login")
    }
    void api.check().then((state) => {
      if (
        state.status === "missing" ||
        state.status === "disconnected" ||
        state.status === "error"
      )
        showLogin()
    }, showLogin)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const openSettings = (event: KeyboardEvent) => {
      if (
        !event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey ||
        event.isComposing ||
        (event.code !== "KeyO" && event.key.toLowerCase() !== "o")
      )
        return
      event.preventDefault()
      if (!event.repeat && !hasOpenDialog()) setSettingsOpen(true)
    }
    window.addEventListener("keydown", openSettings, true)
    return () => window.removeEventListener("keydown", openSettings, true)
  }, [])

  return {
    commandOpen,
    setCommandOpen,
    settingsOpen,
    setSettingsOpen,
    codexSetup,
    setCodexSetup,
    codexPromptOpen: codexSetup !== null && !settingsOpen && !commandOpen,
  }
}
