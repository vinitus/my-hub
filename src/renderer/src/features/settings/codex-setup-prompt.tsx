import { Dialog } from "@base-ui/react/dialog"
import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import type { CodexPreferences } from "../../../../shared/codex"
import {
  defaultSetupEffort,
  defaultSetupPreferences,
  effortLabels,
  rememberCodexSetupChoice,
} from "./codex-onboarding"
import { useCodexConnection } from "./use-codex-connection"

type Step = "intro" | "login" | "model" | "effort"
export function CodexSetupPrompt({
  open,
  initialStep,
  onDismiss,
}: {
  open: boolean
  initialStep: "intro" | "login"
  onDismiss: () => void
}) {
  const [step, setStep] = useState<Step>(initialStep)
  const { state, error, busy, run } = useCodexConnection(
    open && step !== "intro"
  )
  const [saved, setSaved] = useState<CodexPreferences | null>(null)
  const [preferencesReady, setPreferencesReady] = useState(false)
  const [selection, setSelection] = useState<CodexPreferences | null>(null)
  const [saveError, setSaveError] = useState("")
  const [saving, setSaving] = useState(false)
  const selectId = useId()
  const api = window.api?.codex
  const setupActive = open && step !== "intro"
  useEffect(() => {
    if (!setupActive || !api) return
    let alive = true
    void api.preferences().then(
      (value) => {
        if (alive) {
          setSaved(value)
          setPreferencesReady(true)
        }
      },
      () => {
        if (alive) {
          setSaveError(
            "기존 설정을 불러오지 못했습니다. 완료 시 선택한 값으로 저장합니다."
          )
          setPreferencesReady(true)
        }
      }
    )
    return () => {
      alive = false
    }
  }, [setupActive, api])
  const chosen = selection ?? defaultSetupPreferences(state.models, saved)
  const model = state.models.find((item) => item.model === chosen.model)
  const connected = state.status === "connected"
  const connecting = state.status === "connecting"
  const title = {
    intro: "간단한 작업, Codex에게 맡겨 볼까요?",
    login: "ChatGPT 계정으로 로그인",
    model: "사용할 모델을 골라 주세요",
    effort: "사고 수준을 골라 주세요",
  }[step]
  async function finish() {
    if (!api || !connected || !model || saving) return
    setSaving(true)
    setSaveError("")
    try {
      await api.savePreferences(chosen)
      rememberCodexSetupChoice("completed")
      onDismiss()
    } catch {
      setSaveError("설정을 저장하지 못했습니다. 다시 시도해 주세요.")
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onDismiss()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/15 backdrop-blur-[2px]" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl outline-none">
          <div className="shrink-0 space-y-2 px-6 pt-6 pb-4">
            {step !== "intro" && (
              <p className="text-xs text-muted-foreground">
                {step === "login"
                  ? "1. 로그인"
                  : step === "model"
                    ? "2. 모델"
                    : "3. 사고 수준"}{" "}
                / 3단계
              </p>
            )}
            <Dialog.Title className="text-lg font-semibold">
              {title}
            </Dialog.Title>
            <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">
              {step === "intro"
                ? "일정 추가나 메모 저장 같은 간단한 작업을 채팅으로 요청하고 싶으신가요? Codex를 연결해 준비할 수 있어요."
                : step === "login"
                  ? "이 기기에 설치된 Codex와 로그인 상태를 공유합니다. ChatGPT 구독에 포함된 Codex 사용량을 활용합니다."
                  : step === "model"
                    ? "가벼운 작업을 위해 Luna를 우선 선택합니다. 설정에서 언제든 바꿀 수 있어요."
                    : "간단한 요청을 빠르게 처리하도록 기본값은 low(낮음)입니다."}
            </Dialog.Description>
          </div>
          <div className="min-h-0 space-y-4 overflow-y-auto px-6 pb-5 text-sm">
            {step === "intro" && (
              <div className="rounded-lg bg-muted p-4 text-muted-foreground">
                “내일 오후 3시 회의 추가해 줘”
                <br />
                “이 내용을 메모로 남겨 줘”
                <p className="mt-3 text-xs">
                  현재는 연결과 설정까지 지원하며, 채팅을 통한 실제 작업 실행은
                  준비 중입니다.
                </p>
              </div>
            )}
            {step === "login" && (
              <>
                <p role="status">
                  {connected
                    ? `${state.account?.email ?? "ChatGPT 계정"} 연결됨`
                    : connecting
                      ? "브라우저에서 로그인을 마치면 자동으로 연결됩니다."
                      : busy || state.status === "idle"
                        ? "Codex 설치와 로그인 상태를 확인하는 중…"
                        : state.status === "missing"
                          ? "Codex CLI를 설치한 뒤 다시 확인해 주세요."
                          : "ChatGPT 계정으로 로그인해 주세요."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {connecting ? (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void run("cancel")}
                    >
                      로그인 취소
                    </Button>
                  ) : (
                    !connected && (
                      <Button
                        disabled={
                          !api ||
                          busy ||
                          state.status === "idle" ||
                          state.status === "missing"
                        }
                        onClick={() => void run("connect")}
                      >
                        ChatGPT로 로그인
                      </Button>
                    )
                  )}
                  <Button
                    variant="outline"
                    disabled={!api || busy || connecting}
                    onClick={() => void run("check")}
                  >
                    다시 확인
                  </Button>
                  {state.status === "missing" && (
                    <Button
                      variant="ghost"
                      render={
                        <a
                          href="https://learn.chatgpt.com/docs/codex/cli"
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      설치 안내
                    </Button>
                  )}
                </div>
                {(error || state.error || state.modelsError) && (
                  <p role="alert" className="text-destructive">
                    {error || state.error || state.modelsError}
                  </p>
                )}
              </>
            )}
            {(step === "model" || step === "effort") && (
              <>
                <label htmlFor={selectId} className="block font-medium">
                  {step === "model" ? "모델" : "사고 수준"}
                </label>
                <select
                  id={selectId}
                  className="h-10 w-full rounded-md border bg-background px-3 text-foreground"
                  value={
                    step === "model"
                      ? (chosen.model ?? "")
                      : (chosen.reasoningEffort ?? "")
                  }
                  disabled={saving || !connected || busy}
                  onChange={(event) => {
                    if (step === "model") {
                      const next = state.models.find(
                        (item) => item.model === event.target.value
                      )
                      if (next)
                        setSelection({
                          model: next.model,
                          reasoningEffort: defaultSetupEffort(next),
                        })
                    } else
                      setSelection({
                        ...chosen,
                        reasoningEffort: event.target.value || null,
                      })
                  }}
                >
                  {step === "model" ? (
                    state.models.map((item) => (
                      <option key={item.model} value={item.model}>
                        {item.displayName}
                      </option>
                    ))
                  ) : model?.supportedReasoningEfforts.length ? (
                    model.supportedReasoningEfforts.map((item) => (
                      <option
                        key={item.reasoningEffort}
                        value={item.reasoningEffort}
                      >
                        {item.reasoningEffort} (
                        {effortLabels[item.reasoningEffort] ??
                          item.reasoningEffort}
                        )
                      </option>
                    ))
                  ) : (
                    <option value="">모델 기본값</option>
                  )}
                </select>
                {step === "model" &&
                  !state.models.some((item) =>
                    /luna/i.test(item.model + " " + item.displayName)
                  ) && (
                    <p className="text-xs text-muted-foreground">
                      현재 계정의 모델 목록에 Luna가 없어 사용 가능한 모델을
                      선택했습니다.
                    </p>
                  )}
                {step === "effort" && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      선택한 모델: {model?.displayName}
                    </p>
                    {!model?.supportedReasoningEfforts.some(
                      (item) => item.reasoningEffort === "low"
                    ) && (
                      <p className="text-xs text-muted-foreground">
                        이 모델은 low를 제공하지 않아 지원되는 수준을
                        선택했습니다.
                      </p>
                    )}
                  </>
                )}
                {!connected && (
                  <p role="alert" className="text-destructive">
                    연결을 다시 확인해 주세요.
                  </p>
                )}
              </>
            )}
            {saveError && step !== "intro" && (
              <p role="alert" className="text-destructive">
                {saveError}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t px-6 py-4">
            {step === "intro" ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    rememberCodexSetupChoice("skipped")
                    onDismiss()
                  }}
                >
                  사용하지 않을게요
                </Button>
                <Button
                  onClick={() => {
                    rememberCodexSetupChoice("started")
                    setStep("login")
                  }}
                >
                  사용할게요
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() =>
                    step === "login"
                      ? onDismiss()
                      : setStep(step === "effort" ? "model" : "login")
                  }
                >
                  {step === "login" ? "나중에" : "이전"}
                </Button>
                <Button
                  disabled={
                    !connected || busy || !model || !preferencesReady || saving
                  }
                  onClick={() =>
                    step === "effort"
                      ? void finish()
                      : setStep(step === "login" ? "model" : "effort")
                  }
                >
                  {saving
                    ? "저장 중…"
                    : step === "effort"
                      ? "설정 완료"
                      : "다음"}
                </Button>
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
