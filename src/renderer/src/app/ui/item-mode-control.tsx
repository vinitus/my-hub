import { UserRoundIcon } from "lucide-react"
import { Button } from "@/shared/ui/button"
import {
  MODE_SHORTCUTS,
  type ModeShortcut,
} from "../../../../shared/mode-shortcut"

export function ItemModeControl({
  enabled,
  personal,
  pending = false,
  shortcut,
  onToggle,
}: {
  enabled: boolean
  personal: boolean
  pending?: boolean
  shortcut: ModeShortcut
  onToggle: () => void
}) {
  if (!enabled || !personal) return null
  const description = `개인 항목 포함 표시 중 · ${MODE_SHORTCUTS[shortcut]}로 업무 모드 전환`
  return (
    <Button
      data-mode-control
      data-mode="personal"
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      aria-label={`개인 모드 · ${description}`}
      aria-keyshortcuts={
        enabled
          ? MODE_SHORTCUTS[shortcut].replace("Ctrl", "Control")
          : undefined
      }
      title={description}
      onClick={onToggle}
      className="ml-1 h-7 shrink-0 gap-1.5 rounded-full border border-violet-700 bg-violet-700 px-3 text-xs font-semibold text-white shadow-none hover:bg-violet-800 hover:text-white dark:hover:bg-violet-800"
    >
      <UserRoundIcon aria-hidden="true" className="size-3.5" />
      <span role="status" aria-live="polite">
        개인 모드
      </span>
    </Button>
  )
}
