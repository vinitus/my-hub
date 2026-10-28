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
    // 열림 상태에 따른 min/max 제약이 반영된 다음 선호 너비를 복원한다.
    const frame = requestAnimationFrame(() => {
      leftPanel.current?.resize(
        settings.sidebarOpen ? settings.leftSidebarWidth : 0
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, settings.sidebarOpen, settings.leftSidebarWidth, leftPanel])
  useEffect(() => {
    if (!ready) return
    const frame = requestAnimationFrame(() => {
      rightPanel.current?.resize(
        settings.rightPanelOpen ? settings.rightPanelWidth : 40
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, settings.rightPanelOpen, settings.rightPanelWidth, rightPanel])

  const saveLeftLayout = () => {
    const panel = leftPanel.current
    if (!panel || !settings.sidebarOpen) return
    const leftSidebarWidth = Math.min(
      APP_PANEL_WIDTHS.left.max,
      Math.max(APP_PANEL_WIDTHS.left.min, Math.round(panel.getSize().inPixels))
    )
    if (leftSidebarWidth !== settings.leftSidebarWidth)
      onChange({ leftSidebarWidth })
  }
  const saveRightLayout = () => {
    const panel = rightPanel.current
    if (!panel || !settings.rightPanelOpen) return
    const rightPanelWidth = Math.min(
      APP_PANEL_WIDTHS.right.max,
      Math.max(APP_PANEL_WIDTHS.right.min, Math.round(panel.getSize().inPixels))
    )
    if (rightPanelWidth !== settings.rightPanelWidth)
      onChange({ rightPanelWidth })
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
          minSize={settings.sidebarOpen ? APP_PANEL_WIDTHS.left.min : 0}
          maxSize={settings.sidebarOpen ? APP_PANEL_WIDTHS.left.max : 0}
          groupResizeBehavior="preserve-pixel-size"
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
          disabled={!settings.sidebarOpen}
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
                disabled={!settings.rightPanelOpen}
                aria-label="오른쪽 현황 패널 크기 조절"
              />
              <ResizablePanel
                id="right-status-panel"
                panelRef={rightPanel}
                defaultSize={
                  settings.rightPanelOpen ? settings.rightPanelWidth : 40
                }
                minSize={
                  settings.rightPanelOpen ? APP_PANEL_WIDTHS.right.min : 40
                }
                maxSize={
                  settings.rightPanelOpen ? APP_PANEL_WIDTHS.right.max : 40
                }
                groupResizeBehavior="preserve-pixel-size"
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
