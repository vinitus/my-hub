import type { Meta, StoryObj } from "@storybook/react-vite"
import { CodexModelSettings } from "./codex-model-settings"
import { adapter, connection } from "./codex-story-fixtures"
const meta = {
  title: "설정/모델 선택",
  component: CodexModelSettings,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: {
    active: true,
    busy: false,
    connection: { ...connection, status: "connected" },
    api: adapter("connected"),
  },
} satisfies Meta<typeof CodexModelSettings>
export default meta
type Story = StoryObj<typeof meta>
export const Connected: Story = {}
export const Busy: Story = { args: { busy: true } }
export const NoModels: Story = {
  args: {
    connection: {
      ...connection,
      status: "connected",
      models: [],
      modelsError: "모델 목록을 불러오지 못했습니다.",
    },
  },
}
export const SaveError: Story = {
  args: {
    api: {
      ...adapter("connected"),
      savePreferences: async () => {
        throw new Error("fixture failure")
      },
    },
  },
}
