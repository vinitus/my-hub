import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { InboxView } from "./inbox-view"
import { InboxCaptureDialog } from "./inbox-capture"
import { inboxTextDraft, type InboxItem } from "../../../../../shared/inbox"

const fixtures: InboxItem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "text",
    content:
      "팀 회의에서 온보딩 개선안 이야기하기\n새로 합류한 동료가 첫날 필요한 자료를 쉽게 찾을 수 있도록.",
    source: "작업 중 떠오른 생각",
    createdAt: "2026-10-30T01:20:00.000Z",
    processedAt: null,
    destination: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    kind: "link",
    content: "https://example.com/design-notes",
    source: "브라우저에서 붙여넣기",
    createdAt: "2026-10-30T01:10:00.000Z",
    processedAt: null,
    destination: null,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    kind: "file",
    content: "C:\\자료\\제품 소개서.pdf",
    source: "파일 드롭",
    createdAt: "2026-10-30T01:00:00.000Z",
    processedAt: null,
    destination: null,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    kind: "text",
    content: "디자인 검토 자료 정리",
    source: "직접 입력",
    createdAt: "2026-10-29T07:00:00.000Z",
    processedAt: "2026-10-30T00:00:00.000Z",
    destination: { kind: "todo", title: "디자인 검토 자료 정리" },
  },
]
const meta = {
  title: "인박스/수집과 정리",
  component: InboxView,
  parameters: { layout: "fullscreen" },
  args: {
    items: fixtures,
    busy: false,
    loading: false,
    error: "",
    notice: "",
    onCapture: async () => true,
    onFiles: async () => true,
    onChooseFiles: async () => true,
    onRefresh: () => {},
    onOpen: () => {},
    onProcess: () => {},
    onRemove: async () => true,
    onConvert: () => {},
  },
} satisfies Meta<typeof InboxView>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Empty: Story = { args: { items: [] } }
export const FocusProcessed: Story = {
  args: { focusRequest: { id: 1, itemId: fixtures[3].id } },
}
export const Loading: Story = { args: { items: [], loading: true, busy: true } }
export const LoadError: Story = {
  args: {
    items: [],
    error: "인박스 파일을 읽지 못했습니다. 새로고침해 주세요.",
  },
}
export const CaptureDialog: Story = {
  render: (args) => (
    <InboxCaptureDialog {...args} open onOpenChange={() => {}} />
  ),
}
export const Interactive: Story = {
  render: function Interactive(args) {
    const [items, setItems] = useState(args.items)
    const [notice, setNotice] = useState("")
    return (
      <InboxView
        {...args}
        items={items}
        notice={notice}
        onCapture={async (content, source) => {
          setItems((current) => [
            {
              ...inboxTextDraft(content, source),
              id: crypto.randomUUID(),
              createdAt: "2026-10-30T02:00:00.000Z",
              processedAt: null,
              destination: null,
            },
            ...current,
          ])
          return true
        }}
        onProcess={(id, processed) =>
          setItems((current) =>
            current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    processedAt: processed ? "2026-10-30T02:10:00.000Z" : null,
                    destination: null,
                  }
                : item
            )
          )
        }
        onRemove={async (id) => {
          setItems((current) => current.filter((item) => item.id !== id))
          return true
        }}
        onConvert={(item, kind) => setNotice(`${kind}: ${item.content}`)}
        onFiles={async (files) => {
          setNotice(`${files.length}개 파일 수집 요청`)
          return true
        }}
      />
    )
  },
}
