import { useRef, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { HomePage } from "@/pages/home"
import { useScratchpadSave } from "../model/use-scratchpad-save"

function ScratchpadSavePreview({
  failure = "none",
  allowModeChange = false,
}: {
  failure?: "none" | "first-write" | "ai" | "missing"
  allowModeChange?: boolean
}) {
  const attempts = useRef(0)
  const [calls, setCalls] = useState<unknown[]>([])
  const [personal, setPersonal] = useState(false)
  const save = useScratchpadSave(
    async (markdown, previous, title) => {
      attempts.current++
      setCalls((current) => [
        ...current,
        { markdown, previous, title, personal },
      ])
      return {
        key: "fixture-note",
        markdown,
        name: title ?? "메모.md",
        saved: failure !== "first-write" || attempts.current > 1,
      }
    },
    failure === "missing"
      ? undefined
      : async () => {
          if (failure === "ai") throw new Error("AI 제목 생성 실패 테스트")
          return "회의 준비.md"
        },
    personal ? "personal" : "work"
  )
  return (
    <div className="flex h-screen min-h-0 flex-col">
      {allowModeChange && (
        <button
          data-testid="scratchpad-personal"
          onClick={() => setPersonal(true)}
        >
          개인 모드로 전환
        </button>
      )}
      <HomePage
        active
        onSave={save}
        onCreateTodo={() => {}}
        onCreateEvent={() => {}}
        onCreateShortcut={() => {}}
      />
      <output data-testid="scratchpad-writes" className="sr-only">
        {JSON.stringify(calls)}
      </output>
    </div>
  )
}
const meta = {
  title: "앱/낙서장 저장 연결",
  component: ScratchpadSavePreview,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ScratchpadSavePreview>
export default meta
type Story = StoryObj<typeof meta>
export const Success: Story = {}
export const RetryAfterWriteFailure: Story = {
  args: { failure: "first-write" },
}
export const AiFailure: Story = { args: { failure: "ai" } }
export const MissingAi: Story = { args: { failure: "missing" } }
export const ModeChange: Story = { args: { allowModeChange: true } }
