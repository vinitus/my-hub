import {
  FloatingQuickMenu,
  type QuickAction,
  type QuickMenuMotion,
} from "@/shared/ui/floating-quick-menu"
import { useShortcutMenu } from "../model/use-shortcut-menu"

export function ShortcutMenu({
  actions,
  disabled = false,
  motion = "on",
}: {
  actions: readonly QuickAction[]
  disabled?: boolean
  motion?: QuickMenuMotion
}) {
  const menu = useShortcutMenu(disabled)
  return <FloatingQuickMenu {...menu} actions={actions} motion={motion} />
}
