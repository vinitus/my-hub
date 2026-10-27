import { contextBridge, ipcRenderer } from "electron"
import { electronAPI } from "@electron-toolkit/preload"
import type { NotesAPI } from "../shared/notes"
import type { CalendarAPI } from "../shared/calendar"

const notes: NotesAPI = {
  library: () => ipcRenderer.invoke("notes:library"),
  chooseDirectory: () => ipcRenderer.invoke("notes:choose-directory"),
  openFromLibrary: (name) => ipcRenderer.invoke("notes:open-library", name),
  open: () => ipcRenderer.invoke("notes:open"),
  save: (request) => ipcRenderer.invoke("notes:save", request),
  rename: (request) => ipcRenderer.invoke("notes:rename", request),
  confirmReplace: () => ipcRenderer.invoke("notes:confirm-replace"),
  setDirty: (dirty) => ipcRenderer.send("notes:dirty", dirty),
  onSaveBeforeClose: (callback) => {
    const listener = () => callback()
    ipcRenderer.on("notes:save-before-close", listener)
    return () => ipcRenderer.removeListener("notes:save-before-close", listener)
  },
  completeClose: (saved) => ipcRenderer.send("notes:complete-close", saved),
}
const calendar: CalendarAPI = {
  load: () => ipcRenderer.invoke("calendar:load"),
  save: (request) => ipcRenderer.invoke("calendar:save", request),
  remove: (request) => ipcRenderer.invoke("calendar:remove", request),
}
const api = { notes, calendar }

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
