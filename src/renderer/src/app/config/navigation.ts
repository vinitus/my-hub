import {
  ListTodoIcon,
  CalendarDaysIcon,
  FileTextIcon,
  LayoutGridIcon,
  HouseIcon,
  InboxIcon,
} from "lucide-react"

// 메뉴 순서와 단축키를 함께 관리한다. 메뉴를 추가/이동할 때 이 목록을 수정한다.
export const NAVIGATION_ITEMS = [
  { id: "home", shortcut: "H", label: "홈", icon: HouseIcon },
  { id: "shortcuts", label: "바로가기", shortcut: "1", icon: LayoutGridIcon },
  { id: "notes", label: "메모", shortcut: "2", icon: FileTextIcon },
  { id: "calendar", label: "캘린더", shortcut: "3", icon: CalendarDaysIcon },
  { id: "todos", label: "할일", shortcut: "4", icon: ListTodoIcon },
  { id: "inbox", label: "인박스", shortcut: "5", icon: InboxIcon },
] as const
export type AppView = (typeof NAVIGATION_ITEMS)[number]["id"]
