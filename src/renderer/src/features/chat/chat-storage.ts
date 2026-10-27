import { z } from "zod"

export const CHAT_KEY = "my-hub:chat:v1"
export const MAX_MESSAGES = 200
export const MAX_CHATS = 30
export const MAX_MESSAGE_LENGTH = 8000

// AI 연결 후 assistant/tool 메시지를 추가할 지점. 현재는 사용자 입력만 기록한다.
const MessageSchema = z.object({
  id: z.uuid(),
  role: z.literal("user"),
  content: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  createdAt: z.iso.datetime(),
})
const ConversationSchema = z.object({
  id: z.uuid(),
  messages: z.array(MessageSchema).max(MAX_MESSAGES),
  draft: z.string().max(MAX_MESSAGE_LENGTH),
})
const ChatStateSchema = z
  .object({
    version: z.literal(1),
    activeId: z.uuid(),
    conversations: z.array(ConversationSchema).min(1).max(MAX_CHATS),
  })
  .refine(
    (state) =>
      state.conversations.some((chat) => chat.id === state.activeId) &&
      new Set(state.conversations.map((chat) => chat.id)).size ===
        state.conversations.length
  )

export type Conversation = z.infer<typeof ConversationSchema>
export type ChatState = z.infer<typeof ChatStateSchema>

export function emptyConversation(): Conversation {
  return { id: crypto.randomUUID(), messages: [], draft: "" }
}

export function loadChats(): {
  state: ChatState
  error: string
  writable: boolean
} {
  const chat = emptyConversation()
  const fallback: ChatState = {
    version: 1,
    activeId: chat.id,
    conversations: [chat],
  }
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    return {
      state: raw ? ChatStateSchema.parse(JSON.parse(raw)) : fallback,
      error: "",
      writable: true,
    }
  } catch {
    // 손상된 기록을 빈 대화로 덮어쓰지 않는다. 이번 세션에서는 메모리만 사용한다.
    return {
      state: fallback,
      error:
        "기존 대화를 불러오지 못했습니다. 원본은 보존되며 이번 대화는 앱을 닫으면 사라집니다.",
      writable: false,
    }
  }
}

export function chatTitle(chat: Conversation) {
  return (
    chat.messages[0]?.content.replace(/\s+/g, " ").slice(0, 36) || "새 대화"
  )
}
