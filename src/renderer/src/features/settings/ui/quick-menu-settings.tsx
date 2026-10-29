import { useId, type ReactNode } from "react"
import { ChevronDownIcon, XIcon } from "lucide-react"
import { Button } from "@/shared/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import {
  quickMenuItemKey,
  type QuickMenuItem,
} from "../../../../../shared/app-settings"

export type QuickMenuOption = {
  item: QuickMenuItem
  label: string
  icon?: ReactNode
}
export function QuickMenuSettings({
  items,
  options,
  error,
  onChange,
}: {
  items: readonly QuickMenuItem[]
  options: readonly QuickMenuOption[]
  error?: string
  onChange: (items: QuickMenuItem[]) => void
}) {
  const id = useId()
  const selected = new Set(items.map(quickMenuItemKey))
  return (
    <section className="space-y-3 border-t pt-6" aria-labelledby={id}>
      <h3 id={id} className="text-sm font-medium">
        커서 메뉴{" "}
        <span className="text-muted-foreground">{items.length}/8</span>
      </h3>
      <p className="text-xs text-muted-foreground">
        Ctrl 또는 휠 버튼을 0.2초 누르면 열리고 놓으면 닫힙니다. 누른 채 항목을
        클릭하세요.
      </p>
      <ol className="space-y-2">
        {items.map((item, index) => {
          const key = quickMenuItemKey(item)
          const option = options.find(
            (option) => quickMenuItemKey(option.item) === key
          )
          const label = option?.label ?? "없는 바로가기"
          return (
            <li
              key={key}
              className="flex items-center gap-2 rounded-md border px-3 py-1 text-sm"
            >
              <span className="text-xs text-muted-foreground">{index + 1}</span>
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted [&_img]:size-full [&_img]:object-cover [&_svg]:size-4"
              >
                {option?.icon}
              </span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${label} 메뉴에서 제거`}
                onClick={() =>
                  onChange(
                    items.filter((current) => quickMenuItemKey(current) !== key)
                  )
                }
              >
                <XIcon />
              </Button>
            </li>
          )
        })}
      </ol>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          메뉴에 표시할 항목을 추가하세요.
        </p>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className="w-full justify-between" />
          }
          aria-label="메뉴 항목 추가"
          disabled={items.length >= 8}
        >
          {items.length >= 8
            ? "최대 8개까지 추가할 수 있습니다."
            : "항목 추가…"}
          <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {(["action", "shortcut"] as const).map((kind) => (
            <DropdownMenuGroup key={kind}>
              <DropdownMenuLabel>
                {kind === "action" ? "앱 기능" : "등록된 바로가기"}
              </DropdownMenuLabel>
              {options
                .filter(
                  (option) =>
                    option.item.kind === kind &&
                    !selected.has(quickMenuItemKey(option.item))
                )
                .map((option) => (
                  <DropdownMenuItem
                    key={quickMenuItemKey(option.item)}
                    data-menu-item-key={quickMenuItemKey(option.item)}
                    onClick={() => {
                      if (
                        items.length < 8 &&
                        !selected.has(quickMenuItemKey(option.item))
                      )
                        onChange([...items, option.item])
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted [&_img]:size-full [&_img]:object-cover [&_svg]:size-4"
                    >
                      {option.icon}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </DropdownMenuItem>
                ))}
              {kind === "shortcut" &&
                !options.some((option) => option.item.kind === "shortcut") && (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    바로가기 탭에서 먼저 등록하세요.
                  </p>
                )}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="text-xs text-muted-foreground">
        앱 기능과 등록된 프로그램·폴더·웹사이트 바로가기를 추가할 수 있습니다.
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
