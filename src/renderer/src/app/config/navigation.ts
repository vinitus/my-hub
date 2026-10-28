import {
  ListTodoIcon,
  CalendarDaysIcon,
  FileTextIcon,
  LayoutGridIcon,
  HouseIcon,
} from "lucide-react"

// 메뉴 순서와 단축키를 함께 관리한다. 메뉴를 추가/이동할 때 이 목록을 수정한다.
export const NAVIGATION_ITEMS = [
  { id: "home", label: "홈", icon: HouseIcon },
  { id: "shortcuts", label: "바로가기", number: "1", icon: LayoutGridIcon },
  { id: "notes", label: "메모", number: "2", icon: FileTextIcon },
  { id: "calendar", label: "캘린더", number: "3", icon: CalendarDaysIcon },
  { id: "todos", label: "할일", number: "4", icon: ListTodoIcon },
] as const
export type AppView = (typeof NAVIGATION_ITEMS)[number]["id"]
