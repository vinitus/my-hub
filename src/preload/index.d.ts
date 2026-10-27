import type { CommandAPI } from "../shared/command"
import type { TodosAPI } from "../shared/todos"
import type { ElectronAPI } from "@electron-toolkit/preload"
import type { NotesAPI } from "../shared/notes"
import type { CalendarAPI } from "../shared/calendar"
import type { ShortcutsAPI } from "../shared/shortcuts"
import type { WeatherAPI } from "../shared/weather"
import type { CodexAPI } from "../shared/codex"

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      commands: CommandAPI
      todos: TodosAPI
      notes: NotesAPI
      calendar: CalendarAPI
      weather: WeatherAPI
      codex: CodexAPI
      shortcuts: ShortcutsAPI & {
        inspectFileDrop: (file: File) => ReturnType<ShortcutsAPI["inspectDrop"]>
      }
    }
  }
}
