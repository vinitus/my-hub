import type { ElectronAPI } from "@electron-toolkit/preload"
import type { NotesAPI } from "../shared/notes"
import type { CalendarAPI } from "../shared/calendar"
import type { ShortcutsAPI } from "../shared/shortcuts"
import type { WeatherAPI } from "../shared/weather"

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      notes: NotesAPI
      calendar: CalendarAPI
      weather: WeatherAPI
      shortcuts: ShortcutsAPI & {
        inspectFileDrop: (file: File) => ReturnType<ShortcutsAPI["inspectDrop"]>
      }
    }
  }
}
