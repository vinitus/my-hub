# Renderer 작업 안내

Electron 창 안에서 실행하는 React 화면 영역이다. Vite의 root는 이 디렉터리이며,
`@/`와 `@renderer/`는 모두 `src/renderer/src`를 가리킨다.

## shadcn 출처와 현재 구성

화면의 기반은 [shadcn Blocks](https://ui.shadcn.com/blocks)의 `dashboard-01`이다.
사이드바, 헤더, 지표 카드, 차트, 테이블의 파일 구성이 해당 블록에 대응한다.
`src/components/ui`의 기본 UI도 shadcn에서 가져온 로컬 소스다.

루트 `components.json`의 현재 설정은 `base-vega`, `neutral`, CSS 변수 사용,
Lucide 아이콘이다. 이 프로젝트의 기본 UI는 Base UI의 `render` prop 등을 사용하므로
다른 shadcn 스타일이나 Radix 기반 예제를 가져올 때 해당 파일의 props를 확인한다.
일부 파일의 `"use client"`는 가져온 코드에 남은 지시문이며, 프로젝트는 Next.js가
아닌 Vite React 앱이다. `src/app/dashboard`도 자동 라우팅 디렉터리가 아니다.

## 화면이 연결되는 순서

```text
index.html
└─ src/main.tsx: React 마운트, 공통 ThemeProvider
   └─ src/App.tsx: 전체 창 레이아웃, SidebarProvider
      ├─ AppSidebar: 브랜드, 메뉴 데이터, 사용자 샘플
      │  ├─ NavMain: 주요 메뉴와 Quick Create/Inbox
      │  ├─ NavDocuments: 문서 링크와 메뉴
      │  ├─ NavSecondary: 설정/도움말/검색 링크
      │  └─ NavUser: 사용자 표시와 계정 메뉴
      └─ SidebarInset
         ├─ SiteHeader: 사이드바 토글과 고정 제목
         └─ 본문 스크롤 영역: 현재 비어 있음
```

현재 라우터와 메뉴 선택에 따른 본문 전환은 없다. App의 주석 처리된 본문에는
`SectionCards`, `ChartAreaInteractive`, `DataTable` 사용 예제가 남아 있다.
복원하려면 해당 JSX와 함께 아래 import를 추가한다.

```tsx
import { SectionCards } from "@/components/section-cards"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import data from "@/app/dashboard/data.json"
```

## 작업별 수정 위치

| 작업 | 시작할 파일 |
| --- | --- |
| 화면 추가, 본문 연결, 창 레이아웃 | `src/App.tsx` |
| 브랜드, 메뉴 항목, 샘플 사용자 교체 | `src/components/app-sidebar.tsx` |
| 메뉴 클릭 동작 | `src/components/nav-*.tsx` |
| 상단 제목 | `src/components/site-header.tsx` |
| 테마 저장, 시스템 테마, D 단축키 | `src/components/theme-provider.tsx` |
| 공통 색상, 폰트, 둥근 모서리 | `src/index.css` |
| 표의 필드, 셀, 정렬, 상세 Drawer | `src/components/data-table.tsx` |
| 차트 데이터, 기간 필터 | `src/components/chart-area-interactive.tsx` |
| 공통 UI의 스타일/동작 | `src/components/ui/*` |
| 반응형 JS 기준(768px 미만) | `src/hooks/use-mobile.ts` |
| 조건부 클래스 및 Tailwind 클래스 병합 | `src/lib/utils.ts`의 `cn` |

화면별 구성은 `components`에서 조합하고, 공통 UI 변경이 필요하면 `components/ui`를
수정한다. 이 파일들은 프로젝트 소유 소스이므로 shadcn 명령으로 다시 가져올 때는
로컬 수정 사항과 diff를 비교한다. 컴포넌트 추가 명령은 저장소 루트에서 실행한다.

```bash
pnpm exec shadcn add <component>
```

## 유지할 연결 관계

- **스크롤:** App은 `h-svh overflow-hidden`으로 창 높이를 고정하고 본문만
  `overflow-auto`로 스크롤한다. 중첩 flex 요소의 `min-h-0`를 제거하면 본문이
  늘어나 헤더나 창 전체가 스크롤될 수 있다.
- **크기와 반응형:** App의 `--sidebar-width`, `--header-height`를 사이드바와
  헤더가 참조한다. `@container/main`, `@container/card`는 컨테이너 쿼리 이름이며,
  `@xl/main`, `@[540px]/card` 등은 창이 아닌 해당 컨테이너의 폭을 기준으로 한다.
- **테마:** 로컬 ThemeProvider가 `localStorage`의 `theme`을 읽고 html에
  `light`/`dark`를 적용한다. 기본값은 `system`이며 입력 중이 아닐 때 D로 전환한다.
  테마 소비자는 `@/components/theme-provider`의 `useTheme`을 사용한다.
- **사이드바:** 헤더 토글과 Ctrl/Cmd+B가 같은 SidebarProvider를 제어한다.
  모바일 열림 상태는 별도다. `sidebar_state` cookie는 기록만 하며 현재 초기화 시
  읽어 복원하지 않는다.
- **Electron:** 브라우저 미리 보기에는 `window.electron`과 `window.api`가 없다.
  현재 renderer에는 이를 호출하는 코드가 없고 `window.api`도 비어 있다.
  앱 기능을 연결할 때 `../preload/index.ts`, `../preload/index.d.ts`와 필요한 main의
  IPC 핸들러를 함께 확인한다.
- **리소스/통신:** `index.html`에 CSP가 있고 개발용 예외는 루트 `vite.config.ts`에서
  추가한다. 외부 API나 이미지를 도입할 때 허용 출처도 확인한다. Vite 정적 파일은
  저장소 루트의 `public/`에서 제공한다.

## 실제 기능으로 연결하기 전 확인할 예제 코드

- 사이드바 URL은 `#`이다. NavMain은 `items.url`을 사용하지 않는 버튼이며
  Quick Create/Inbox에도 핸들러가 없다. `navClouds` 데이터는 렌더링하지 않는다.
- 문서의 Open/Share/Delete와 사용자 메뉴의 Account/Log out 등은 동작이 없다.
- SectionCards의 수치는 고정값이다. ChartAreaInteractive는 2024년 샘플과
  `2024-06-30` 기준 필터를 사용하므로 실데이터로 교체할 때 기준일도 바꾼다.
- DataTable은 최초 `data` prop을 로컬 상태에 복사한다. 이후 prop 갱신은 자동으로
  반영하지 않으며 드래그 순서는 메모리에만 유지된다. 행의 `id`는 고유하게 유지한다.
  `schema`는 현재 TypeScript 타입 추론에 사용하며 런타임 검증은 실행하지 않는다.
- 표의 Target/Limit 제출은 저장을 흉내 내는 타이머와 toast뿐이다. Reviewer,
  행 메뉴, 상세 Drawer의 Submit도 저장 기능이 연결되지 않았다.
- Toaster는 아직 마운트되지 않았다. `ui/sonner.tsx`는 `next-themes`의 훅을 쓰므로
  알림을 도입할 때 로컬 테마 훅으로 맞추거나 명시적인 `theme` prop을 전달하고,
  앱에 Toaster를 마운트한다.

## 확인 명령

저장소 루트에서 실행한다. 주석과 문서만 변경하면 화면 동작 변경은 필요하지 않다.

```bash
pnpm typecheck:web
pnpm lint
pnpm dev           # Electron 창과 renderer 개발 서버
pnpm preview       # renderer 빌드 후 브라우저에서 확인; Electron API 없음
```
