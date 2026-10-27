import type { ReactNode } from "react"
import { ArrowUpRightIcon, PencilIcon } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { SHORTCUT_LABELS, type Shortcut } from "../../../../../shared/shortcuts"
export function ShortcutTile({
  item,
  disabled,
  icon,
  onLaunch,
  onEdit,
}: {
  item: Shortcut
  disabled: boolean
  icon: ReactNode
  onLaunch: () => void
  onEdit: () => void
}) {
  return (
    <article className="group relative rounded-xl border bg-card transition-colors hover:border-foreground/25">
      <button
        type="button"
        disabled={disabled}
        className="flex w-full items-start gap-4 rounded-xl p-5 pr-12 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        onClick={onLaunch}
        title={item.target}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {item.name}
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {item.target}
          </span>
          <span className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
            {SHORTCUT_LABELS[item.kind]}
            <ArrowUpRightIcon className="size-3" />
          </span>
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="absolute top-3 right-3"
        aria-label={`${item.name} 수정`}
        title="바로가기 수정"
        disabled={disabled}
        onClick={onEdit}
      >
        <PencilIcon />
      </Button>
    </article>
  )
}
