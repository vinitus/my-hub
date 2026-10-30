import { useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "sonner"
import { hasOpenDialog } from "@/shared/lib/has-open-dialog"
import type { AppSettings } from "../../../../shared/app-settings"
import { itemVisibility } from "../../../../shared/item-mode"
import { matchesModeShortcut } from "../../../../shared/mode-shortcut"

export function useItemMode({
  settings,
  ready,
  settingsOpen,
  setMode = window.api?.settings?.setPersonalMode,
  canTransition = () => true,
  onTransition = () => {},
}: {
  settings: AppSettings
  ready: boolean
  settingsOpen: boolean
  setMode?: (personal: boolean) => Promise<boolean>
  canTransition?: () => boolean
  onTransition?: () => void | Promise<void>
}) {
  const [personal, setPersonal] = useState(false)
  const [wasEnabled, setWasEnabled] = useState(settings.modeEnabled)
  if (wasEnabled !== settings.modeEnabled) {
    setWasEnabled(settings.modeEnabled)
    if (!settings.modeEnabled) setPersonal(false)
  }
  const [pending, setPending] = useState(false)
  const lock = useRef(false)
  const active = settings.modeEnabled && personal
  const allows =
    ready && !pending ? itemVisibility(settings, active) : () => false
  async function change(next: boolean) {
    if (!ready || !settings.modeEnabled || lock.current) return
    if (!canTransition()) {
      toast.info("진행 중인 저장·실행이 끝난 뒤 모드를 전환해 주세요.", {
        toasterId: "home-actions",
      })
      return
    }
    if (hasOpenDialog() && !settingsOpen) {
      toast.info("등록·편집 창을 닫은 뒤 모드를 전환해 주세요.", {
        toasterId: "home-actions",
      })
      return
    }
    if (!setMode) {
      toast.error("모드 전환을 위해 앱을 다시 시작해 주세요.", {
        toasterId: "home-actions",
      })
      return
    }
    lock.current = true
    setPending(true)
    try {
      const personal = await setMode(next)
      setPersonal(personal)
      await onTransition()
    } catch {
      toast.error("모드를 전환하지 못했습니다. 현재 모드를 유지합니다.", {
        toasterId: "home-actions",
      })
    } finally {
      lock.current = false
      setPending(false)
      // 숨겨진 편집기에 포커스를 남기지 않는다. 설정 창 안의 포커스는 유지한다.
      requestAnimationFrame(() => {
        const focused = document.activeElement
        if (focused === document.body || focused?.closest("[hidden], [inert]"))
          (
            document.querySelector<HTMLButtonElement>("[data-mode-control]") ??
            document.querySelector<HTMLButtonElement>(
              "[data-mode-focus-target]"
            )
          )?.focus({ preventScroll: true })
      })
    }
  }
  const toggle = useEffectEvent((event: KeyboardEvent) => {
    if (
      !ready ||
      !settings.modeEnabled ||
      !matchesModeShortcut(event, settings.modeShortcut)
    )
      return
    event.preventDefault()
    event.stopPropagation()
    void change(!active)
  })
  useEffect(() => {
    window.addEventListener("keydown", toggle, true)
    return () => window.removeEventListener("keydown", toggle, true)
  }, [])
  return {
    personal: active,
    pending,
    allows,
    change,
    scope: `${ready}:${pending}:${active ? "personal" : "work"}:${settings.modeEnabled}:${JSON.stringify(settings.personalItemKeys)}`,
  }
}
