import type { ElectronAPI } from "@electron-toolkit/preload"
import type { NotesAPI } from "../shared/notes"
import type { CalendarAPI } from "../shared/calendar"
import type { ShortcutsAPI } from "../shared/shortcuts"

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      notes: NotesAPI
      calendar: CalendarAPI
      shortcuts: ShortcutsAPI & {
        inspectFileDrop: (file: File) => ReturnType<ShortcutsAPI["inspectDrop"]>
      }
    }
  }
}
