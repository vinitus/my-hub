import { useEffect, useState } from "react"
import type { CodexConnection } from "../../../../shared/codex"

// 설정 화면과 첫 실행 안내는 UI만 분리하고, 연결 상태 구독과 IPC 호출은 공유한다.
export function useCodexConnection(active: boolean) {
  const api = window.api?.codex
  const [state, setState] = useState<CodexConnection>({
    status: "idle",
    executable: null,
    version: null,
    account: null,
    error: "",
    models: [],
    modelsError: "",
  })
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!active || !api) return
    let alive = true
    const unsubscribe = api.onChange((next) => {
      if (alive) setState(next)
    })
    void api.check().then(
      (next) => {
        if (alive) {
          setState(next)
          setError("")
        }
      },
      () => {
        if (alive)
          setError("Codex 상태를 확인하지 못했습니다. 다시 시도해 주세요.")
      }
    )
    return () => {
      alive = false
      unsubscribe()
    }
  }, [active, api])
  async function run(action: "check" | "connect" | "cancel" | "disconnect") {
    if (!api || working) return
    setWorking(true)
    setError("")
    try {
      setState(await api[action]())
    } catch {
      setError(
        "Codex에 연결하지 못했습니다. 앱을 다시 실행한 뒤 시도해 주세요."
      )
    } finally {
      setWorking(false)
    }
  }
  return {
    state,
    error,
    working,
    busy: working || state.status === "checking",
    run,
  }
}
