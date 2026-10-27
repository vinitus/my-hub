import type { ElectronAPI } from "@electron-toolkit/preload"
import type { NotesAPI } from "../shared/notes"
import type { CalendarAPI } from "../shared/calendar"

declare global {
  interface Window {
    electron: ElectronAPI
    api: { notes: NotesAPI; calendar: CalendarAPI }
  }
}
