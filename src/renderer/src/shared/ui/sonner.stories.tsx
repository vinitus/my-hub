import type { Meta, StoryObj } from "@storybook/react-vite"
import { Toaster } from "./sonner"
import { toast } from "sonner"
import { Button } from "./button"
const meta = {
  title: "공용 UI/Toaster",
  component: Toaster,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { theme: "light" },
  render: (args, context) => (
    <>
      <Toaster
        {...args}
        theme={context.globals.theme === "dark" ? "dark" : "light"}
      />
      <Button
        onClick={() => toast.success("저장했습니다.", { id: "story-success" })}
      >
        성공 알림
      </Button>
    </>
  ),
} satisfies Meta<typeof Toaster>
export default meta
type Story = StoryObj<typeof meta>
export const Success: Story = {}
export const Error: Story = {
  render: (args, context) => (
    <>
      <Toaster
        {...args}
        theme={context.globals.theme === "dark" ? "dark" : "light"}
      />
      <Button
        onClick={() =>
          toast.error("저장하지 못했습니다.", { id: "story-error" })
        }
      >
        오류 알림
      </Button>
    </>
  ),
}
