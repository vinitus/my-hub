import {
  CalculatorIcon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  FilePlusIcon,
  FileTextIcon,
  HouseIcon,
  LayoutGridIcon,
  ListTodoIcon,
} from "lucide-react"

export const QUICK_MENU_ACTIONS = [
  { id: "note", label: "메모 작성", icon: FilePlusIcon },
  { id: "todo", label: "할 일 추가", icon: ListTodoIcon },
  { id: "event", label: "일정 추가", icon: CalendarPlusIcon },
  { id: "shortcut", label: "바로가기 추가", icon: LayoutGridIcon },
  { id: "calculator", label: "계산기", icon: CalculatorIcon },
  { id: "home", label: "홈 열기", icon: HouseIcon },
  { id: "notes", label: "메모 열기", icon: FileTextIcon },
  { id: "calendar", label: "캘린더 열기", icon: CalendarDaysIcon },
] as const
