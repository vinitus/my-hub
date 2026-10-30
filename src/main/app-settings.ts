import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { app, ipcMain, type BrowserWindow } from "electron"
import {
  itemVisibility,
  modeItemKey,
  ModeItemKeySchema,
} from "../shared/item-mode"
import {
  AppSettingsPatchSchema,
  AppSettingsSchema,
  DEFAULT_APP_SETTINGS,
  APP_PANEL_WIDTHS,
  type AppSettings,
  type AppSettingsPatch,
} from "../shared/app-settings"

// 이전 버전의 유효한 너비(최대 640px)는 읽을 때 새 상한으로 보정한다.
// 새 변경 요청은 AppSettingsPatchSchema의 320px 제한을 그대로 적용한다.
const StoredAppSettingsSchema = AppSettingsSchema.extend({
  modeEnabled: AppSettingsSchema.shape.modeEnabled.default(false),
  personalItemKeys: AppSettingsSchema.shape.personalItemKeys.default([]),
  modeShortcut: AppSettingsSchema.shape.modeShortcut.default(
    DEFAULT_APP_SETTINGS.modeShortcut
  ),
  launcherShortcut: AppSettingsSchema.shape.launcherShortcut.default("ctrl+k"),
  shortcutMenuMotion: AppSettingsSchema.shape.shortcutMenuMotion.default("on"),
  shortcutMenuItems: AppSettingsSchema.shape.shortcutMenuItems.default(() =>
    DEFAULT_APP_SETTINGS.shortcutMenuItems.map((item) => ({ ...item }))
  ),
  leftSidebarWidth: z
    .number()
    .int()
    .min(APP_PANEL_WIDTHS.left.min)
    .max(640)
    .transform((width) => Math.min(width, APP_PANEL_WIDTHS.left.max)),
})

export class AppSettingsRepository {
  private personal = false
  private revision = 0
  onChange: (() => void) | undefined
  visibility = async (): Promise<{
    allows: (key: string) => boolean
    revision: number
  }> => {
    const revision = this.revision
    const settings = await this.read()
    if (revision !== this.revision) return this.visibility()
    return { allows: itemVisibility(settings, this.personal), revision }
  }
  setPersonalMode = async (personal: boolean) => {
    if (typeof personal !== "boolean") throw new Error("모드를 확인해 주세요.")
    const next = (await this.read()).modeEnabled && personal
    if (this.personal !== next) {
      this.personal = next
      this.revision++
      this.onChange?.()
    }
    return next
  }
  preserveNotePrivacy = async (oldPath: string, newPath: string) => {
    await this.inheritPersonal(
      modeItemKey("note", oldPath),
      modeItemKey("note", newPath)
    )
  }
  markCreatedPersonal = async (targetKey: string, personal?: boolean) => {
    ModeItemKeySchema.parse(targetKey)
    await this.change((settings) =>
      (personal ?? (settings.modeEnabled && this.personal)) &&
      !settings.personalItemKeys.includes(targetKey)
        ? { personalItemKeys: [...settings.personalItemKeys, targetKey] }
        : null
    )
  }
  inheritPersonal = async (sourceKey: string, targetKey: string) => {
    ModeItemKeySchema.parse(sourceKey)
    ModeItemKeySchema.parse(targetKey)
    await this.change((settings) =>
      settings.personalItemKeys.includes(sourceKey) &&
      !settings.personalItemKeys.includes(targetKey)
        ? { personalItemKeys: [...settings.personalItemKeys, targetKey] }
        : null
    )
  }
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
      if (Buffer.byteLength(raw) > 1024 * 1024)
        throw new Error("앱 설정 파일이 너무 큽니다.")
      return StoredAppSettingsSchema.parse(JSON.parse(raw))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { ...DEFAULT_APP_SETTINGS }
      throw new Error("앱 설정을 읽을 수 없습니다. 원본 파일을 보존했습니다.", {
        cause: error,
      })
    }
  }

  update = (patch: AppSettingsPatch) => this.change(patch)
  private change(
    patch:
      AppSettingsPatch | ((current: AppSettings) => AppSettingsPatch | null)
  ) {
    const result = this.tail.then(async () => {
      const current = await this.read()
      const value = typeof patch === "function" ? patch(current) : patch
      if (value === null) return current
      const parsed = AppSettingsPatchSchema.parse(value)
      const next = AppSettingsSchema.parse({ ...current, ...parsed })
      const raw = `${JSON.stringify(next, null, 2)}\n`
      if (Buffer.byteLength(raw) > 1024 * 1024)
        throw new Error("앱 설정 항목이 너무 많습니다.")
      await mkdir(this.directory, { recursive: true })
      const temporary = join(
        this.directory,
        `.app-settings-${randomUUID()}.tmp`
      )
      try {
        await writeFile(temporary, raw, {
          encoding: "utf8",
          flag: "wx",
        })
        await rename(temporary, this.path)
      } finally {
        await unlink(temporary).catch(() => {})
      }
      if (
        parsed.modeEnabled !== undefined ||
        parsed.personalItemKeys !== undefined
      )
        this.revision++
      if (!next.modeEnabled) this.personal = false
      this.onChange?.()
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
  repository = new AppSettingsRepository(app.getPath("userData")),
  onModeChange: () => void = () => {}
) {
  repository.onChange = () => {
    if (!window.isDestroyed()) window.webContents.send("settings:changed")
    onModeChange()
  }
  const channels = [
    "settings:read",
    "settings:update",
    "settings:personal-mode",
    "settings:inherit-personal",
  ] as const
  for (const channel of channels) {
    ipcMain.handle(channel, (event, patch: unknown) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw new Error("허용되지 않은 요청입니다.")
      if (channel === "settings:inherit-personal") {
        const input = z
          .object({
            sourceKey: ModeItemKeySchema,
            targetKey: ModeItemKeySchema,
          })
          .strict()
          .parse(patch)
        return repository.inheritPersonal(input.sourceKey, input.targetKey)
      }
      if (channel === "settings:personal-mode")
        return repository.setPersonalMode(z.boolean().parse(patch))
      return channel === "settings:read"
        ? repository.read()
        : repository.update(AppSettingsPatchSchema.parse(patch))
    })
  }
  window.on("closed", () => {
    repository.onChange = undefined
    for (const channel of channels) ipcMain.removeHandler(channel)
  })
}
