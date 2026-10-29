import {
  useShortcutWheel,
  type WheelPosition,
} from "../model/use-shortcut-wheel"
import "./shortcut-wheel.css"

const items = Array.from({ length: 8 }, (_, index) => {
  const angle = (index * Math.PI) / 4 - Math.PI / 2
  return { x: Math.cos(angle) * 104, y: Math.sin(angle) * 104 }
})

// 동작을 연결하기 전의 장식용 미리보기다. 포커스와 클릭을 가로채지 않는다.
export function ShortcutWheelOverlay({
  position,
}: {
  position: WheelPosition | null
}) {
  if (!position) return null
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      <div
        data-slot="shortcut-wheel"
        className="shortcut-wheel"
        style={{ left: position.x, top: position.y }}
      >
        {items.map((item, index) => (
          <div
            key={index}
            className="shortcut-wheel-item-position"
            style={{ left: 107 + item.x, top: 107 + item.y }}
          >
            <div
              data-slot="shortcut-wheel-item"
              className="shortcut-wheel-item"
              style={{ animationDelay: `${index * 45}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ShortcutWheel() {
  return <ShortcutWheelOverlay position={useShortcutWheel()} />
}
