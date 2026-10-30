import { useEffect, useSyncExternalStore } from "react"
import { LinkIcon } from "lucide-react"
import { ShortcutIcon, type ShortcutStore } from "@/features/shortcuts"
import type { QuickAction } from "@/shared/ui/floating-quick-menu"
import { QUICK_MENU_ACTIONS } from "../config/quick-menu"
import { modeItemKey } from "../../../../shared/item-mode"
import {
  quickMenuItemKey,
  type QuickMenuActionId,
  type QuickMenuItem,
} from "../../../../shared/app-settings"

export function useConfiguredQuickMenu({
  items,
  store,
  settingsOpen,
  handlers,
  noteBusy,
  allows = () => true,
}: {
  items: readonly QuickMenuItem[]
  store: ShortcutStore
  settingsOpen: boolean
  handlers: Record<QuickMenuActionId, () => void>
  noteBusy: boolean
  allows?: (key: string) => boolean
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const needsShortcuts =
    settingsOpen || items.some((item) => item.kind === "shortcut")
  useEffect(() => {
    if (needsShortcuts) void store.initialize()
  }, [needsShortcuts, store])
  const shortcuts = (state.snapshot?.items ?? []).filter((item) =>
    allows(modeItemKey("shortcut", item.id))
  )
  const options = [
    ...QUICK_MENU_ACTIONS.map((action) => ({
      item: { kind: "action" as const, action: action.id },
      label: action.label,
      icon: <action.icon />,
    })),
    ...shortcuts.map((shortcut) => ({
      item: { kind: "shortcut" as const, id: shortcut.id },
      label: shortcut.name,
      icon: (
        <ShortcutIcon item={shortcut} revision={state.snapshot!.revision} />
      ),
    })),
  ]
  const actions: QuickAction[] = items
    .filter(
      (item) =>
        item.kind !== "shortcut" || allows(modeItemKey("shortcut", item.id))
    )
    .map((item) => {
      if (item.kind === "action") {
        const action = QUICK_MENU_ACTIONS.find(
          (action) => action.id === item.action
        )!
        return {
          id: quickMenuItemKey(item),
          label: action.label,
          icon: <action.icon />,
          disabled: item.action === "note" && noteBusy,
          onSelect: handlers[item.action],
        }
      }
      const shortcut = shortcuts.find((shortcut) => shortcut.id === item.id)
      return {
        id: quickMenuItemKey(item),
        label: shortcut?.name ?? "없는 바로가기",
        icon:
          shortcut && state.snapshot ? (
            <ShortcutIcon item={shortcut} revision={state.snapshot.revision} />
          ) : (
            <LinkIcon />
          ),
        disabled: !shortcut || state.busy || state.loading,
        onSelect: () => {
          if (shortcut) void store.launch(shortcut)
        },
      }
    })
  return { actions, options, error: state.error }
}
