import { useId } from "react"
import { FolderCogIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { CodexConnectionPanel } from "./codex-connection"
import { QuickMenuSettings, type QuickMenuOption } from "./quick-menu-settings"
import {
  ItemModeSettings,
  type ItemModeSettingsProps,
} from "./item-mode-settings"
import { useTheme } from "@/shared/lib/theme-provider"
import type { AppSettings } from "../../../../../shared/app-settings"
import {
  LAUNCHER_SHORTCUTS,
  type LauncherShortcut,
} from "../../../../../shared/launcher-shortcut"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet"

const themes = [
  { value: "light", label: "라이트", icon: SunIcon },
  { value: "dark", label: "다크", icon: MoonIcon },
  { value: "system", label: "시스템", icon: MonitorIcon },
] as const

// 저장은 기존 ThemeProvider와 useNote가 담당한다. 설정 화면은 같은 동작을 호출한다.
export function SettingsSheet({
  open,
  connectionPanel = <CodexConnectionPanel active={open} />,
  onOpenChange,
  directory,
  ready,
  busy,
  error,
  settingsError = "",
  onChooseDirectory,
  shortcutMenuMotion = "on",
  onShortcutMenuMotionChange,
  shortcutMenuItems,
  quickMenuOptions,
  quickMenuError,
  onShortcutMenuItemsChange,
  launcherShortcut = "ctrl+k",
  onLauncherShortcutChange,
  itemMode,
}: {
  connectionPanel?: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  directory?: string
  ready: boolean
  busy: boolean
  error: string
  settingsError?: string
  onChooseDirectory: () => void
  shortcutMenuMotion: AppSettings["shortcutMenuMotion"]
  onShortcutMenuMotionChange: (
    motion: AppSettings["shortcutMenuMotion"]
  ) => void
  shortcutMenuItems: AppSettings["shortcutMenuItems"]
  quickMenuOptions: readonly QuickMenuOption[]
  quickMenuError?: string
  onShortcutMenuItemsChange: (items: AppSettings["shortcutMenuItems"]) => void
  launcherShortcut?: LauncherShortcut
  onLauncherShortcutChange?: (shortcut: LauncherShortcut) => void
  itemMode?: ItemModeSettingsProps
}) {
  const sectionId = useId()
  const { theme, setTheme } = useTheme()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>설정</SheetTitle>
          <SheetDescription>
            앱 테마, 실행 단축키, 메뉴, 메모 저장 폴더와 AI 연결을 설정합니다.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-6">
          {settingsError && (
            <p role="alert" className="text-sm text-destructive">
              {settingsError}
            </p>
          )}
          <section
            aria-labelledby={`${sectionId}-settings-theme`}
            className="space-y-3"
          >
            <h3
              id={`${sectionId}-settings-theme`}
              className="text-sm font-medium"
            >
              테마
            </h3>
            <div
              role="group"
              aria-labelledby={`${sectionId}-settings-theme`}
              className="grid grid-cols-3 gap-2"
            >
              {themes.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={theme === value ? "default" : "outline"}
                  aria-pressed={theme === value}
                  onClick={() => setTheme(value)}
                >
                  <Icon />
                  {label}
                </Button>
              ))}
            </div>
          </section>
          <section className="space-y-3 border-t pt-6">
            <label
              htmlFor={`${sectionId}-launcher-shortcut`}
              className="text-sm font-medium"
            >
              통합 검색 실행 단축키
            </label>
            <select
              id={`${sectionId}-launcher-shortcut`}
              value={launcherShortcut}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) => {
                const value = event.target.value
                if (
                  value === "ctrl+k" ||
                  value === "ctrl+alt+k" ||
                  value === "ctrl+shift+space"
                )
                  onLauncherShortcutChange?.(value)
              }}
            >
              {Object.entries(LAUNCHER_SHORTCUTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="text-xs leading-relaxed text-muted-foreground">
              앱 안에서 사용하는 단축키입니다. AI 빠른 입력은 Ctrl+Shift+K로
              열며, 두 단축키는 중복되지 않습니다.
            </p>
          </section>
          {itemMode && <ItemModeSettings {...itemMode} />}
          <QuickMenuSettings
            items={shortcutMenuItems}
            options={quickMenuOptions}
            error={quickMenuError}
            onChange={onShortcutMenuItemsChange}
          />
          <section className="space-y-3 border-t pt-6">
            <label
              htmlFor={`${sectionId}-menu-motion`}
              className="text-sm font-medium"
            >
              메뉴 애니메이션
            </label>
            <select
              id={`${sectionId}-menu-motion`}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={shortcutMenuMotion}
              onChange={(event) => {
                const value = event.target.value
                if (value === "on" || value === "system" || value === "off")
                  onShortcutMenuMotionChange(value)
              }}
            >
              <option value="on">켜기</option>
              <option value="system">시스템 설정 따르기</option>
              <option value="off">끄기</option>
            </select>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Ctrl·휠 길게 누르기 메뉴에 적용됩니다. ‘켜기’는 Windows 애니메이션
              설정과 관계없이 움직임을 표시합니다.
            </p>
          </section>
          <section
            aria-labelledby={`${sectionId}-settings-notes`}
            className="space-y-3 border-t pt-6"
          >
            <h3
              id={`${sectionId}-settings-notes`}
              className="text-sm font-medium"
            >
              메모 폴더
            </h3>
            <p
              className="rounded-lg bg-muted p-3 text-xs leading-relaxed break-all"
              title={directory}
            >
              {directory ??
                (ready
                  ? "저장 폴더를 선택해 주세요."
                  : "메모 폴더를 불러오는 중…")}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              열린 메모는 기존 위치에 저장되며, 새 메모는 선택한 폴더에
              저장됩니다.
            </p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={onChooseDirectory}
            >
              <FolderCogIcon />
              메모 폴더 변경
            </Button>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </section>
          {connectionPanel}
        </div>
      </SheetContent>
    </Sheet>
  )
}
