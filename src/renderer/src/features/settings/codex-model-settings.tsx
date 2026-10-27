import { useEffect, useState } from "react"
import type {
  CodexConnection,
  CodexPreferences,
} from "../../../../shared/codex"

const effortLabels: Record<string, string> = {
  none: "없음",
  minimal: "최소",
  low: "낮음",
  medium: "보통",
  high: "높음",
  xhigh: "매우 높음",
  max: "최대",
  ultra: "최고",
}
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"

export function CodexModelSettings({
  active,
  connection,
  busy,
}: {
  active: boolean
  connection: CodexConnection
  busy: boolean
}) {
  const api = window.api?.codex
  const models = connection.models ?? []
  const [preferences, setPreferences] = useState<CodexPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!active || !api?.preferences) return
    let alive = true
    void api.preferences().then(
      (value) => {
        if (alive) {
          setPreferences(value)
          setError("")
          setSaved(false)
        }
      },
      () => {
        if (alive) {
          setPreferences({ model: null, reasoningEffort: null })
          setError(
            "저장된 모델 설정을 읽지 못했습니다. 사용할 설정을 다시 선택해 주세요."
          )
        }
      }
    )
    return () => {
      alive = false
    }
  }, [active, api])
  const model = models.find((item) => item.model === preferences?.model)
  const missingModel = !!preferences?.model && !model && models.length > 0
  const missingEffort =
    !!preferences?.reasoningEffort &&
    !!model &&
    !model.supportedReasoningEfforts.some(
      (item) => item.reasoningEffort === preferences.reasoningEffort
    )
  const disabled =
    busy ||
    saving ||
    !preferences ||
    connection.status !== "connected" ||
    !models.length
  async function save(next: CodexPreferences) {
    if (!api?.savePreferences || saving) return
    setSaving(true)
    setSaved(false)
    setError("")
    try {
      setPreferences(await api.savePreferences(next))
      setSaved(true)
    } catch {
      setError("모델 설정을 저장하지 못했습니다. 다시 확인한 뒤 선택해 주세요.")
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="space-y-3 border-t pt-4">
      <div className="space-y-2">
        <label htmlFor="codex-model" className="text-xs font-medium">
          모델
        </label>
        <select
          id="codex-model"
          className={selectClass}
          disabled={disabled}
          value={preferences?.model ?? ""}
          onChange={(event) =>
            void save({
              model: event.target.value || null,
              reasoningEffort: null,
            })
          }
        >
          <option value="">Codex 기본값</option>
          {!!preferences?.model && !model && (
            <option value={preferences?.model ?? ""} disabled>
              {preferences?.model} (
              {models.length ? "사용할 수 없음" : "목록 확인 필요"})
            </option>
          )}
          {models.map((item) => (
            <option key={item.model} value={item.model}>
              {item.displayName}
              {item.isDefault ? " (기본 모델)" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="codex-effort" className="text-xs font-medium">
          생각 수준
        </label>
        <select
          id="codex-effort"
          className={selectClass}
          disabled={
            disabled || !model || !model.supportedReasoningEfforts.length
          }
          value={preferences?.reasoningEffort ?? ""}
          onChange={(event) =>
            preferences &&
            void save({
              ...preferences,
              reasoningEffort: event.target.value || null,
            })
          }
        >
          <option value="">
            모델 기본값
            {model?.defaultReasoningEffort
              ? ` (${effortLabels[model.defaultReasoningEffort] ?? model.defaultReasoningEffort})`
              : ""}
          </option>
          {missingEffort && (
            <option value={preferences?.reasoningEffort ?? ""} disabled>
              {preferences?.reasoningEffort} (지원되지 않음)
            </option>
          )}
          {model?.supportedReasoningEfforts.map((item) => (
            <option key={item.reasoningEffort} value={item.reasoningEffort}>
              {effortLabels[item.reasoningEffort] ?? item.reasoningEffort}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        모델을 선택하면 지원하는 생각 수준을 설정할 수 있습니다. 설정은 My Hub에
        자동 저장됩니다.
      </p>
      {(!api?.preferences ||
        error ||
        connection.modelsError ||
        missingModel ||
        missingEffort) && (
        <p role="alert" className="text-xs leading-relaxed text-destructive">
          {!api?.preferences
            ? "모델 설정을 사용하려면 앱을 완전히 닫고 다시 실행해 주세요."
            : error ||
              connection.modelsError ||
              "저장된 설정을 현재 모델 목록에서 다시 선택해 주세요."}
        </p>
      )}
      {(saving || saved) && (
        <p role="status" className="text-xs text-muted-foreground">
          {saving ? "모델 설정을 저장하는 중…" : "모델 설정을 저장했습니다."}
        </p>
      )}
    </div>
  )
}
