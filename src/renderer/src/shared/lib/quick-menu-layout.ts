export type QuickMenuPoint = { x: number; y: number }
export type QuickMenuSize = { width: number; height: number }

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(value, high))
}

// Local coordinates only. Measuring the workspace and reading the pointer
// belong to the controller, so these rules also work with fixed story fixtures.
export function getQuickMenuLayout(
  size: QuickMenuSize,
  anchor: QuickMenuPoint | null,
  count: number
) {
  const radius = count > 5 ? 100 : 80
  const compact =
    size.width < 2 * (radius + 44) ||
    size.height < 2 * (radius + 42) ||
    count > 8
  const listWidth = Math.min(208, Math.max(0, size.width - 16))
  const listHeight = Math.min(count * 58 - 4, Math.max(0, size.height - 16))
  return {
    layout: compact ? "list" : "circle",
    x: compact
      ? clamp(anchor?.x ?? size.width / 2, 8, size.width - listWidth - 8)
      : clamp(
          anchor?.x ?? size.width / 2,
          radius + 44,
          size.width - radius - 44
        ),
    y: compact
      ? clamp(anchor?.y ?? size.height / 2, 8, size.height - listHeight - 8)
      : clamp(
          anchor?.y ?? size.height / 2,
          radius + 42,
          size.height - radius - 42
        ),
    items: Array.from({ length: count }, (_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / count
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
    }),
  }
}
