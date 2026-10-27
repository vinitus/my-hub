import type { Meta, StoryObj } from "@storybook/react-vite"
import { CodexSetupPrompt } from "./codex-setup-prompt"
import { adapter } from "./codex-story-fixtures"
const meta = {
  title: "설정/첫 연결 안내",
  component: CodexSetupPrompt,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    initialStep: "intro",
    onDismiss: () => {},
    onRememberChoice: () => {},
    api: adapter("disconnected"),
  },
} satisfies Meta<typeof CodexSetupPrompt>
export default meta
type Story = StoryObj<typeof meta>
export const Intro: Story = {}
export const Login: Story = { args: { initialStep: "login" } }
export const Connected: Story = {
  args: { initialStep: "login", api: adapter("connected") },
}
