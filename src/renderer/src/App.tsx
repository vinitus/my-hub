import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

// shadcn dashboard-01을 바탕으로 만든 앱 레이아웃. 구조 안내: ../README.md
// SidebarProvider의 CSS 변수는 사이드바와 SiteHeader에서 함께 사용한다.
export function App() {
  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="min-h-0 overflow-hidden">
        <SiteHeader />

        {/* 창 전체 대신 본문만 스크롤한다. 상위 flex 요소의 min-h-0도 유지한다. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <div className="@container/main flex min-h-0 flex-1 flex-col gap-2">
            {/* dashboard-01 예제 본문은 현재 비활성 상태다.
                복원할 때 아래 컴포넌트 3개와 @/app/dashboard/data.json의 import도 추가한다. */}
            {/* <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />

              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>

              <DataTable data={data} />
            </div> */}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
