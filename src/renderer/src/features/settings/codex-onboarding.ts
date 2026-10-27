import type { CodexModel, CodexPreferences } from "../../../../shared/codex"

const KEY = "my-hub:codex-setup:v1"
export type CodexSetupChoice = "skipped" | "started" | "completed"

export function readCodexSetupChoice(): CodexSetupChoice | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === "skipped" || value === "started" || value === "completed"
      ? value
      : null
  } catch {
    return null
  }
}
export function rememberCodexSetupChoice(choice: CodexSetupChoice) {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    /* 저장이 제한되어도 현재 실행은 계속한다. */
  }
}

export const effortLabels: Record<string, string> = {
  none: "없음",
  minimal: "최소",
  low: "낮음",
  medium: "보통",
  high: "높음",
  xhigh: "매우 높음",
  max: "최대",
  ultra: "최고",
}
export function defaultSetupEffort(model: CodexModel): string | null {
  const supported = model.supportedReasoningEfforts.map(
    (item) => item.reasoningEffort
  )
  if (supported.includes("low")) return "low"
  return supported.includes(model.defaultReasoningEffort ?? "")
    ? model.defaultReasoningEffort
    : (supported[0] ?? null)
}
export function defaultSetupPreferences(
  models: CodexModel[],
  saved: CodexPreferences | null
): CodexPreferences {
  const model =
    models.find((item) => item.model === saved?.model) ??
    models.find((item) => /luna/i.test(item.model + " " + item.displayName)) ??
    models.find((item) => item.isDefault) ??
    models[0]
  if (!model) return { model: null, reasoningEffort: null }
  const validSavedEffort =
    saved?.model === model.model &&
    saved.reasoningEffort !== null &&
    model.supportedReasoningEfforts.some(
      (item) => item.reasoningEffort === saved.reasoningEffort
    )
  return {
    model: model.model,
    reasoningEffort: validSavedEffort
      ? saved.reasoningEffort
      : defaultSetupEffort(model),
  }
}
