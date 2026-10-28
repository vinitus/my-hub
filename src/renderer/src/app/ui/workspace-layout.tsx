import { useEffect, useRef, type CSSProperties, type ReactNode } from "react"
import { usePanelRef } from "react-resizable-panels"
import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/ui/resizable"
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
  onChange: (patch: Partial<WorkspaceLayoutSettings>) => void
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
  const leftPanel = usePanelRef()
  const rightPanel = usePanelRef()
  const sidebarProvider = useRef<HTMLDivElement>(null)

  // Resizable는 명령형 API를 가지므로 저장된 설정을 외부 UI 상태와 동기화한다.
  // 복원으로 발생하는 onLayoutChanged는 사용자 변경으로 다시 저장하지 않는다.
  useEffect(() => {
    if (!ready) return
    if (settings.sidebarOpen)
      leftPanel.current?.resize(settings.leftSidebarWidth)
    else leftPanel.current?.collapse()
  }, [ready, settings.sidebarOpen, settings.leftSidebarWidth, leftPanel])
  useEffect(() => {
    if (!ready) return
    if (settings.rightPanelOpen)
      rightPanel.current?.resize(settings.rightPanelWidth)
    else rightPanel.current?.collapse()
  }, [ready, settings.rightPanelOpen, settings.rightPanelWidth, rightPanel])

  const saveLeftLayout = () => {
    const panel = leftPanel.current
    if (!panel) return
    if (panel.isCollapsed()) {
      if (settings.sidebarOpen) onChange({ sidebarOpen: false })
      return
    }
    const leftSidebarWidth = Math.min(
      APP_PANEL_WIDTHS.left.max,
      Math.max(APP_PANEL_WIDTHS.left.min, Math.round(panel.getSize().inPixels))
    )
    if (!settings.sidebarOpen || leftSidebarWidth !== settings.leftSidebarWidth)
      onChange({ sidebarOpen: true, leftSidebarWidth })
  }
  const saveRightLayout = () => {
    const panel = rightPanel.current
    if (!panel) return
    if (panel.isCollapsed()) {
      if (settings.rightPanelOpen) onChange({ rightPanelOpen: false })
      return
    }
    const rightPanelWidth = Math.min(
      APP_PANEL_WIDTHS.right.max,
      Math.max(APP_PANEL_WIDTHS.right.min, Math.round(panel.getSize().inPixels))
    )
    if (
      !settings.rightPanelOpen ||
      rightPanelWidth !== settings.rightPanelWidth
    )
      onChange({ rightPanelOpen: true, rightPanelWidth })
  }

  return (
    <SidebarProvider
      ref={sidebarProvider}
      className="h-svh overflow-hidden"
      open={settings.sidebarOpen}
      onOpenChange={(sidebarOpen) => onChange({ sidebarOpen })}
      style={
        {
          "--sidebar-width": `${settings.leftSidebarWidth}px`,
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <ResizablePanelGroup
        orientation="horizontal"
        className="app-sidebar-resizable-layout min-h-0 flex-1"
        disabled={!ready}
        onLayoutChanged={(_, meta) => {
          if (ready && meta.isUserInteraction) saveLeftLayout()
        }}
      >
        <ResizablePanel
          id="left-sidebar"
          panelRef={leftPanel}
          defaultSize={settings.sidebarOpen ? settings.leftSidebarWidth : 0}
          minSize={APP_PANEL_WIDTHS.left.min}
          maxSize={APP_PANEL_WIDTHS.left.max}
          groupResizeBehavior="preserve-pixel-size"
          collapsedSize={0}
          collapsible
          className="min-w-0"
          onResize={(size) =>
            sidebarProvider.current?.style.setProperty(
              "--sidebar-width",
              `${size.inPixels}px`
            )
          }
        >
          {sidebar}
        </ResizablePanel>
        <ResizableHandle
          withHandle
          className="max-md:hidden"
          aria-label="왼쪽 사이드바 크기 조절"
        />
        <ResizablePanel
          id="workspace"
          minSize={200}
          className="flex h-full min-h-0 min-w-0"
        >
          <SidebarInset
            className={`min-h-0 overflow-hidden md:m-2 md:rounded-xl md:shadow-sm ${settings.sidebarOpen ? "md:ml-0" : "md:ml-2"}`}
          >
            {header}
            <ResizablePanelGroup
              orientation="horizontal"
              className="relative min-h-0 flex-1"
              disabled={!ready}
              onLayoutChanged={(_, meta) => {
                if (ready && meta.isUserInteraction) saveRightLayout()
              }}
            >
              <ResizablePanel id="main-view" minSize={0} className="min-w-0">
                {children}
              </ResizablePanel>
              <ResizableHandle
                withHandle
                aria-label="오른쪽 현황 패널 크기 조절"
              />
              <ResizablePanel
                id="right-status-panel"
                panelRef={rightPanel}
                defaultSize={
                  settings.rightPanelOpen ? settings.rightPanelWidth : 40
                }
                minSize={APP_PANEL_WIDTHS.right.min}
                maxSize={APP_PANEL_WIDTHS.right.max}
                groupResizeBehavior="preserve-pixel-size"
                collapsedSize={40}
                collapsible
              >
                {statusPanel}
              </ResizablePanel>
            </ResizablePanelGroup>
          </SidebarInset>
        </ResizablePanel>
      </ResizablePanelGroup>
      {overlays}
    </SidebarProvider>
  )
}
