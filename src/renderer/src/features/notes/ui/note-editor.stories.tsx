import type { Meta, StoryObj } from "@storybook/react-vite"
import { NoteEditor } from "./note-editor"
// The toolbar and Plate nodes share the editor selection and undo context.
// Keep that context together so these stories exercise the real editing behavior.
const meta = {
  title: "메모/편집기",
  component: NoteEditor,
  parameters: { layout: "fullscreen" },
  args: {
    markdown: "# 회의록\n\n**굵게** 및 *기울임*\n\n- 할 일\n- 다음 작업\n",
    onChange: () => {},
    onError: () => {},
  },
  render: (args) => (
    <NoteEditor key={`${args.markdown}:${args.disabled}`} {...args} />
  ),
} satisfies Meta<typeof NoteEditor>
export default meta
type Story = StoryObj<typeof meta>
export const Formatted: Story = {}
export const Checklist: Story = {
  args: {
    markdown:
      "## 체크리스트\n\n- [x] 기본 자료 확인\n- [ ] 세부 내용 정리\n- [ ] 다음 단계 결정\n",
  },
}
export const Empty: Story = { args: { markdown: "" } }
export const Disabled: Story = { args: { disabled: true } }
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}
