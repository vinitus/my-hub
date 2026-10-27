import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./card"
import { Button } from "./button"
const meta = {
  title: "공용 UI/Card",
  component: Card,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { className: "w-80" },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>다음 일정</CardTitle>
        <CardDescription>2026년 10월 28일</CardDescription>
      </CardHeader>
      <CardContent>오전 9시 팀 회의</CardContent>
      <CardFooter>
        <Button>일정 보기</Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Narrow: Story = { args: { className: "w-60" } }
