import { useEffect, useSyncExternalStore } from "react"
import { TodoStore, TodoWorkspace } from "@/features/todos"

export default function TodosPage({ store }: { store: TodoStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => {
    void store.initialize()
  }, [store])
  return (
    <TodoWorkspace
      items={state.snapshot?.items ?? []}
      revision={state.snapshot?.revision ?? ""}
      ready={state.snapshot !== null}
      busy={state.busy || state.loading}
      error={state.error}
      notice={state.notice}
      onSave={(todo, revision) => store.save(todo, revision)}
      onRemove={(id) => store.remove(id, state.snapshot?.revision ?? "")}
      onRefresh={() => {
        void store.refresh()
      }}
    />
  )
}
