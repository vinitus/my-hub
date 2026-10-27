import { build } from "vite"
import { spawnSync } from "node:child_process"
import { isAbsolute } from "node:path"
import { fileURLToPath } from "node:url"

const suite = process.argv[2] ?? "notes"
if (!["notes", "calendar", "shortcuts"].includes(suite))
  throw new Error("Unknown test suite")

// TS/TSX를 실제 번들링하고 OS 대화상자만 테스트용 Electron 경계로 대체한다.
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
    outDir: `out/tests/${suite}`,
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: `tests/${suite}.test.ts`,
      formats: ["es"],
      fileName: () => `${suite}.test.js`,
    },
    rolldownOptions: {
      external: (id) =>
        id !== "electron" && !id.startsWith(".") && !isAbsolute(id),
    },
  },
})
const result = spawnSync(
  process.execPath,
  ["--test", `out/tests/${suite}/${suite}.test.js`],
  { stdio: "inherit" }
)
process.exitCode = result.status ?? 1
