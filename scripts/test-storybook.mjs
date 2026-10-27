import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"
import electron from "electron"
const root = path.resolve("storybook-static")
const mime = {
  ".js": "text/javascript",
  ".html": "text/html",
  ".json": "application/json",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname
    )
    const filename = path.resolve(
      root,
      `.${pathname === "/" ? "/index.html" : pathname}`
    )
    if (!filename.startsWith(root + path.sep)) {
      res.writeHead(403).end()
      return
    }
    const data = await readFile(filename)
    res
      .writeHead(200, {
        "Content-Type":
          mime[path.extname(filename)] ?? "application/octet-stream",
      })
      .end(data)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const env = {
  ...process.env,
  STORYBOOK_TEST_URL: `http://127.0.0.1:${server.address().port}`,
}
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(
  electron,
  [fileURLToPath(new URL("./test-storybook-browser.cjs", import.meta.url))],
  { env, stdio: "inherit", windowsHide: true }
)
const code = await new Promise((resolve) => {
  child.once("exit", resolve)
  child.once("error", (error) => {
    console.error(error)
    resolve(1)
  })
})
server.close()
process.exitCode = code ?? 1
