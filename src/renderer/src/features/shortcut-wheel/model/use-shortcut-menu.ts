import { useEffect, useRef, useState } from "react"
import { hasOpenDialog } from "@/shared/lib/has-open-dialog"
import type {
  QuickMenuPoint,
  QuickMenuSize,
} from "@/shared/lib/quick-menu-layout"
import type { QuickAction } from "@/shared/ui/floating-quick-menu"
import { useHoldQuickMenu } from "./use-hold-quick-menu"

export function useShortcutMenu(disabled: boolean) {
  const boundsRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  // Keep the last anchor during the closing transition; it isn't derived state.
  const [menu, setMenu] = useState<{
    open: boolean
    anchor: QuickMenuPoint | null
  }>({ open: false, anchor: null })
  const [size, setSize] = useState<QuickMenuSize>({ width: 0, height: 0 })
  const open = menu.open && !disabled
  function close() {
    setMenu((current) => (current.open ? { ...current, open: false } : current))
  }
  useHoldQuickMenu(
    boundsRef,
    disabled,
    (point) => {
      const box = boundsRef.current?.getBoundingClientRect()
      if (!box) return
      if (!open)
        previousFocus.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null
      setMenu({
        open: true,
        anchor: { x: point.x - box.left, y: point.y - box.top },
      })
    },
    () => {
      close()
      if (open && !hasOpenDialog())
        previousFocus.current?.focus({ preventScroll: true })
    }
  )

  useEffect(() => {
    const element = boundsRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() =>
      menuRef.current?.focus({ preventScroll: true })
    )
    const closeMenu = () =>
      setMenu((current) =>
        current.open ? { ...current, open: false } : current
      )
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !boundsRef.current?.contains(event.target)
      )
        closeMenu()
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      closeMenu()
      previousFocus.current?.focus({ preventScroll: true })
    }
    const checkDialog = () => {
      if (hasOpenDialog()) closeMenu()
    }
    // Some dialogs open programmatically without moving focus immediately.
    const dialogs = new MutationObserver(checkDialog)
    dialogs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-open"],
    })
    document.addEventListener("pointerdown", outside, true)
    document.addEventListener("keydown", keydown, true)
    document.addEventListener("focusin", checkDialog)
    return () => {
      cancelAnimationFrame(frame)
      dialogs.disconnect()
      document.removeEventListener("pointerdown", outside, true)
      document.removeEventListener("keydown", keydown, true)
      document.removeEventListener("focusin", checkDialog)
    }
  }, [open])

  function select(action: QuickAction) {
    close()
    previousFocus.current?.focus({ preventScroll: true })
    action.onSelect()
  }
  return {
    boundsRef,
    menuRef,
    open,
    anchor: menu.anchor,
    size,
    onClose: close,
    onSelect: select,
  }
}
