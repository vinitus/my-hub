import type { CodexAPI, CodexConnection } from "../../../../../shared/codex"
export const connection: CodexConnection = {
  status: "disconnected",
  executable: "fixture-codex",
  version: "0.0.0",
  account: null,
  error: "",
  models: [
    {
      id: "fixture",
      model: "fixture-model",
      displayName: "Fixture model",
      isDefault: true,
      defaultReasoningEffort: "low",
      supportedReasoningEfforts: [
        { reasoningEffort: "low", description: "Low" },
        { reasoningEffort: "high", description: "High" },
      ],
    },
  ],
  modelsError: "",
}
// Every operation is local and deterministic; no account, process or browser is opened.
export function adapter(status: CodexConnection["status"]): CodexAPI {
  const state = {
    ...connection,
    status,
    account:
      status === "connected"
        ? { email: "demo@example.com", plan: "Demo" }
        : null,
  }
  return {
    check: async () => state,
    connect: async () => state,
    disconnect: async () => ({
      ...state,
      status: "disconnected",
      account: null,
    }),
    cancel: async () => ({ ...state, status: "disconnected" }),
    preferences: async () => ({
      model: "fixture-model",
      reasoningEffort: "low",
    }),
    savePreferences: async (value) => value,
    onChange: () => () => {},
  }
}
