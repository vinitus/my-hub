import { z } from "zod"

export const CodexPreferencesSchema = z
  .object({
    model: z.string().min(1).max(200).nullable(),
    reasoningEffort: z.string().min(1).max(40).nullable(),
  })
  .strict()
  .refine((value) => value.model !== null || value.reasoningEffort === null)
export type CodexPreferences = z.infer<typeof CodexPreferencesSchema>
export type CodexModel = {
  id: string
  model: string
  displayName: string
  isDefault: boolean
  defaultReasoningEffort: string | null
  supportedReasoningEfforts: { reasoningEffort: string; description: string }[]
}

export type CodexConnection = {
  status:
    | "idle"
    | "checking"
    | "missing"
    | "disconnected"
    | "connecting"
    | "connected"
    | "error"
  executable: string | null
  version: string | null
  account: { email: string | null; plan: string } | null
  error: string
  models: CodexModel[]
  modelsError: string
}

export type CodexAPI = {
  check: () => Promise<CodexConnection>
  connect: () => Promise<CodexConnection>
  cancel: () => Promise<CodexConnection>
  preferences: () => Promise<CodexPreferences>
  savePreferences: (preferences: CodexPreferences) => Promise<CodexPreferences>
  onChange: (callback: (connection: CodexConnection) => void) => () => void
}
