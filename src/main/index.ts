import { app, shell, BrowserWindow, ipcMain } from "electron"
import { join } from "node:path"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"

// The custom build should emit this module as ESM at out/main/index.js.
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

  mainWindow.on("ready-to-show", () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      void shell.openExternal(url)
    }
    return { action: "deny" }
  })

  // Set this URL in the custom development launcher after Vite is ready.
  const rendererUrl = process.env["ELECTRON_RENDERER_URL"]
  if (is.dev && rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(mainDirectory, "../renderer/index.html"))
  }
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
