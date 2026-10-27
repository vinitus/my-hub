import { spawn } from "node:child_process"
import { isBuiltin } from "node:module"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { build, createServer } from "vite"

// pnpm dev 실행 순서:
// 1. Electron main/preload를 한 번 빌드한다.
// 2. renderer용 Vite 서버를 연다.
// 3. 서버의 실제 주소를 전달해 Electron 창을 실행한다.
// renderer는 Vite HMR을 사용하고, main/preload 변경 시에는 pnpm dev를 다시 실행해야 한다.
const projectUrl = new URL("../", import.meta.url)
const projectRoot = fileURLToPath(projectUrl)
const fromRoot = (path) => fileURLToPath(new URL(path, projectUrl))
// pnpm dev --force는 Vite의 의존성 최적화 캐시를 다시 만들 때 사용한다.
const { values } = parseArgs({ options: { force: { type: "boolean" } } })

// Chromium의 Windows 오류 로그는 UTF-8인데 stderr를 콘솔에 직접 연결하면
// 터미널 코드 페이지에 따라 한글이 깨졌다. 바이트를 받아 UTF-8로 출력한다.
function forwardElectronErrors(stream) {
  let pending = Buffer.alloc(0)
  const utf8 = new TextDecoder("utf-8")

  function writeLine(bytes) {
    process.stderr.write(`${utf8.decode(bytes)}\n`)
  }

  stream.on("data", (chunk) => {
    // 한 줄이 여러 chunk로 나뉠 수 있으므로 줄바꿈까지 모은 뒤 디코딩한다.
    // 그래야 한글의 UTF-8 바이트가 중간에서 잘리지 않는다.
    pending = Buffer.concat([pending, chunk])
    let index
    while ((index = pending.indexOf(10)) !== -1) {
      writeLine(pending.subarray(0, index))
      pending = pending.subarray(index + 1)
    }
  })
  stream.once("end", () => {
    if (pending.length) writeLine(pending)
  })
}

let rendererServer
let electronProcess
let stopping = false

// Ctrl+C, Electron 종료, 시작 실패 모두 여기서 자식 프로세스와 서버를 정리한다.
// 중복 호출을 막아 종료 중 이벤트가 다시 들어와도 정리를 한 번만 수행한다.
async function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  if (
    electronProcess &&
    electronProcess.exitCode === null &&
    electronProcess.signalCode === null
  ) {
    electronProcess.kill()
  }
  await rendererServer?.close()
  process.exitCode = exitCode
}

process.once("SIGINT", () => void stop())
process.once("SIGTERM", () => void stop())

// renderer용 vite.config.ts를 적용하지 않고 Node에서 실행할 두 진입점만 빌드한다.
// Electron/Node 내장 모듈은 실행 시 제공되므로 번들에 포함하지 않는다.
async function buildElectronEntry(name, format, fileName) {
  await build({
    configFile: false,
    root: projectRoot,
    mode: "development",
    publicDir: false,
    build: {
      target: "esnext",
      outDir: fromRoot(`out/${name}`),
      emptyOutDir: true,
      minify: false,
      sourcemap: true,
      lib: {
        entry: fromRoot(`src/${name}/index.ts`),
        formats: [format],
        fileName: () => fileName,
      },
      rolldownOptions: {
        external: (id) => id === "electron" || isBuiltin(id),
      },
    },
  })
}

async function start() {
  console.log("[dev] Building Electron main and preload...")
  // package.json의 main 및 src/main/index.ts의 preload 경로와 출력 이름을 맞춘다.
  await buildElectronEntry("main", "es", "index.js")
  await buildElectronEntry("preload", "cjs", "index.cjs")

  if (stopping) return
  // 실행 파일이 없다면 electron 패키지가 첫 import 시 다운로드한다.
  const { default: electronPath } = await import("electron")
  if (stopping) return

  // 브라우저를 따로 열지 않는다. Vite는 Electron 창의 renderer에만 연결한다.
  rendererServer = await createServer({
    configFile: fromRoot("vite.config.ts"),
    server: { host: "127.0.0.1", open: false },
    optimizeDeps: { force: values.force },
  })
  if (stopping) {
    await rendererServer.close()
    return
  }
  await rendererServer.listen()
  if (stopping) {
    await rendererServer.close()
    return
  }
  const rendererUrl = rendererServer.resolvedUrls.local[0]
  // 기본 포트(5173)가 사용 중이면 Vite가 선택한 실제 포트를 Electron에 넘긴다.
  const env = { ...process.env, ELECTRON_RENDERER_URL: rendererUrl }
  // 외부 환경변수 때문에 Electron이 Node 모드로 실행되는 일을 방지한다.
  delete env.ELECTRON_RUN_AS_NODE

  console.log(`[dev] Renderer ready: ${rendererUrl}`)
  console.log("[dev] Opening Electron. Press Ctrl+C to stop.")
  electronProcess = spawn(electronPath, [projectRoot], {
    cwd: projectRoot,
    env,
    stdio: ["inherit", "inherit", "pipe"],
  })
  // stdout은 그대로 전달하고, stderr만 한글 로그를 위해 디코딩한다.
  // 중복 앱 실행 방지는 src/main/index.ts의 single-instance lock이 처리한다.
  forwardElectronErrors(electronProcess.stderr)
  electronProcess.once("error", (error) => {
    console.error("[dev] Failed to start Electron:", error)
    void stop(1)
  })
  electronProcess.once("exit", (code, signal) => {
    if (!stopping) void stop(code ?? (signal ? 1 : 0))
  })
}

try {
  await start()
} catch (error) {
  console.error("[dev] Startup failed:", error)
  await stop(1)
}
