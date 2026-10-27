import { useEffect, useRef, useState } from "react"
import {
  ArrowUpIcon,
  CalendarPlusIcon,
  FilePenLineIcon,
  MessageSquareIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  CHAT_KEY,
  MAX_CHATS,
  MAX_MESSAGES,
  MAX_MESSAGE_LENGTH,
  chatTitle,
  emptyConversation,
  loadChats,
} from "./chat-storage"

const suggestions = [
  {
    icon: CalendarPlusIcon,
    title: "일정 이야기하기",
    text: "내일 오후 3시에 팀 회의 일정 추가해줘",
  },
  {
    icon: FilePenLineIcon,
    title: "생각 정리하기",
    text: "지금 떠오른 아이디어를 메모로 정리해줘",
  },
]

export function ChatWorkspace({ active }: { active: boolean }) {
  const [initial] = useState(loadChats)
  const [state, setState] = useState(initial.state)
  const [storageError, setStorageError] = useState(initial.error)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const transcript = useRef<HTMLDivElement>(null)
  const chat = state.conversations.find((item) => item.id === state.activeId)!
  const full = chat.messages.length >= MAX_MESSAGES

  // 초안도 함께 보관한다. 탭 전환/재시작 후 입력 중이던 내용을 이어 쓸 수 있다.
  useEffect(() => {
    if (!initial.writable) return
    const save = () => {
      try {
        localStorage.setItem(CHAT_KEY, JSON.stringify(state))
        setStorageError("")
      } catch {
        setStorageError(
          "대화를 저장하지 못했습니다. 앱을 닫기 전에 필요한 내용을 복사해 주세요."
        )
      }
    }
    const timer = window.setTimeout(save, 250)
    window.addEventListener("pagehide", save)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("pagehide", save)
      // 마지막 입력 직후 화면이 닫히는 경우에도 초안을 보관한다.
      try {
        localStorage.setItem(CHAT_KEY, JSON.stringify(state))
      } catch {
        /* 다음 저장 때 오류를 표시한다. */
      }
    }
  }, [state, initial.writable])

  useEffect(() => {
    if (active && transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight
  }, [active, chat.id, chat.messages.length])

  useEffect(() => {
    if (!input.current) return
    input.current.style.height = "auto"
    input.current.style.height = `${Math.min(input.current.scrollHeight, 200)}px`
  }, [chat.draft, active])

  function draft(value: string) {
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((item) =>
        item.id === current.activeId ? { ...item, draft: value } : item
      ),
    }))
  }

  function send() {
    const content = chat.draft.trim()
    if (!content || full) return
    const message = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content,
      createdAt: new Date().toISOString(),
    }
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((item) =>
        item.id === current.activeId
          ? { ...item, draft: "", messages: [...item.messages, message] }
          : item
      ),
    }))
    input.current?.focus()
    // 이후 AI 요청은 여기서 시작한다. 모델 응답/도구 실행을 UI의 가짜 성공 메시지로 대체하지 않는다.
  }

  function newChat() {
    setConfirmDelete(false)
    const empty = state.conversations.find(
      (item) => !item.messages.length && !item.draft
    )
    if (empty) setState({ ...state, activeId: empty.id })
    else if (state.conversations.length < MAX_CHATS) {
      const next = emptyConversation()
      setState({
        ...state,
        activeId: next.id,
        conversations: [next, ...state.conversations],
      })
    }
    input.current?.focus()
  }

  function deleteChat() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    const remaining = state.conversations.filter(
      (item) => item.id !== state.activeId
    )
    if (!remaining.length) remaining.push(emptyConversation())
    setState({ ...state, conversations: remaining, activeId: remaining[0].id })
    setConfirmDelete(false)
    input.current?.focus()
  }

  return (
    <section aria-label="AI 채팅" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-1.5 rounded-full bg-muted-foreground"
            aria-hidden="true"
          />
          <span className="text-xs text-muted-foreground">
            AI 연결 필요 · 추가 작업 필요
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <select
            aria-label="대화 기록"
            className="h-8 max-w-40 min-w-0 rounded-md border bg-background px-2 text-xs sm:max-w-64"
            value={state.activeId}
            onChange={(e) => {
              setConfirmDelete(false)
              setState({ ...state, activeId: e.target.value })
            }}
          >
            {state.conversations.map((item) => (
              <option key={item.id} value={item.id}>
                {chatTitle(item)}
              </option>
            ))}
          </select>
          <Button
            variant={confirmDelete ? "destructive" : "ghost"}
            size={confirmDelete ? "sm" : "icon-sm"}
            aria-label={
              confirmDelete ? "현재 대화 삭제 확인" : "현재 대화 삭제"
            }
            title="현재 대화 삭제"
            onClick={deleteChat}
          >
            <Trash2Icon />
            {confirmDelete && "삭제 확인"}
          </Button>
          {confirmDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              취소
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={newChat}
            disabled={
              state.conversations.length >= MAX_CHATS &&
              !state.conversations.some(
                (item) => !item.messages.length && !item.draft
              )
            }
          >
            <PlusIcon />새 대화
          </Button>
        </div>
      </div>
      {storageError && (
        <p
          role="alert"
          className="border-b bg-destructive/5 px-5 py-3 text-sm text-destructive"
        >
          {storageError}
        </p>
      )}
      <div
        ref={transcript}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {!chat.messages.length ? (
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 py-10 sm:px-8">
            <div className="mb-6 flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
              <MessageSquareIcon className="size-5" />
            </div>
            <p className="mb-2 text-xs font-medium tracking-widest text-muted-foreground">
              MY HUB
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              어떤 생각을 기록할까요?
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              일정과 메모로 남기고 싶은 이야기를 적어보세요.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {suggestions.map(({ icon: Icon, title, text }) => (
                <button
                  key={title}
                  type="button"
                  className="rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => {
                    draft(text)
                    input.current?.focus()
                  }}
                >
                  <Icon className="mb-3 size-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {text}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            role="log"
            aria-label="대화 내용"
            aria-live="polite"
            aria-relevant="additions"
            className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 sm:px-8"
          >
            {chat.messages.map((message) => (
              <article
                key={message.id}
                aria-label="내 메시지"
                className="ml-auto max-w-[90%] sm:max-w-[85%]"
              >
                <div className="rounded-2xl rounded-tr-sm bg-muted px-4 py-3 text-sm leading-7 wrap-anywhere whitespace-pre-wrap">
                  {message.content}
                </div>
                <p className="mt-1.5 text-right text-[11px] text-muted-foreground">
                  <span className="sr-only">보낸 시간 </span>
                  <time dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </p>
              </article>
            ))}
            <p className="text-center text-xs leading-5 text-muted-foreground">
              AI 연결과 일정·메모 생성 기능은 추가 작업이 필요합니다.
            </p>
          </div>
        )}
      </div>
      <div className="shrink-0 px-4 pt-3 pb-4 sm:px-8 sm:pb-6">
        <div className="mx-auto w-full max-w-3xl">
          {full && (
            <p role="status" className="mb-2 text-xs text-muted-foreground">
              대화당 {MAX_MESSAGES}개까지 기록할 수 있습니다. 새 대화를 시작해
              주세요.
            </p>
          )}
          {state.conversations.length >= MAX_CHATS && (
            <p className="mb-2 text-xs text-muted-foreground">
              대화 기록은 최대 {MAX_CHATS}개까지 보관합니다.
            </p>
          )}
          <form
            className="rounded-2xl border bg-background p-3 shadow-xs transition-shadow focus-within:ring-2 focus-within:ring-ring/30"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <textarea
              ref={input}
              aria-label="메시지"
              placeholder="메시지를 입력하세요…"
              value={chat.draft}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={2}
              className="block max-h-50 min-h-14 w-full resize-none bg-transparent px-1 py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground"
              onChange={(e) => draft(e.target.value)}
              onKeyDown={(e) => {
                // 한국어 조합 확정 Enter가 전송으로 처리되지 않도록 nativeEvent도 확인한다.
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="px-1 text-[11px] text-muted-foreground">
                Enter로 전송 · Shift+Enter로 줄바꿈
              </span>
              <Button
                type="submit"
                size="icon-sm"
                className="rounded-full"
                aria-label="메시지 전송"
                disabled={!chat.draft.trim() || full}
              >
                <ArrowUpIcon />
              </Button>
            </div>
          </form>
          <p className="mt-2.5 text-center text-[11px] leading-5 text-muted-foreground">
            AI 연결 필요 · 현재는 대화만 기록하며, AI 응답과 일정·메모 생성은
            추가 작업이 필요합니다.
          </p>
        </div>
      </div>
    </section>
  )
}
