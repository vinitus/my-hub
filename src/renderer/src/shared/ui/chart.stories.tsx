import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "./chart"
import { BarChart, Bar, XAxis } from "recharts"
const meta = {
  title: "공용 UI/ChartContainer",
  component: ChartContainer,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    config: { count: { label: "일정 수", color: "var(--primary)" } },
    className: "h-60 w-80",
    children: (
      <BarChart
        data={[
          { day: "월", count: 3 },
          { day: "화", count: 5 },
          { day: "수", count: 2 },
        ]}
      >
        <XAxis dataKey="day" />
        <Bar
          dataKey="count"
          fill="var(--color-count)"
          isAnimationActive={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    ),
  },
} satisfies Meta<typeof ChartContainer>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
