import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type AppSettingsAPI,
  type AppSettingsPatch,
} from "../../../../shared/app-settings"

type ThemeStorage = {
  read: () => string | null
  write: (theme: AppSettings["theme"]) => void
  remove: () => void
}

type State = {
  settings: AppSettings
  ready: boolean
  error: string
}

function message(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "앱 설정을 저장하지 못했습니다."
}

// 초기 조회·이전·사용자 변경을 같은 큐에서 처리해 늦은 응답의 덮어쓰기를 막는다.
export class AppSettingsStore {
  private readonly api: AppSettingsAPI | undefined
  private readonly themeStorage: ThemeStorage
  private state: State
  private listeners = new Set<() => void>()
  private initialization: Promise<void> | undefined
  private tail: Promise<unknown> = Promise.resolve()

  constructor(api: AppSettingsAPI | undefined, themeStorage: ThemeStorage) {
    this.api = api
    this.themeStorage = themeStorage
    this.state = {
      settings: { ...DEFAULT_APP_SETTINGS },
      ready: !api,
      error: "",
    }
  }

  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(patch: Partial<State>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
  private enqueue<T>(action: () => Promise<T>) {
    const result = this.tail.then(action)
    this.tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private legacyTheme() {
    try {
      const value = this.themeStorage.read()
      return value === "dark" || value === "light" || value === "system"
        ? value
        : undefined
    } catch {
      return undefined
    }
  }
  private finishThemeMigration() {
    try {
      this.themeStorage.remove()
    } catch {
      // 브라우저 저장소 접근 실패가 이미 저장된 파일 설정을 무효화하지 않는다.
    }
  }

  initialize = () => {
    this.initialization ??= this.enqueue(async () => {
      let settings = this.state.settings
      let error = ""
      try {
        const theme = this.legacyTheme()
        settings = this.api
          ? await this.api.read()
          : { ...DEFAULT_APP_SETTINGS }
        if (theme) {
          settings =
            this.api && theme !== settings.theme
              ? await this.api.update({ theme })
              : { ...settings, theme }
          // 파일 저장 성공 후에만 이전 값을 제거한다. 브라우저 미리보기는 보관한다.
          if (this.api) this.finishThemeMigration()
        }
      } catch (cause) {
        error = message(cause)
      }
      this.publish({ settings, error, ready: true })
    })
    return this.initialization
  }

  update = async (patch: AppSettingsPatch) => {
    await this.initialize()
    return this.enqueue(async () => {
      try {
        const settings = this.api
          ? await this.api.update(patch)
          : { ...this.state.settings, ...patch }
        if (!this.api && patch.theme) this.themeStorage.write(patch.theme)
        if (this.api && patch.theme) this.finishThemeMigration()
        this.publish({ settings, error: "" })
        return true
      } catch (cause) {
        this.publish({ error: message(cause) })
        return false
      }
    })
  }
}
