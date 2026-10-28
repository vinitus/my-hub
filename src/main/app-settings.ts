import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { app, ipcMain, type BrowserWindow } from "electron"
import {
  AppSettingsPatchSchema,
  AppSettingsSchema,
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type AppSettingsPatch,
} from "../shared/app-settings"

export class AppSettingsRepository {
  private readonly directory: string
  private readonly path: string
  private tail: Promise<unknown> = Promise.resolve()

  constructor(directory: string) {
    this.directory = directory
    this.path = join(directory, "app-settings.json")
  }

  read = async (): Promise<AppSettings> => {
    try {
      const raw = await readFile(this.path, "utf8")
      if (Buffer.byteLength(raw) > 16 * 1024)
        throw new Error("앱 설정 파일이 너무 큽니다.")
      return AppSettingsSchema.parse(JSON.parse(raw))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { ...DEFAULT_APP_SETTINGS }
      throw new Error("앱 설정을 읽을 수 없습니다. 원본 파일을 보존했습니다.", {
        cause: error,
      })
    }
  }

  update = (patch: AppSettingsPatch) => {
    const result = this.tail.then(async () => {
      const parsed = AppSettingsPatchSchema.parse(patch)
      const current = await this.read()
      const next = AppSettingsSchema.parse({ ...current, ...parsed })
      await mkdir(this.directory, { recursive: true })
      const temporary = join(
        this.directory,
        `.app-settings-${randomUUID()}.tmp`
      )
      try {
        await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, {
          encoding: "utf8",
          flag: "wx",
        })
        await rename(temporary, this.path)
      } finally {
        await unlink(temporary).catch(() => {})
      }
      return next
    })
    this.tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}

export function registerAppSettings(
  window: BrowserWindow,
  repository = new AppSettingsRepository(app.getPath("userData"))
) {
  const channels = ["settings:read", "settings:update"] as const
  for (const channel of channels) {
    ipcMain.handle(channel, (event, patch: unknown) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw new Error("허용되지 않은 요청입니다.")
      return channel === "settings:read"
        ? repository.read()
        : repository.update(AppSettingsPatchSchema.parse(patch))
    })
  }
  window.on("closed", () => {
    for (const channel of channels) ipcMain.removeHandler(channel)
  })
}
