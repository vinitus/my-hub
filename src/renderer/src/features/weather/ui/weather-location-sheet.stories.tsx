import type { Meta, StoryObj } from "@storybook/react-vite"
import { WeatherLocationSheet } from "./weather-widget"
const location = {
  id: 1,
  name: "역삼동",
  region: "서울특별시 강남구",
  country: "대한민국",
  latitude: 37.5,
  longitude: 127.0,
}
const meta = {
  title: "날씨/지역 검색",
  component: WeatherLocationSheet,
  parameters: { layout: "fullscreen" },
  args: {
    busy: false,
    error: "",
    onSearch: async () => [location],
    onChoose: async () => true,
    onClose: () => {},
  },
} satisfies Meta<typeof WeatherLocationSheet>
export default meta
type Story = StoryObj<typeof meta>
export const Search: Story = {}
export const NoResults: Story = { args: { onSearch: async () => [] } }
export const Error: Story = { args: { error: "검색 요청에 실패했습니다." } }
export const Saving: Story = { args: { busy: true } }
