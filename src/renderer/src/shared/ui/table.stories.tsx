import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "./table"
const meta = {
  title: "공용 UI/Table",
  component: Table,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {},
  render: (args) => (
    <Table {...args}>
      <TableCaption>오늘의 일정</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>시간</TableHead>
          <TableHead>제목</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>09:00</TableCell>
          <TableCell>팀 회의</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
} satisfies Meta<typeof Table>
export default meta
type Story = StoryObj<typeof meta>
export const Populated: Story = {}
export const Empty: Story = {
  render: () => (
    <Table>
      <TableCaption>등록된 일정이 없습니다.</TableCaption>
      <TableBody>
        <TableRow>
          <TableCell>새 일정을 추가하세요.</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
}
