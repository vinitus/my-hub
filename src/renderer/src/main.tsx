import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"

// Renderer 진입점. 앱 전체에서 공유할 Provider는 이곳에 배치한다.
// 테마는 next-themes 대신 프로젝트의 로컬 ThemeProvider를 사용한다.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
)
