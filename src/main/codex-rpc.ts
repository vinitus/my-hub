import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { homedir } from "node:os"
import { createInterface } from "node:readline"

type Pending = {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class CodexRPC {
  private nextId = 0
  private readonly pending = new Map<number, Pending>()
  private closed = false
  onNotification: (method: string, params: unknown) => void = () => {}
  onClose: () => void = () => {}
  private readonly child: ChildProcessWithoutNullStreams
  private readonly timeout: number

  constructor(child: ChildProcessWithoutNullStreams, timeout = 12000) {
    this.child = child
    this.timeout = timeout
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
    lines.on("line", (line) => {
      try {
        const message = JSON.parse(line)
        if (typeof message.id === "number" && !message.method) {
          const pending = this.pending.get(message.id)
          if (!pending) return
          this.pending.delete(message.id)
          clearTimeout(pending.timer)
          // 원격 오류 원문에는 인증 관련 값이 섞일 수 있어 UI로 전달하지 않는다.
          if (message.error)
            pending.reject(
              new Error(
                "Codex 요청에 실패했습니다. Codex를 업데이트하고 다시 시도해 주세요."
              )
            )
          else pending.resolve(message.result)
        } else if (typeof message.method === "string" && message.id == null) {
          this.onNotification(message.method, message.params)
        } else if (message.id != null && message.method) {
          this.write({
            id: message.id,
            error: {
              code: -32601,
              message:
                "Client-side tool and approval requests are not supported",
            },
          })
        }
      } catch {
        this.stop()
      }
    })
    // stderr를 비우되 로그인 URL, 토큰 등이 로그나 renderer로 전달되지 않게 한다.
    child.stderr.resume()
    child.once("error", () => this.stop())
    child.once("exit", () => this.stop())
    child.stdin.on("error", () => this.stop())
    child.stdout.on("error", () => this.stop())
    child.stderr.on("error", () => this.stop())
    child.once("close", () => lines.close())
  }

  private write(message: unknown) {
    this.child.stdin.write(JSON.stringify(message) + "\n")
  }
  request(method: string, params: unknown = {}): Promise<unknown> {
    if (this.closed)
      return Promise.reject(new Error("Codex 연결이 종료되었습니다."))
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stop()
      }, this.timeout)
      this.pending.set(id, { resolve, reject, timer })
      this.write({ id, method, params })
    })
  }
  async initialize() {
    await this.request("initialize", {
      clientInfo: { name: "my_hub", title: "My Hub", version: "0.0.1" },
    })
    this.write({ method: "initialized" })
  }
  stop() {
    if (this.closed) return
    this.closed = true
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer)
      reject(
        new Error(
          "Codex 연결이 종료되었거나 응답 시간이 초과되었습니다. 다시 시도해 주세요."
        )
      )
    }
    this.pending.clear()
    this.child.kill()
    this.onClose()
  }
}

export function codexEnvironment() {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.OPENAI_API_KEY
  delete env.CODEX_API_KEY
  return env
}
export function startCodex(
  executable: string,
  cwd = homedir(),
  planner = false
) {
  return new CodexRPC(
    spawn(
      executable,
      [
        "app-server",
        ...(planner
          ? [
              "-c",
              "features.shell_tool=false",
              "-c",
              "features.multi_agent=false",
              "-c",
              "features.apps=false",
              "-c",
              'web_search="disabled"',
              "-c",
              "mcp_servers={}",
              "-c",
              "plugins={}",
            ]
          : []),
      ],
      {
        cwd,
        windowsHide: true,
        shell: false,
        stdio: "pipe",
        env: codexEnvironment(),
      }
    )
  )
}
