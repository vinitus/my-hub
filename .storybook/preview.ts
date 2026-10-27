import { createElement, StrictMode, useEffect, type ReactNode } from "react"
import type { Preview } from "@storybook/react-vite"
import "../src/renderer/src/app/styles/index.css"
function ThemeFrame({
  dark,
  children,
}: {
  dark: boolean
  children: ReactNode
}) {
  useEffect(() => {
    const previous = document.documentElement.classList.contains("dark")
    document.documentElement.classList.toggle("dark", dark)
    return () => {
      document.documentElement.classList.toggle("dark", previous)
    }
  }, [dark])
  return children
}
const preview = {
  parameters: { controls: { expanded: true } },
  globalTypes: {
    theme: {
      description: "Color theme",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, context) =>
      createElement(
        StrictMode,
        null,
        createElement(ThemeFrame, {
          dark: context.globals.theme === "dark",
          children: createElement(Story),
        })
      ),
  ],
} satisfies Preview
export default preview
