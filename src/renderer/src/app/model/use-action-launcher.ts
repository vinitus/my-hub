import { useEffect, useSyncExternalStore } from "react"
import type { LauncherAction } from "@/features/quick-command"
import type { TodoStore } from "@/features/todos"
import type { ShortcutStore } from "@/features/shortcuts"
import type { CalendarStore } from "@/entities/calendar-event"
import type { NoteLibrarySnapshot } from "../../../../shared/notes"
import type { CalendarEvent } from "../../../../shared/calendar"

// 도메인 간 조립은 app이 소유한다. 런처 UI는 store나 Electron API를 참조하지 않는다.
export function useActionLauncher({
  open,
  library,
  noteBusy,
  openNote,
  todoStore,
  calendarStore,
  shortcutStore,
  onOpenEvent,
  onOpenTodos,
  refreshNotes,
  commands,
}: {
  open: boolean
  library: NoteLibrarySnapshot | null
  noteBusy: boolean
  openNote: (name: string) => Promise<void>
  todoStore: TodoStore
  calendarStore: CalendarStore
  shortcutStore: ShortcutStore
  onOpenEvent: (event: CalendarEvent) => void
  onOpenTodos: () => void
  refreshNotes: () => Promise<void>
  commands: LauncherAction[]
}) {
  const todos = useSyncExternalStore(todoStore.subscribe, todoStore.getSnapshot)
  const calendar = useSyncExternalStore(
    calendarStore.subscribe,
    calendarStore.getSnapshot
  )
  const shortcuts = useSyncExternalStore(
    shortcutStore.subscribe,
    shortcutStore.getSnapshot
  )
  useEffect(() => {
    if (!open) return
    void todoStore.refresh()
    void calendarStore.refresh()
    void shortcutStore.refresh()
    void refreshNotes()
  }, [open, todoStore, calendarStore, shortcutStore, refreshNotes])

  const actions: LauncherAction[] = [
    ...(library?.notes ?? []).map((note): LauncherAction => ({
      id: `note:${note.path}`,
      kind: "note",
      title: note.name.replace(/\.md$/i, ""),
      description: note.favorite ? "즐겨찾는 메모" : "메모 폴더",
      label: "열기",
      disabled: noteBusy,
      execute: () => openNote(note.name),
    })),
    ...(todos.snapshot?.items ?? []).map((todo): LauncherAction => ({
      id: `todo:${todo.id}`,
      kind: "todo",
      title: todo.title,
      description: `${todo.completed ? "완료됨" : "미완료"}${todo.dueDate ? ` · 마감 ${todo.dueDate}` : ""}`,
      label: todo.completed ? "열기" : "완료",
      disabled: todos.busy || todos.loading,
      execute: async () => {
        if (todo.completed) {
          onOpenTodos()
          return
        }
        const state = todoStore.getSnapshot()
        const current = state.snapshot?.items.find(
          (item) => item.id === todo.id
        )
        if (!current || !state.snapshot)
          throw new Error("할일 목록이 변경되었습니다. 다시 검색해 주세요.")
        if (current.completed) return "이미 완료한 할일입니다."
        if (
          !(await todoStore.save(
            { ...current, completed: true },
            state.snapshot.revision
          ))
        )
          throw new Error(
            todoStore.getSnapshot().error ||
              "할일을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요."
          )
        return `${current.title} 완료`
      },
    })),
    ...(calendar.snapshot?.events ?? []).map((event): LauncherAction => ({
      id: `event:${event.id}`,
      kind: "event",
      title: event.title,
      description: event.allDay
        ? `${event.start} · 종일`
        : new Date(event.start).toLocaleString("ko-KR"),
      keywords: `${event.start} ${event.description}`,
      label: "열기",
      disabled: calendar.busy || calendar.loading,
      execute: () => {
        const snapshot = calendarStore.getSnapshot().snapshot
        const current = snapshot?.events.find((item) => item.id === event.id)
        if (!snapshot || !current)
          throw new Error("일정 목록이 변경되었습니다. 다시 검색해 주세요.")
        onOpenEvent(current)
      },
    })),
    ...(shortcuts.snapshot?.items ?? []).map((shortcut): LauncherAction => ({
      id: `shortcut:${shortcut.id}`,
      kind: "shortcut",
      title: shortcut.name,
      description:
        shortcut.kind === "program"
          ? "등록된 프로그램"
          : shortcut.kind === "folder"
            ? "등록된 폴더"
            : "등록된 웹사이트",
      keywords: shortcut.target,
      label: "실행",
      disabled: shortcuts.busy || shortcuts.loading,
      execute: async () => {
        const current = shortcutStore
          .getSnapshot()
          .snapshot?.items.find((item) => item.id === shortcut.id)
        if (!current)
          throw new Error("바로가기가 삭제되었습니다. 다시 검색해 주세요.")
        if (!(await shortcutStore.launch(current)))
          throw new Error(
            shortcutStore.getSnapshot().error ||
              "프로그램을 실행할 수 없습니다. 잠시 후 다시 시도해 주세요."
          )
        return `${current.name} 열기 요청을 보냈습니다.`
      },
    })),
    ...commands,
  ]
  return {
    actions,
    loading: todos.loading || calendar.loading || shortcuts.loading,
    error: [todos.error, calendar.error, shortcuts.error]
      .filter(Boolean)
      .join(" · "),
  }
}
