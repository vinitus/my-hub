import { useEffect, useState } from "react"
import { hasOpenDialog } from "@/shared/lib/has-open-dialog"

export const SHORTCUT_WHEEL_HOLD_MS = 400
export type WheelPosition = { x: number; y: number }

export function useShortcutWheel() {
  const [position, setPosition] = useState<WheelPosition | null>(null)
  useEffect(() => {
    let pointer: WheelPosition | null = null
    let source: "control" | "middle" | null = null
    let controlBlocked = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const cancel = () => {
      clearTimeout(timer)
      timer = undefined
      source = null
      setPosition(null)
    }
    const reset = () => {
      controlBlocked = false
      cancel()
    }
    const start = (next: "control" | "middle") => {
      if (hasOpenDialog()) return
      cancel()
      source = next
      timer = setTimeout(() => {
        timer = undefined
        if (hasOpenDialog()) {
          cancel()
          return
        }
        // 열린 뒤에는 중심을 고정해 향후 원형 메뉴의 항목으로 커서를 옮길 수 있게 한다.
        setPosition(pointer ?? { x: innerWidth / 2, y: innerHeight / 2 })
      }, SHORTCUT_WHEEL_HOLD_MS)
    }
    const move = (event: MouseEvent) => {
      pointer = { x: event.clientX, y: event.clientY }
    }
    const down = (event: MouseEvent) => {
      move(event)
      if (event.button === 1 && !event.defaultPrevented && !hasOpenDialog()) {
        // 휠 클릭의 브라우저 자동 스크롤과 겹치지 않게 한다. 일반 휠 스크롤은 유지한다.
        event.preventDefault()
        start("middle")
      } else if (source === "control") {
        controlBlocked = true
        cancel()
      }
    }
    const up = (event: MouseEvent) => {
      if (event.button === 1 && source === "middle") cancel()
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        controlBlocked = event.ctrlKey
        cancel()
        return
      }
      if (event.key === "Control") {
        if (
          !event.repeat &&
          !controlBlocked &&
          !event.altKey &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.isComposing &&
          !event.defaultPrevented
        )
          start("control")
      } else if (event.ctrlKey) {
        // Ctrl+H/K/S/숫자 등 기존 조합을 누른 뒤 남은 Ctrl 반복 입력으로는 열지 않는다.
        controlBlocked = true
        if (source === "control") cancel()
      }
    }
    const keyup = (event: KeyboardEvent) => {
      if (event.key === "Control") {
        controlBlocked = false
        if (source === "control") cancel()
      }
    }
    const visibility = () => {
      if (document.hidden) reset()
    }
    const leave = (event: MouseEvent) => {
      if (event.relatedTarget === null) reset()
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("mousedown", down, true)
    window.addEventListener("mouseup", up)
    window.addEventListener("keydown", keydown)
    window.addEventListener("keyup", keyup)
    window.addEventListener("blur", reset)
    window.addEventListener("mouseout", leave)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mousedown", down, true)
      window.removeEventListener("mouseup", up)
      window.removeEventListener("keydown", keydown)
      window.removeEventListener("keyup", keyup)
      window.removeEventListener("blur", reset)
      window.removeEventListener("mouseout", leave)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [])
  return position
}
