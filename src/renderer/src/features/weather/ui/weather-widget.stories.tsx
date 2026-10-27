import type { Meta, StoryObj } from "@storybook/react-vite"
import { WeatherWidgetView } from "./weather-widget"
const location = {
  id: 1,
  name: "역삼동",
  region: "서울특별시 강남구",
  country: "대한민국",
  latitude: 37.5,
  longitude: 127.0,
}
const reading = {
  temperature: 18,
  feelsLike: 17,
  code: 0,
  isDay: true,
  minimum: 11,
  maximum: 20,
  observedAt: 1793142000000,
  fetchedAt: 1793142000000,
  timeZone: "Asia/Seoul",
}
const state = {
  location,
  reading,
  loading: false,
  busy: false,
  error: "",
  refresh: async () => {},
  choose: async () => true,
  search: async () => [location],
}
const meta = {
  title: "날씨/위젯",
  component: WeatherWidgetView,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
  args: { state },
} satisfies Meta<typeof WeatherWidgetView>
export default meta
type Story = StoryObj<typeof meta>
export const Clear: Story = {}
export const Rain: Story = {
  args: { state: { ...state, reading: { ...reading, code: 63 } } },
}
export const Night: Story = {
  args: { state: { ...state, reading: { ...reading, isDay: false } } },
}
export const BeforeSelection: Story = {
  args: { state: { ...state, location: null, reading: null } },
}
export const Loading: Story = {
  args: { state: { ...state, reading: null, loading: true } },
}
export const Error: Story = {
  args: {
    state: {
      ...state,
      reading: null,
      error: "날씨 서비스에 연결하지 못했습니다.",
    },
  },
}
export const Stale: Story = {
  args: { state: { ...state, error: "갱신 실패" } },
}
