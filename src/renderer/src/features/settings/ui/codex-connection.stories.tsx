import type { Meta, StoryObj } from "@storybook/react-vite"
import { CodexConnectionPanel } from "./codex-connection"
import { adapter, connection } from "./codex-story-fixtures"
const meta = {
  title: "설정/Codex 연결",
  component: CodexConnectionPanel,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: { active: true, api: adapter("disconnected") },
} satisfies Meta<typeof CodexConnectionPanel>
export default meta
type Story = StoryObj<typeof meta>
export const Disconnected: Story = {}
export const Missing: Story = { args: { api: adapter("missing") } }
export const Checking: Story = { args: { api: adapter("checking") } }
export const Connecting: Story = { args: { api: adapter("connecting") } }
export const Connected: Story = { args: { api: adapter("connected") } }
export const Error: Story = {
  args: {
    api: {
      ...adapter("error"),
      check: async () => ({
        ...connection,
        status: "error",
        error: "연결 상태를 확인하지 못했습니다.",
      }),
    },
  },
}
