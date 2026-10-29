import { useId } from "react"
import {
  ExternalLinkIcon,
  LoaderCircleIcon,
  PlugIcon,
  RefreshCwIcon,
  TerminalIcon,
  UnplugIcon,
} from "lucide-react"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import type { CodexAPI, CodexConnection } from "../../../../../shared/codex"
import { CodexModelSettings } from "./codex-model-settings"
import { useCodexConnection } from "../model/use-codex-connection"

const labels: Record<CodexConnection["status"], string> = {
  idle: "미확인",
  checking: "확인 중",
  missing: "설치 필요",
  disconnected: "로그인 필요",
  connecting: "로그인 대기",
  connected: "연결됨",
  error: "연결 실패",
}

export function CodexConnectionPanel({
  active,
  api = window.api?.codex,
}: {
  active: boolean
  api?: CodexAPI
}) {
  const headingId = useId()
  const disconnectNoticeId = useId()
  const { state, error, busy, run } = useCodexConnection(active, api)
  const checking = state.status === "checking"
  const connecting = state.status === "connecting"
  const connected = state.status === "connected"
  return (
    <section aria-labelledby={headingId} className="space-y-3 border-t pt-6">
      <h3 id={headingId} className="text-sm font-medium">
        AI 연결
      </h3>
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <TerminalIcon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium">Codex</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              이 기기에 설치된 Codex로 연결
            </p>
          </div>
          <Badge variant={connected ? "default" : "secondary"}>
            {labels[state.status]}
          </Badge>
        </div>
        <dl className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">Codex 설치</dt>
            <dd title={state.executable ?? undefined}>
              {state.version
                ? `v${state.version}`
                : state.status === "missing"
                  ? "설치되지 않음"
                  : "미확인"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">ChatGPT 계정</dt>
            <dd className="min-w-0 text-right break-all">
              {state.account ? (
                <>
                  {state.account.email ?? "로그인됨"}
                  <span className="mt-1 block text-muted-foreground">
                    {state.account.plan}
                  </span>
                </>
              ) : connecting ? (
                "브라우저에서 로그인해 주세요."
              ) : (
                "연결되지 않음"
              )}
            </dd>
          </div>
        </dl>
        <p className="text-xs leading-relaxed text-muted-foreground">
          ChatGPT 계정으로 로그인해 구독에 포함된 Codex 사용량을 활용합니다. 이
          기기의 Codex CLI와 로그인 상태를 공유합니다.
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
                disabled={!api || busy || state.status === "missing"}
                onClick={() => void run("connect")}
              >
                {busy ? (
                  <LoaderCircleIcon className="animate-spin" />
                ) : (
                  <PlugIcon />
                )}
                ChatGPT로 연결
              </Button>
            )
          )}
          {connected && (
            <Button
              variant="outline"
              disabled={busy || !api?.disconnect}
              aria-describedby={disconnectNoticeId}
              onClick={() => void run("disconnect")}
            >
              <UnplugIcon />
              연결 해제
            </Button>
          )}
          <Button
            variant="outline"
            disabled={!api || busy || connecting}
            onClick={() => void run("check")}
          >
            <RefreshCwIcon className={checking ? "animate-spin" : ""} />
            다시 확인
          </Button>
          {(!state.executable || state.status === "error") && (
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
              <ExternalLinkIcon />
              설치 안내
            </Button>
          )}
        </div>
        {connected && (
          <p
            id={disconnectNoticeId}
            className="text-xs leading-relaxed text-muted-foreground"
          >
            연결을 해제하면 이 기기의 Codex CLI에서도 로그아웃됩니다.
          </p>
        )}
        {(!api || error || state.error) && (
          <p role="alert" className="text-xs leading-relaxed text-destructive">
            {!api
              ? "연결 기능을 사용하려면 앱을 완전히 닫고 다시 실행해 주세요."
              : error || state.error}
          </p>
        )}
        <p
          role="status"
          className="text-xs leading-relaxed text-muted-foreground"
        >
          {connecting
            ? "로그인 페이지를 브라우저에서 열었습니다. 완료하면 자동으로 연결됩니다."
            : connected
              ? "Codex 계정 연결이 확인되었습니다."
              : state.status === "missing"
                ? "Codex CLI 설치 후 다시 확인해 주세요."
                : checking
                  ? "Codex 설치와 로그인 상태를 확인하는 중…"
                  : "ChatGPT 계정으로 Codex를 연결해 주세요."}
        </p>
        <CodexModelSettings
          api={api}
          active={active}
          connection={state}
          busy={busy || connecting}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          연결한 계정과 모델 설정은 Ctrl+Shift+K의 일정·할일 AI 요청에
          사용합니다.
        </p>
      </div>
    </section>
  )
}
