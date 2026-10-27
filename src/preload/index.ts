import { contextBridge, ipcRenderer, webUtils } from "electron"
import { electronAPI } from "@electron-toolkit/preload"
import type { NotesAPI } from "../shared/notes"
import type { CalendarAPI } from "../shared/calendar"
import type { ShortcutsAPI } from "../shared/shortcuts"
import type { WeatherAPI } from "../shared/weather"
import type { CodexAPI } from "../shared/codex"

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
const shortcuts: ShortcutsAPI & {
  inspectFileDrop: (file: File) => ReturnType<ShortcutsAPI["inspectDrop"]>
} = {
  icon: (request) => ipcRenderer.invoke("shortcuts:icon", request),
  inspectDrop: (request) =>
    ipcRenderer.invoke("shortcuts:inspect-drop", request),
  inspectFileDrop: async (file) => {
    // File 객체는 IPC로 보낼 수 없으므로 preload에서 실제 파일 경로를 얻는다.
    const target = webUtils.getPathForFile(file)
    if (!target) throw new Error("실제 파일이나 폴더를 끌어 놓아 주세요.")
    return ipcRenderer.invoke("shortcuts:inspect-drop", {
      kind: "path",
      target,
    })
  },
  load: () => ipcRenderer.invoke("shortcuts:load"),
  choose: (kind) => ipcRenderer.invoke("shortcuts:choose", kind),
  save: (request) => ipcRenderer.invoke("shortcuts:save", request),
  remove: (request) => ipcRenderer.invoke("shortcuts:remove", request),
  launch: (request) => ipcRenderer.invoke("shortcuts:launch", request),
}
const weather: WeatherAPI = {
  location: () => ipcRenderer.invoke("weather:location"),
  setLocation: (location) =>
    ipcRenderer.invoke("weather:set-location", location),
  search: (query) => ipcRenderer.invoke("weather:search", query),
  current: (location, force = false) =>
    ipcRenderer.invoke("weather:current", { location, force }),
}
const codex: CodexAPI = {
  check: () => ipcRenderer.invoke("codex:check"),
  connect: () => ipcRenderer.invoke("codex:connect"),
  disconnect: () => ipcRenderer.invoke("codex:disconnect"),
  cancel: () => ipcRenderer.invoke("codex:cancel"),
  preferences: () => ipcRenderer.invoke("codex:preferences"),
  savePreferences: (preferences) =>
    ipcRenderer.invoke("codex:save-preferences", preferences),
  onChange: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: Parameters<typeof callback>[0]
    ) => callback(state)
    ipcRenderer.on("codex:changed", listener)
    return () => {
      ipcRenderer.removeListener("codex:changed", listener)
    }
  },
}
const api = { notes, calendar, shortcuts, weather, codex }

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
