import { useEffect, useState, useSyncExternalStore } from "react"
import { TodoStore, TodoWorkspace } from "@/features/todos"

export default function TodosPage() {
  const [store] = useState(() => new TodoStore(window.api?.todos))
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => {
    void store.initialize()
  }, [store])
  return (
    <TodoWorkspace
      items={state.snapshot?.items ?? []}
      ready={state.snapshot !== null}
      busy={state.busy || state.loading}
      error={state.error}
      notice={state.notice}
      onSave={(todo) => store.save(todo, state.snapshot?.revision ?? "")}
      onRemove={(id) => store.remove(id, state.snapshot?.revision ?? "")}
      onRefresh={() => {
        void store.refresh()
      }}
    />
  )
}
