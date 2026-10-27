import { useEffect, useEffectEvent, useState } from "react"
import { NAVIGATION_ITEMS, type AppView } from "@/lib/navigation"

export function useNavigationShortcuts(onNavigate: (view: AppView) => void) {
  const [showNumbers, setShowNumbers] = useState(false)
  const navigate = useEffectEvent(onNavigate)
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      setShowNumbers(event.ctrlKey || event.key === "Control")
      if (
        !event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey ||
        event.isComposing ||
        event.defaultPrevented
      )
        return
      const item = NAVIGATION_ITEMS.find((entry) => entry.number === event.key)
      if (!item) return
      // 등록/수정 모달이 열린 동안에는 편집 중인 화면을 단축키로 전환하지 않는다.
      if (
        document.querySelector(
          '[role="dialog"][data-open], [role="alertdialog"][data-open]'
        )
      )
        return
      event.preventDefault()
      if (!event.repeat) navigate(item.id)
    }
    const keyup = (event: KeyboardEvent) => setShowNumbers(event.ctrlKey)
    const reset = () => setShowNumbers(false)
    const visibility = () => {
      if (document.hidden) reset()
    }
    window.addEventListener("keydown", keydown)
    window.addEventListener("keyup", keyup)
    window.addEventListener("blur", reset)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      window.removeEventListener("keydown", keydown)
      window.removeEventListener("keyup", keyup)
      window.removeEventListener("blur", reset)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [])
  return showNumbers
}
