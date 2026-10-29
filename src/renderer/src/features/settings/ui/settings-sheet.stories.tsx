import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState, type ComponentProps } from "react"
import { FolderIcon } from "lucide-react"
import { ThemeProvider } from "@/shared/lib/theme-provider"
import { SettingsSheet } from "./settings-sheet"
import { DEFAULT_APP_SETTINGS } from "../../../../../shared/app-settings"
const meta = {
  title: "설정/설정 시트",
  component: SettingsSheet,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story, context) => (
      <ThemeProvider
        key={context.globals.theme}
        storageKey={`storybook:theme:${context.globals.theme}`}
        defaultTheme={context.globals.theme === "dark" ? "dark" : "light"}
      >
        <Story />
      </ThemeProvider>
    ),
  ],
  args: {
    open: true,
    onOpenChange: () => {},
    directory: "C:\\Fixtures\\Notes",
    ready: true,
    busy: false,
    error: "",
    onChooseDirectory: () => {},
    shortcutMenuMotion: "on",
    onShortcutMenuMotionChange: () => {},
    shortcutMenuItems: DEFAULT_APP_SETTINGS.shortcutMenuItems,
    onShortcutMenuItemsChange: () => {},
    quickMenuOptions: [
      { item: { kind: "action", action: "note" }, label: "메모 작성" },
      { item: { kind: "action", action: "todo" }, label: "할 일 추가" },
      { item: { kind: "action", action: "event" }, label: "일정 추가" },
      { item: { kind: "action", action: "shortcut" }, label: "바로가기 추가" },
      { item: { kind: "action", action: "calculator" }, label: "계산기" },
      { item: { kind: "action", action: "home" }, label: "홈 열기" },
      { item: { kind: "action", action: "notes" }, label: "메모 열기" },
      { item: { kind: "action", action: "calendar" }, label: "캘린더 열기" },
      {
        item: { kind: "shortcut", id: "11111111-1111-4111-8111-111111111111" },
        label: "작업 폴더",
        icon: <FolderIcon />,
      },
      {
        item: { kind: "shortcut", id: "22222222-2222-4222-8222-222222222222" },
        label: "프로젝트 사이트",
        icon: (
          <img
            alt=""
            draggable={false}
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cpath fill='%232563eb' d='M0 0h64v64H0z'/%3E%3Ccircle cx='32' cy='32' r='16' fill='white'/%3E%3C/svg%3E"
          />
        ),
      },
    ],
    connectionPanel: <p>연결 상태별 UI는 설정/Codex 연결에서 확인합니다.</p>,
  },
} satisfies Meta<typeof SettingsSheet>
export default meta
type Story = StoryObj<typeof meta>
export const Ready: Story = {}
export const Loading: Story = { args: { directory: undefined, ready: false } }
export const Error: Story = {
  args: { error: "메모 폴더를 변경하지 못했습니다." },
}
export const Busy: Story = { args: { busy: true } }
function MotionPreferencePreview(args: ComponentProps<typeof SettingsSheet>) {
  const [motion, setMotion] = useState(args.shortcutMenuMotion)
  const [items, setItems] = useState(args.shortcutMenuItems)
  return (
    <SettingsSheet
      {...args}
      shortcutMenuMotion={motion}
      onShortcutMenuMotionChange={setMotion}
      shortcutMenuItems={items}
      onShortcutMenuItemsChange={setItems}
    />
  )
}
export const MotionPreference: Story = {
  render: (args) => <MotionPreferencePreview {...args} />,
}
export const RegisteredShortcuts: Story = {
  args: {
    shortcutMenuItems: [
      { kind: "shortcut", id: "11111111-1111-4111-8111-111111111111" },
      { kind: "shortcut", id: "22222222-2222-4222-8222-222222222222" },
    ],
  },
  render: (args) => <MotionPreferencePreview {...args} />,
}
