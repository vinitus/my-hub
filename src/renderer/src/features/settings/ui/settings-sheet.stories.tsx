import type { Meta, StoryObj } from "@storybook/react-vite"
import { ThemeProvider } from "@/shared/lib/theme-provider"
import { SettingsSheet } from "./settings-sheet"
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
