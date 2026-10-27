import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { SparklesIcon } from "lucide-react"

// 높이는 App.tsx의 --header-height를 사용한다.
// 화면 전환을 추가하면 현재 화면의 제목을 전달받도록 바꾼다.
export function SiteHeader({
  title,
  onQuickCommand,
}: {
  title: string
  onQuickCommand: () => void
}) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <span className="text-base font-medium">{title}</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto gap-2 text-muted-foreground"
          onClick={onQuickCommand}
          aria-keyshortcuts="Control+k"
          aria-label="빠른 AI 입력 (Ctrl+K)"
        >
          <SparklesIcon />
          <span className="hidden sm:inline">빠른 입력</span>
          <kbd className="rounded border px-1.5 py-0.5 font-mono text-[10px]">
            Ctrl K
          </kbd>
        </Button>
      </div>
    </header>
  )
}
