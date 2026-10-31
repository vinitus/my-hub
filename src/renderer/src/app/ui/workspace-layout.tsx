import { useRef, type CSSProperties, type ReactNode } from "react"
import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar"
import { usePanelResize } from "../model/use-panel-resize"
import {
  APP_PANEL_WIDTHS,
  type AppSettings,
} from "../../../../shared/app-settings"

export type WorkspaceLayoutSettings = Pick<
  AppSettings,
  "sidebarOpen" | "leftSidebarWidth" | "rightPanelOpen" | "rightPanelWidth"
>
type Props = {
  settings: WorkspaceLayoutSettings
  ready: boolean
  onChange: (patch: Partial<WorkspaceLayoutSettings>) => void | Promise<unknown>
  sidebar: ReactNode
  header: ReactNode
  statusPanel: ReactNode
  children: ReactNode
  overlays?: ReactNode
}

export function WorkspaceLayout({
  settings,
  ready,
  onChange,
  sidebar,
  header,
  statusPanel,
  children,
  overlays,
}: Props) {
  const rightPanel = useRef<HTMLDivElement>(null)
  const leftResize = usePanelResize({
    width: settings.leftSidebarWidth,
    min: APP_PANEL_WIDTHS.left.min,
    max: APP_PANEL_WIDTHS.left.max,
    enabled: ready && settings.sidebarOpen,
    direction: 1,
    onCommit: (leftSidebarWidth) => onChange({ leftSidebarWidth }),
  })
  const rightResize = usePanelResize({
    width: settings.rightPanelWidth,
    min: APP_PANEL_WIDTHS.right.min,
    max: APP_PANEL_WIDTHS.right.max,
    enabled: ready && settings.rightPanelOpen,
    direction: -1,
    measure: () =>
      rightPanel.current?.getBoundingClientRect().width ??
      settings.rightPanelWidth,
    onCommit: (rightPanelWidth) => onChange({ rightPanelWidth }),
  })

  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
      data-sidebar-resizing={leftResize.resizing ? "" : undefined}
      open={settings.sidebarOpen}
      onOpenChange={(sidebarOpen) => {
        leftResize.cancel()
        onChange({ sidebarOpen })
      }}
      style={
        {
          "--sidebar-width": `${leftResize.width}px`,
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      {sidebar}
      <div
        {...leftResize.separatorProps}
        aria-label="왼쪽 사이드바 크기 조절"
        aria-controls="workspace"
        className={`fixed inset-y-0 left-(--sidebar-width) z-20 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center transition-[left] duration-200 ease-linear select-none group-data-[sidebar-resizing]/sidebar-wrapper:duration-0 after:h-6 after:w-1 after:rounded-lg after:bg-border focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden motion-reduce:transition-none ${settings.sidebarOpen ? "md:flex" : ""}`}
      />
      <SidebarInset id="workspace" className="min-h-0 min-w-0 overflow-hidden">
        {header}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <div id="main-view" className="min-w-0 flex-1 overflow-hidden">
            {children}
          </div>
          <div
            id="right-status-panel"
            ref={rightPanel}
            className="relative min-w-0 shrink-0"
            style={{
              width: settings.rightPanelOpen ? rightResize.width : 40,
              maxWidth: "100%",
            }}
          >
            <div
              {...rightResize.separatorProps}
              aria-label="오른쪽 현황 패널 크기 조절"
              aria-controls="right-status-panel"
              className={`absolute inset-y-0 -left-1.5 z-20 w-3 cursor-col-resize touch-none items-center justify-center select-none after:h-6 after:w-1 after:rounded-lg after:bg-border focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden ${settings.rightPanelOpen ? "flex" : "hidden"}`}
            />
            <div className="h-full overflow-hidden">{statusPanel}</div>
          </div>
        </div>
      </SidebarInset>
      {overlays}
    </SidebarProvider>
  )
}
