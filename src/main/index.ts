import { registerCommands } from "./commands"
import { CalendarRepository } from "./calendar-repository"
import { TodoRepository } from "./todo-repository"
import { registerTodos } from "./todos"
import { app, shell, BrowserWindow, ipcMain } from "electron"
import { join } from "node:path"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
import { registerNotes } from "./notes"
import { registerCalendar } from "./calendar"
import { registerShortcuts } from "./shortcuts"
import { registerWeather } from "./weather"
import { registerCodex } from "./codex"
import { registerAppSettings } from "./app-settings"

// The development launcher emits this module as ESM at out/main/index.js.
const mainDirectory = import.meta.dirname

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    // Leave roughly 860px for content alongside the default 288px/280px panels.
    width: 1440,
    height: 900,
    show: false,
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

  // 자동 숨김은 Alt로 다시 표시된다. 앱 메뉴를 제거해 재표시를 막는다.
  mainWindow.removeMenu()

  const calendarRepository = new CalendarRepository(app.getPath("userData"))
  const todoRepository = new TodoRepository(app.getPath("userData"))
  registerTodos(mainWindow, todoRepository)
  registerAppSettings(mainWindow)
  registerNotes(mainWindow)
  const refreshReminders = registerCalendar(mainWindow, calendarRepository)
  registerShortcuts(mainWindow)
  registerWeather(mainWindow)
  const codexSettings = registerCodex(mainWindow)
  registerCommands(
    mainWindow,
    calendarRepository,
    todoRepository,
    codexSettings,
    refreshReminders
  )

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
