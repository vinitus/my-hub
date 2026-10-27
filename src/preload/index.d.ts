import type { ElectronAPI } from "@electron-toolkit/preload"
import type { NotesAPI } from "../shared/notes"

declare global {
  interface Window {
    electron: ElectronAPI
    api: { notes: NotesAPI }
  }
}
