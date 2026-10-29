import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ShortcutStore } from "@/features/shortcuts"
import { ShortcutMenu } from "@/features/shortcut-wheel"
import {
  DEFAULT_APP_SETTINGS,
  type QuickMenuActionId,
} from "../../../../shared/app-settings"
import { QUICK_MENU_ACTIONS } from "../config/quick-menu"
import { useConfiguredQuickMenu } from "../model/use-configured-quick-menu"

const shortcut = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "folder" as const,
  name: "작업 폴더",
  target: "C:\\Fixtures",
}
const snapshot = {
  items: [shortcut],
  revision: "fixture-0",
  path: "fixtures/shortcuts.json",
}
function ConfiguredMenuPreview() {
  const [selected, setSelected] = useState("")
  const [store] = useState(
    () =>
      new ShortcutStore({
        load: async () => snapshot,
        save: async () => snapshot,
        remove: async () => snapshot,
        reorder: async () => snapshot,
        launch: async () => {
          setSelected("shortcut-launched")
        },
        choose: async () => null,
        icon: async () => null,
        inspectDrop: async () => shortcut,
      })
  )
  const menu = useConfiguredQuickMenu({
    items: [
      ...DEFAULT_APP_SETTINGS.shortcutMenuItems,
      { kind: "action", action: "home" },
      { kind: "action", action: "notes" },
      { kind: "shortcut", id: shortcut.id },
    ],
    store,
    settingsOpen: false,
    noteBusy: false,
    handlers: Object.fromEntries(
      QUICK_MENU_ACTIONS.map((action) => [
        action.id,
        () => setSelected(action.id),
      ])
    ) as Record<QuickMenuActionId, () => void>,
  })
  return (
    <div className="relative h-[520px] bg-background p-4">
      <p>Ctrl 또는 휠 버튼을 누른 채 항목을 선택하세요.</p>
      <output data-testid="configured-menu-result">{selected}</output>
      <ShortcutMenu actions={menu.actions} motion="off" />
    </div>
  )
}
const meta = {
  title: "앱/커서 메뉴 연결",
  component: ConfiguredMenuPreview,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ConfiguredMenuPreview>
export default meta
type Story = StoryObj<typeof meta>
export const RegisteredShortcut: Story = {}
