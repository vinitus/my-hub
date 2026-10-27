import type { Meta, StoryObj } from "@storybook/react-vite"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs"
const meta = {
  title: "공용 UI/Tabs",
  component: Tabs,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { defaultValue: "notes" },
  render: (args) => (
    <Tabs {...args} className="w-72">
      <TabsList>
        <TabsTrigger value="notes">메모</TabsTrigger>
        <TabsTrigger value="calendar">캘린더</TabsTrigger>
        <TabsTrigger value="disabled" disabled>
          준비 중
        </TabsTrigger>
      </TabsList>
      <TabsContent value="notes">메모 목록</TabsContent>
      <TabsContent value="calendar">오늘의 일정</TabsContent>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
