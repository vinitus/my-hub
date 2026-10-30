import { z } from "zod"

export const ModeShortcutSchema = z.enum(["ctrl+shift+m", "ctrl+alt+shift+m"])
export type ModeShortcut = z.infer<typeof ModeShortcutSchema>

export const MODE_SHORTCUTS: Record<ModeShortcut, string> = {
  "ctrl+shift+m": "Ctrl+Shift+M",
  "ctrl+alt+shift+m": "Ctrl+Alt+Shift+M",
}

export function matchesModeShortcut(
  event: {
    ctrlKey: boolean
    altKey: boolean
    shiftKey: boolean
    metaKey: boolean
    key: string
    code: string
    isComposing: boolean
    keyCode?: number
    repeat: boolean
    defaultPrevented: boolean
  },
  shortcut: ModeShortcut
) {
  return (
    !event.defaultPrevented &&
    !event.repeat &&
    !event.isComposing &&
    event.keyCode !== 229 &&
    event.ctrlKey &&
    event.shiftKey &&
    !event.metaKey &&
    event.altKey === (shortcut === "ctrl+alt+shift+m") &&
    (event.code === "KeyM" || event.key.toLowerCase() === "m")
  )
}
