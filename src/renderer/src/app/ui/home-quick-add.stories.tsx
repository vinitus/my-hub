import { Toaster } from "@/shared/ui/sonner"
import { useState, useSyncExternalStore } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { HomePage } from "@/pages/home"
import { InboxStore, InboxQuickAddPopover, InboxView } from "@/features/inbox"
import type { InboxSnapshot } from "../../../../shared/inbox"

function HomeQuickAdd({ failSave = false }: { failSave?: boolean }) {
  const [open, setOpen] = useState(false)
  const [showInbox, setShowInbox] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{
    id: number
    itemId: string
  } | null>(null)
  const [store] = useState(() => {
    let snapshot: InboxSnapshot = {
      items: [],
      revision: "fixture-0",
      path: "fixture/inbox.json",
    }
    return new InboxStore({
      load: async () => snapshot,
      capture: async ({ drafts, expectedRevision }) => {
        await new Promise((resolve) => setTimeout(resolve, 120))
        if (failSave) throw new Error("인박스 저장 실패 테스트")
        if (expectedRevision !== snapshot.revision)
          throw new Error("인박스가 변경되었습니다.")
        snapshot = {
          ...snapshot,
          revision: `fixture-${snapshot.items.length + 1}`,
          items: [
            ...snapshot.items,
            ...drafts.map((draft) => ({
              ...draft,
              id: crypto.randomUUID(),
              createdAt: "2026-10-30T01:00:00.000Z",
              processedAt: null,
              destination: null,
            })),
          ],
        }
        return snapshot
      },
      process: async () => snapshot,
      remove: async () => snapshot,
      open: async () => {},
      chooseFiles: async () => null,
      captureFiles: async () => snapshot,
    })
  })
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return (
    <div className="flex h-screen min-h-0 flex-col">
      <div className="border-b p-2">
        <button onClick={() => setShowInbox((current) => !current)}>
          {showInbox ? "홈으로" : "인박스 화면 확인"}
        </button>
      </div>
      {showInbox ? (
        <InboxView
          focusRequest={focusRequest}
          items={state.snapshot?.items ?? []}
          loading={false}
          busy={false}
          error=""
          notice=""
          onCapture={store.captureText}
          onFiles={store.captureFiles}
          onChooseFiles={store.chooseFiles}
          onRefresh={() => {}}
          onOpen={() => {}}
          onProcess={() => {}}
          onRemove={store.remove}
          onConvert={() => {}}
        />
      ) : (
        <HomePage
          active
          onSave={async () => true}
          onCreateTodo={() => {}}
          onCreateEvent={() => {}}
          onCreateShortcut={() => {}}
          inboxAction={
            <InboxQuickAddPopover
              open={open}
              onOpenChange={setOpen}
              onSave={async (content) => {
                await store.initialize()
                if (!(await store.captureText(content, "홈 빠른 추가")))
                  throw new Error(store.getSnapshot().error)
              }}
            />
          }
          recentInboxItems={state.snapshot?.items}
          onOpenInbox={(itemId) => {
            setFocusRequest((current) => ({
              id: (current?.id ?? 0) + 1,
              itemId,
            }))
            setShowInbox(true)
          }}
        />
      )}
      <output className="sr-only" data-testid="home-inbox-items">
        {JSON.stringify(state.snapshot?.items ?? [])}
      </output>
    </div>
  )
}
const meta = {
  title: "앱/홈 인박스 빠른 추가",
  component: HomeQuickAdd,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story, context) => (
      <>
        <Story />
        <Toaster
          id="home-actions"
          hotkey={[]}
          theme={context.globals.theme === "dark" ? "dark" : "light"}
          position="bottom-center"
          closeButton
        />
      </>
    ),
  ],
} satisfies Meta<typeof HomeQuickAdd>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const SaveFailure: Story = { args: { failSave: true } }
