import { useState, type ComponentProps } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ItemModeSettings } from "./item-mode-settings"
import { DEFAULT_APP_SETTINGS } from "../../../../../shared/app-settings"
import { ITEM_KIND_LABELS } from "../../../../../shared/item-mode"

function Preview(
  args: ComponentProps<typeof ItemModeSettings> & { failSave?: boolean }
) {
  const [settings, setSettings] = useState(args.settings)
  const [personal, setPersonal] = useState(args.personal)
  return (
    <ItemModeSettings
      {...args}
      settings={settings}
      personal={personal}
      onPersonalChange={setPersonal}
      onChange={async (patch) => {
        await new Promise((resolve) => setTimeout(resolve, 80))
        if (args.failSave) return false
        setSettings((current) => ({ ...current, ...patch }))
        return true
      }}
    />
  )
}
const meta = {
  title: "설정/업무 개인 모드",
  component: ItemModeSettings,
  render: (args) => (
    <div className="mx-auto max-w-lg p-4">
      <Preview {...args} />
    </div>
  ),
  args: {
    settings: {
      ...DEFAULT_APP_SETTINGS,
      modeEnabled: true,
      personalItemKeys: ["note:private"],
    },
    personal: false,
    busy: false,
    items: Object.entries(ITEM_KIND_LABELS).map(([kind, title]) => ({
      key: `${kind}:private`,
      kind: kind as keyof typeof ITEM_KIND_LABELS,
      title: `${title} 개인 항목`,
    })),
    onChange: async () => true,
    onPersonalChange: () => {},
  },
} satisfies Meta<typeof ItemModeSettings>
export default meta
type Story = StoryObj<typeof meta>
export const Work: Story = {}
export const Personal: Story = { args: { personal: true } }
export const Disabled: Story = { args: { settings: DEFAULT_APP_SETTINGS } }
export const Busy: Story = { args: { busy: true } }
export const SaveFailure: Story = {
  render: (args) => (
    <div className="mx-auto max-w-lg p-4">
      <Preview {...args} failSave />
    </div>
  ),
}
