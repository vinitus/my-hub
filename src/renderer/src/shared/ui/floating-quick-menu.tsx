import type { CSSProperties, ReactNode, Ref } from "react"
import {
  getQuickMenuLayout,
  type QuickMenuPoint,
  type QuickMenuSize,
} from "@/shared/lib/quick-menu-layout"
import "./floating-quick-menu.css"

export type QuickAction = {
  id: string
  label: string
  icon: ReactNode
  onSelect: () => void
  disabled?: boolean
}
export type QuickMenuMotion = "on" | "system" | "off"

function QuickActionButton({
  action,
  open,
  index,
  x,
  y,
  onSelect,
}: {
  action: QuickAction
  open: boolean
  index: number
  x: number
  y: number
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className="floating-quick-action"
      data-action={action.id}
      title={action.label}
      disabled={action.disabled}
      tabIndex={open ? 0 : -1}
      style={
        {
          "--action-x": `${x}px`,
          "--action-y": `${y}px`,
          "--action-delay": `${open ? index * 40 : 0}ms`,
        } as CSSProperties
      }
      onClick={onSelect}
    >
      <span className="floating-quick-action-icon">{action.icon}</span>
      <span className="floating-quick-action-label">{action.label}</span>
    </button>
  )
}

// Controlled presentation: the feature owns subscriptions, focus and actions.
export function FloatingQuickMenu({
  actions,
  open,
  anchor,
  size,
  boundsRef,
  menuRef,
  onClose,
  onSelect,
  motion = "system",
}: {
  actions: readonly QuickAction[]
  open: boolean
  anchor: QuickMenuPoint | null
  size: QuickMenuSize
  boundsRef?: Ref<HTMLDivElement>
  menuRef?: Ref<HTMLDivElement>
  onClose: () => void
  onSelect: (action: QuickAction) => void
  motion?: QuickMenuMotion
}) {
  const geometry = getQuickMenuLayout(size, anchor, actions.length)
  // Keep the actual cursor as the origin; only destinations are shifted to fit.
  const origin = geometry.layout === "circle" && anchor ? anchor : geometry
  return (
    <div
      ref={boundsRef}
      className="floating-quick-menu-bounds"
      data-slot="floating-quick-menu"
    >
      <div
        className="floating-quick-menu"
        data-open={open ? "true" : "false"}
        data-layout={geometry.layout}
        data-motion={motion}
        style={{ left: origin.x, top: origin.y }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) onClose()
        }}
      >
        <div
          ref={menuRef}
          tabIndex={-1}
          role="group"
          aria-label="빠른 작업"
          aria-hidden={!open}
          inert={!open}
          data-quick-menu-control
          className="floating-quick-actions"
        >
          {actions.map((action, index) => {
            return (
              <QuickActionButton
                key={action.id}
                action={action}
                open={open}
                index={index}
                x={geometry.items[index].x + geometry.x - origin.x}
                y={geometry.items[index].y + geometry.y - origin.y}
                onSelect={() => onSelect(action)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
