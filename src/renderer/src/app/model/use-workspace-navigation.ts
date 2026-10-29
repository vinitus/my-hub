import { useState } from "react"
import { NAVIGATION_ITEMS, type AppView } from "../config/navigation"

export function useWorkspaceNavigation(initialView: AppView = "home") {
  const [state, setState] = useState<{
    selected: AppView
    visited: ReadonlySet<AppView>
  }>(() => ({
    selected: initialView,
    visited: new Set<AppView>(["home", "notes", initialView]),
  }))
  // Fast Refresh can retain a view removed from navigation during development.
  const view = NAVIGATION_ITEMS.some((item) => item.id === state.selected)
    ? state.selected
    : "home"
  function navigate(next: AppView) {
    setState((current) =>
      current.selected === next
        ? current
        : {
            selected: next,
            visited: current.visited.has(next)
              ? current.visited
              : new Set([...current.visited, next]),
          }
    )
  }
  return { view, visited: state.visited, navigate }
}
