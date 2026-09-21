import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// Renderer only. Main/preload builds and Electron startup are configured separately.
export default defineConfig({
  root: fromRoot("./src/renderer"),
  base: "./",
  publicDir: fromRoot("./public"),
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "renderer-development-csp",
      apply: "serve",
      // React Refresh injects an inline preamble; HMR connects over WebSocket.
      transformIndexHtml: (html) =>
        html
          .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
          .replace(
            "default-src 'self'",
            "default-src 'self'; connect-src 'self' ws://localhost:* ws://127.0.0.1:*"
          ),
    },
  ],
  resolve: {
    alias: {
      "@": fromRoot("./src/renderer/src"),
      "@renderer": fromRoot("./src/renderer/src"),
    },
  },
  build: {
    outDir: fromRoot("./out/renderer"),
    emptyOutDir: true,
  },
})
