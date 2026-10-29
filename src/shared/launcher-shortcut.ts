export const LAUNCHER_SHORTCUTS = {
  "ctrl+k": "Ctrl+K",
  "ctrl+alt+k": "Ctrl+Alt+K",
  "ctrl+shift+space": "Ctrl+Shift+Space",
} as const
export type LauncherShortcut = keyof typeof LAUNCHER_SHORTCUTS

export function matchesLauncherShortcut(
  event: {
    ctrlKey: boolean
    altKey: boolean
    shiftKey: boolean
    metaKey: boolean
    key: string
    code: string
    isComposing: boolean
  },
  shortcut: LauncherShortcut
) {
  if (!event.ctrlKey || event.metaKey || event.isComposing) return false
  const space = shortcut === "ctrl+shift+space"
  return (
    event.altKey === (shortcut === "ctrl+alt+k") &&
    event.shiftKey === space &&
    (space
      ? event.code === "Space" || event.key === " "
      : event.code === "KeyK" || event.key.toLowerCase() === "k")
  )
}
