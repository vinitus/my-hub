import type { Todo } from "../../../../../shared/todos"

// 목록의 기본 정렬이다. 우측 현황은 마감일을 먼저 비교하고 같은 기한에서 이 정렬을 쓴다.
export function compareTodoPriority(a: Todo, b: Todo) {
  return (
    Number(!!b.favorite) - Number(!!a.favorite) ||
    (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31")
  )
}
