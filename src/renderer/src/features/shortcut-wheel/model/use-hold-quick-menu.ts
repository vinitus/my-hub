import { useEffect, useEffectEvent, type RefObject } from "react"
import { hasOpenDialog } from "@/shared/lib/has-open-dialog"

// Only the initiating key/button owns the hold. Keep it pressed to select an
// action; releasing it cancels both a pending timer and an already open menu.
export function useHoldQuickMenu(
  bounds: RefObject<HTMLDivElement | null>,
  disabled: boolean,
  onOpen: (point: { x: number; y: number }) => void,
  onClose: () => void
) {
  const open = useEffectEvent(onOpen)
  const close = useEffectEvent(onClose)
  useEffect(() => {
    let pointer: { x: number; y: number } | null = null
    let source: "control" | "middle" | null = null
    let blocked = false
    let opened = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const cancel = () => {
      clearTimeout(timer)
      timer = undefined
      source = null
      opened = false
    }
    const inside = () => {
      const box = bounds.current?.getBoundingClientRect()
      return (
        box &&
        pointer &&
        pointer.x >= box.left &&
        pointer.x <= box.right &&
        pointer.y >= box.top &&
        pointer.y <= box.bottom
      )
    }
    const start = (kind: typeof source) => {
      cancel()
      if (disabled || hasOpenDialog() || !inside()) return
      source = kind
      timer = setTimeout(() => {
        timer = undefined
        if (pointer && inside() && !hasOpenDialog()) {
          opened = true
          open(pointer)
        }
      }, 200)
    }
    const move = (event: MouseEvent) => {
      pointer = { x: event.clientX, y: event.clientY }
      if (!inside()) {
        cancel()
        close()
      }
    }
    const down = (event: MouseEvent) => {
      move(event)
      if (
        event.button === 1 &&
        !event.defaultPrevented &&
        !disabled &&
        inside() &&
        !hasOpenDialog()
      ) {
        event.preventDefault()
        start("middle")
      } else if (!opened) {
        blocked = event.ctrlKey
        cancel()
      }
    }
    const up = (event: MouseEvent) => {
      if (event.button === 1 && source === "middle") {
        cancel()
        close()
      }
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Control") {
        if (
          !event.repeat &&
          !blocked &&
          !event.altKey &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.isComposing &&
          !event.defaultPrevented
        )
          start("control")
      } else if (event.ctrlKey || event.metaKey || event.key === "Escape") {
        blocked = event.ctrlKey
        cancel()
        if (event.key !== "Escape") close()
      }
    }
    const keyup = (event: KeyboardEvent) => {
      if (event.key === "Control") {
        blocked = false
        if (source === "control") {
          cancel()
          close()
        }
      }
    }
    const reset = () => {
      blocked = false
      cancel()
      close()
    }
    const visibility = () => {
      if (document.hidden) reset()
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("mousedown", down, true)
    window.addEventListener("mouseup", up)
    window.addEventListener("keydown", keydown, true)
    window.addEventListener("keyup", keyup)
    window.addEventListener("blur", reset)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      cancel()
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mousedown", down, true)
      window.removeEventListener("mouseup", up)
      window.removeEventListener("keydown", keydown, true)
      window.removeEventListener("keyup", keyup)
      window.removeEventListener("blur", reset)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [bounds, disabled])
}
