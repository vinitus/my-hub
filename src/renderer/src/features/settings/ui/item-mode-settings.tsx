import { useId, useRef, useState } from "react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import type {
  AppSettings,
  AppSettingsPatch,
} from "../../../../../shared/app-settings"
import {
  ITEM_KIND_LABELS,
  type ModeItem,
} from "../../../../../shared/item-mode"
import {
  MODE_SHORTCUTS,
  ModeShortcutSchema,
} from "../../../../../shared/mode-shortcut"

export type ItemModeSettingsProps = {
  settings: Pick<
    AppSettings,
    "modeEnabled" | "modeShortcut" | "personalItemKeys"
  >
  personal: boolean
  busy: boolean
  items: readonly ModeItem[]
  onChange: (patch: AppSettingsPatch) => Promise<boolean>
  onPersonalChange: (personal: boolean) => void
}

export function ItemModeSettings({
  settings,
  personal,
  busy,
  items,
  onChange,
  onPersonalChange,
}: ItemModeSettingsProps) {
  const id = useId()
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const lock = useRef(false)
  async function save(patch: AppSettingsPatch) {
    if (busy || lock.current) return
    lock.current = true
    setSaving(true)
    setError("")
    try {
      if (!(await onChange(patch)))
        setError("모드 설정을 저장하지 못했습니다. 다시 시도해 주세요.")
    } catch {
      setError("모드 설정을 저장하지 못했습니다. 다시 시도해 주세요.")
    } finally {
      lock.current = false
      setSaving(false)
    }
  }
  const disabled = busy || saving
  const filtered = items.filter((item) =>
    item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  )
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-3 border-t pt-6"
    >
      <h3 id={`${id}-title`} className="text-sm font-medium">
        업무·개인 모드
      </h3>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.modeEnabled}
          disabled={disabled}
          onChange={(event) => void save({ modeEnabled: event.target.checked })}
        />
        항목별 개인용 숨김 사용
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        개인용으로 지정한 항목은 업무 모드에서 숨기고, 개인 모드에서 함께
        표시합니다. 앱을 다시 열면 업무 모드로 시작합니다.
      </p>
      {settings.modeEnabled && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span role="status">
              현재 {personal ? "개인 모드" : "업무 모드"}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onPersonalChange(!personal)}
            >
              {personal ? "개인 항목 숨기기" : "개인 항목 표시"}
            </Button>
          </div>
          <label className="block text-sm" htmlFor={`${id}-shortcut`}>
            모드 전환 단축키
          </label>
          <select
            id={`${id}-shortcut`}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={settings.modeShortcut}
            disabled={disabled}
            onChange={(event) => {
              const parsed = ModeShortcutSchema.safeParse(event.target.value)
              if (parsed.success) void save({ modeShortcut: parsed.data })
            }}
          >
            {Object.entries(MODE_SHORTCUTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            앱 내부 단축키 · 개인 항목 {settings.personalItemKeys.length}개
          </p>
          <Input
            aria-label="개인 항목 지정 검색"
            placeholder="항목 이름 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div
            className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2"
            aria-label="개인 항목 지정"
          >
            {filtered.slice(0, 50).map((item) => (
              <label
                key={item.key}
                className="flex min-h-10 items-center gap-2 rounded px-1 text-sm"
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={settings.personalItemKeys.includes(item.key)}
                  onChange={(event) =>
                    void save({
                      personalItemKeys: event.target.checked
                        ? [...settings.personalItemKeys, item.key]
                        : settings.personalItemKeys.filter(
                            (key) => key !== item.key
                          ),
                    })
                  }
                />
                <span className="shrink-0 text-xs text-muted-foreground">
                  {ITEM_KIND_LABELS[item.kind]}
                </span>
                <span className="truncate" title={item.title}>
                  {item.title}
                </span>
              </label>
            ))}
            {!filtered.length && (
              <p className="p-2 text-xs text-muted-foreground">
                표시할 항목이 없습니다.
              </p>
            )}
            {filtered.length > 50 && (
              <p className="p-2 text-xs text-muted-foreground">
                검색어로 목록을 좁혀 주세요. 처음 50개를 표시합니다.
              </p>
            )}
          </div>
          {!personal && (
            <p className="text-xs text-muted-foreground">
              숨긴 항목을 다시 관리하려면 개인 모드로 전환하세요.
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
