import { useRef, useState, type HTMLAttributes } from "react"

type Options = {
  width: number
  min: number
  max: number
  enabled: boolean
  direction: 1 | -1
  measure?: () => number
  onCommit: (width: number) => void | Promise<unknown>
}
type Drag = { pointerId: number | null; x: number; width: number }

// A draft is local to a resize interaction; persisted widths remain in app settings.
export function usePanelResize({
  width,
  min,
  max,
  enabled,
  direction,
  measure,
  onCommit,
}: Options) {
  const drag = useRef<Drag | null>(null)
  const [draft, setDraft] = useState<number | null>(null)
  const currentWidth = draft ?? width
  const clamp = (value: number) =>
    Math.max(min, Math.min(max, Math.round(value)))
  const cancel = () => {
    drag.current = null
    setDraft(null)
  }
  const commit = async (session: Drag, value: number) => {
    session.pointerId = null
    setDraft(value)
    try {
      if (value !== width) await onCommit(value)
    } finally {
      // An earlier save must not clear a newer drag or keyboard interaction.
      if (drag.current === session) cancel()
    }
  }
  const separatorProps: HTMLAttributes<HTMLDivElement> = {
    role: "separator",
    "aria-orientation": "vertical",
    "aria-valuemin": min,
    "aria-valuemax": max,
    "aria-valuenow": currentWidth,
    "aria-disabled": !enabled,
    tabIndex: enabled ? 0 : -1,
    onPointerDown(event) {
      if (!enabled || event.button !== 0 || !event.isPrimary) return
      event.preventDefault()
      event.currentTarget.focus()
      event.currentTarget.setPointerCapture(event.pointerId)
      const startWidth = measure?.() ?? currentWidth
      drag.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        width: startWidth,
      }
      setDraft(startWidth)
    },
    onPointerMove(event) {
      const session = drag.current
      if (!enabled || session?.pointerId !== event.pointerId) return
      setDraft(clamp(session.width + direction * (event.clientX - session.x)))
    },
    onPointerUp(event) {
      const session = drag.current
      if (!enabled || session?.pointerId !== event.pointerId) return
      return commit(
        session,
        clamp(session.width + direction * (event.clientX - session.x))
      )
    },
    onPointerCancel: cancel,
    onLostPointerCapture() {
      if (drag.current?.pointerId != null) cancel()
    },
    onKeyDown(event) {
      if (!enabled) return
      if (event.key === "Escape") {
        cancel()
        return
      }
      const next =
        event.key === "ArrowLeft"
          ? currentWidth - 10 * direction
          : event.key === "ArrowRight"
            ? currentWidth + 10 * direction
            : event.key === "Home"
              ? min
              : event.key === "End"
                ? max
                : null
      if (next === null) return
      event.preventDefault()
      const value = clamp(next)
      if (value === currentWidth) return
      const session = { pointerId: null, x: 0, width: currentWidth }
      drag.current = session
      return commit(session, value)
    },
  }
  return {
    width: currentWidth,
    resizing: draft !== null,
    cancel,
    separatorProps,
  }
}
