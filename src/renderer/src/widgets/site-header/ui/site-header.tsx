import { Separator } from "@/shared/ui/separator"
import { SidebarTrigger } from "@/shared/ui/sidebar"
import { Button } from "@/shared/ui/button"
import { SearchIcon, SparklesIcon, InboxIcon } from "lucide-react"
import {
  LAUNCHER_SHORTCUTS,
  type LauncherShortcut,
} from "../../../../../shared/launcher-shortcut"

// 높이는 App.tsx의 --header-height를 사용한다.
// 화면 전환을 추가하면 현재 화면의 제목을 전달받도록 바꾼다.
export function SiteHeader({
  title,
  onQuickCommand,
  onAIQuickCommand,
  onInboxCapture,
  launcherShortcut = "ctrl+k",
}: {
  title: string
  onQuickCommand: () => void
  onAIQuickCommand?: () => void
  onInboxCapture?: () => void
  launcherShortcut?: LauncherShortcut
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
        {onInboxCapture && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-muted-foreground"
            aria-label="인박스에 수집"
            onClick={onInboxCapture}
          >
            <InboxIcon />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={`${onInboxCapture ? "" : "ml-auto"} gap-2 text-muted-foreground`}
          onClick={onQuickCommand}
          aria-keyshortcuts={LAUNCHER_SHORTCUTS[launcherShortcut].replace(
            "Ctrl",
            "Control"
          )}
          aria-label={`통합 검색 (${LAUNCHER_SHORTCUTS[launcherShortcut]})`}
        >
          <SearchIcon />
          <span className="hidden sm:inline">검색 및 실행</span>
          <kbd className="hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline">
            {LAUNCHER_SHORTCUTS[launcherShortcut]}
          </kbd>
        </Button>
        {onAIQuickCommand && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAIQuickCommand}
            aria-keyshortcuts="Control+Shift+k"
            aria-label="AI 빠른 입력 (Ctrl+Shift+K)"
            className="gap-2 text-muted-foreground"
          >
            <SparklesIcon />
            <span className="hidden sm:inline">AI 빠른 입력</span>
            <kbd className="hidden rounded border px-1.5 py-0.5 font-mono text-[10px] lg:inline">
              Ctrl+Shift+K
            </kbd>
          </Button>
        )}
      </div>
    </header>
  )
}
