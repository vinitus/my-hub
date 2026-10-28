import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ThemeProvider } from "./theme-provider"

const meta = {
  title: "공용 UI/테마 제어",
  component: ThemeProvider,
  args: { children: null },
  render: function ControlledTheme(_, context) {
    const [theme, setTheme] = useState<"light" | "dark">(
      context.globals.theme === "dark" ? "dark" : "light"
    )
    const [pending, setPending] = useState<"light" | "dark" | "system" | null>(
      null
    )
    const [requests, setRequests] = useState(0)
    return (
      <ThemeProvider
        theme={theme}
        storageKey="storybook:controlled-theme"
        onThemeChange={(next) => {
          setPending(next)
          setRequests((value) => value + 1)
        }}
      >
        <div className="space-y-3 p-4">
          <p>D 단축키로 변경을 요청한 뒤 저장 결과를 선택합니다.</p>
          <output data-testid="theme-requests">{requests}</output>
          <button
            onClick={() => {
              if (pending === "light" || pending === "dark") setTheme(pending)
              setPending(null)
            }}
          >
            설정 저장 성공
          </button>
          <button onClick={() => setPending(null)}>설정 저장 실패</button>
        </div>
      </ThemeProvider>
    )
  },
} satisfies Meta<typeof ThemeProvider>
export default meta
type Story = StoryObj<typeof meta>
export const Controlled: Story = {}
