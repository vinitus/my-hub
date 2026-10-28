import type { Todo } from "../../../../../shared/todos"

// 목록과 우측 현황은 같은 순서를 쓴다. 즐겨찾기를 먼저, 기한 없는 항목은 뒤로 보낸다.
export function compareTodoPriority(a: Todo, b: Todo) {
  return (
    Number(!!b.favorite) - Number(!!a.favorite) ||
    (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31")
  )
}
