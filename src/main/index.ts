import { app, shell, BrowserWindow, ipcMain } from "electron"
import { join } from "node:path"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
import { registerNotes } from "./notes"
import { registerCalendar } from "./calendar"

// The development launcher emits this module as ESM at out/main/index.js.
const mainDirectory = import.meta.dirname

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux"
      ? { icon: join(app.getAppPath(), "resources/icon.png") }
      : {}),
    webPreferences: {
      // Emit preload as CommonJS: the root package uses type: module.
      preload: join(mainDirectory, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  registerNotes(mainWindow)
  registerCalendar(mainWindow)

  mainWindow.on("ready-to-show", () => {
    mainWindow.show()
    if (is.dev) console.log("[dev] Electron window ready.")
  })

  mainWindow.webContents.on("preload-error", (_, path, error) => {
    console.error("[electron] Preload failed:", path, error)
  })

  mainWindow.webContents.on(
    "did-fail-load",
    (_, code, description, url, isMainFrame) => {
      if (isMainFrame) {
        console.error(
          "[electron] Renderer failed to load:",
          code,
          description,
          url
        )
      }
    }
  )

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      void shell.openExternal(url)
    }
    return { action: "deny" }
  })

  // scripts/dev.mjs passes the actual URL after Vite starts listening.
  const rendererUrl = process.env["ELECTRON_RENDERER_URL"]
  if (is.dev && rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(mainDirectory, "../renderer/index.html"))
  }
}

const isPrimaryInstance = !is.dev || app.requestSingleInstanceLock()

if (!isPrimaryInstance) {
  console.error(
    "[dev] App is already running. Close the existing Electron window and retry."
  )
  app.quit()
} else {
  if (is.dev) {
    app.on("second-instance", () => {
      const existingWindow = BrowserWindow.getAllWindows()[0]
      if (existingWindow?.isMinimized()) existingWindow.restore()
      existingWindow?.focus()
    })
  }

  void app.whenReady().then(() => {
    electronApp.setAppUserModelId("com.electron.app")

    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    ipcMain.on("ping", () => console.log("pong"))
    createWindow()

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })
}
