import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
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
  const rightPanel = usePanelRef()
  const leftDrag = useRef<{
    pointerId: number | null
    x: number
    width: number
  } | null>(null)
  const [draftWidth, setDraftWidth] = useState<number | null>(null)
  const sidebarWidth = draftWidth ?? settings.leftSidebarWidth

  const clampSidebarWidth = (width: number) =>
    Math.min(
      APP_PANEL_WIDTHS.left.max,
      Math.max(APP_PANEL_WIDTHS.left.min, Math.round(width))
    )
  const cancelLeftResize = () => {
    leftDrag.current = null
    setDraftWidth(null)
  }

  // Resizable는 명령형 API를 가지므로 저장된 설정을 외부 UI 상태와 동기화한다.
  // 복원으로 발생하는 onLayoutChanged는 사용자 변경으로 다시 저장하지 않는다.
  useEffect(() => {
    if (!ready) return
    const frame = requestAnimationFrame(() => {
      rightPanel.current?.resize(
        settings.rightPanelOpen ? settings.rightPanelWidth : 40
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, settings.rightPanelOpen, settings.rightPanelWidth, rightPanel])

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
      className="h-svh overflow-hidden"
      data-sidebar-resizing={draftWidth !== null ? "" : undefined}
      open={settings.sidebarOpen}
      onOpenChange={(sidebarOpen) => {
        cancelLeftResize()
        onChange({ sidebarOpen })
      }}
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      {sidebar}
      <div
        role="separator"
        aria-label="왼쪽 사이드바 크기 조절"
        aria-orientation="vertical"
        aria-controls="workspace"
        aria-valuemin={APP_PANEL_WIDTHS.left.min}
        aria-valuemax={APP_PANEL_WIDTHS.left.max}
        aria-valuenow={sidebarWidth}
        aria-disabled={!ready || !settings.sidebarOpen}
        tabIndex={ready && settings.sidebarOpen ? 0 : -1}
        className={`fixed inset-y-0 left-(--sidebar-width) z-20 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center transition-[left] duration-200 ease-linear select-none group-data-[sidebar-resizing]/sidebar-wrapper:duration-0 after:h-6 after:w-1 after:rounded-lg after:bg-border focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden motion-reduce:transition-none ${settings.sidebarOpen ? "md:flex" : ""}`}
        onPointerDown={(event) => {
          if (!ready || !settings.sidebarOpen || event.button !== 0) return
          event.preventDefault()
          event.currentTarget.focus()
          event.currentTarget.setPointerCapture(event.pointerId)
          leftDrag.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            width: sidebarWidth,
          }
          setDraftWidth(sidebarWidth)
        }}
        onPointerMove={(event) => {
          const drag = leftDrag.current
          if (drag?.pointerId !== event.pointerId) return
          setDraftWidth(clampSidebarWidth(drag.width + event.clientX - drag.x))
        }}
        onPointerUp={async (event) => {
          const drag = leftDrag.current
          if (drag?.pointerId !== event.pointerId) return
          const leftSidebarWidth = clampSidebarWidth(
            drag.width + event.clientX - drag.x
          )
          // Keep the preview width until asynchronous settings persistence finishes.
          drag.pointerId = null
          try {
            if (leftSidebarWidth !== settings.leftSidebarWidth)
              await onChange({ leftSidebarWidth })
          } finally {
            if (leftDrag.current === drag) cancelLeftResize()
          }
        }}
        onPointerCancel={cancelLeftResize}
        onLostPointerCapture={() => {
          if (leftDrag.current?.pointerId != null) cancelLeftResize()
        }}
        onKeyDown={(event) => {
          if (!ready || !settings.sidebarOpen) return
          if (event.key === "Escape") {
            cancelLeftResize()
            return
          }
          const nextWidth =
            event.key === "ArrowLeft"
              ? sidebarWidth - 10
              : event.key === "ArrowRight"
                ? sidebarWidth + 10
                : event.key === "Home"
                  ? APP_PANEL_WIDTHS.left.min
                  : event.key === "End"
                    ? APP_PANEL_WIDTHS.left.max
                    : null
          if (nextWidth === null) return
          event.preventDefault()
          const leftSidebarWidth = clampSidebarWidth(nextWidth)
          if (leftSidebarWidth !== settings.leftSidebarWidth)
            onChange({ leftSidebarWidth })
        }}
      />
      <SidebarInset id="workspace" className="min-h-0 min-w-0 overflow-hidden">
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
            minSize={settings.rightPanelOpen ? APP_PANEL_WIDTHS.right.min : 40}
            maxSize={settings.rightPanelOpen ? APP_PANEL_WIDTHS.right.max : 40}
            groupResizeBehavior="preserve-pixel-size"
          >
            {statusPanel}
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
      {overlays}
    </SidebarProvider>
  )
}
