import { contextBridge } from "electron"
import { electronAPI } from "@electron-toolkit/preload"

// Add application-specific APIs here and update index.d.ts accordingly.
const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI)
    contextBridge.exposeInMainWorld("api", api)
  } catch (error) {
    console.error(error)
  }
} else {
  const rendererWindow = globalThis as typeof globalThis & {
    electron: typeof electronAPI
    api: typeof api
  }
  rendererWindow.electron = electronAPI
  rendererWindow.api = api
}
