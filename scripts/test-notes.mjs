import { build } from "vite"
import { spawnSync } from "node:child_process"
import { isAbsolute } from "node:path"
import { fileURLToPath } from "node:url"

// TSX 플러그인 구성을 실제로 번들링하고 Node의 테스트 러너에서 Markdown/파일 IO를 검증한다.
await build({
  configFile: false,
  resolve: {
    alias: {
      electron: fileURLToPath(
        new URL("../tests/fakes/electron.ts", import.meta.url)
      ),
    },
  },
  build: {
    target: "node24",
    outDir: "out/tests",
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: "tests/notes.test.ts",
      formats: ["es"],
      fileName: () => "notes.test.js",
    },
    rolldownOptions: {
      external: (id) =>
        id !== "electron" && !id.startsWith(".") && !isAbsolute(id),
    },
  },
})
const result = spawnSync(
  process.execPath,
  ["--test", "out/tests/notes.test.js"],
  { stdio: "inherit" }
)
process.exitCode = result.status ?? 1
