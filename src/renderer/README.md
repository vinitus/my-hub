# Renderer 작업 안내

## 인박스

Ctrl+5와 사이드바에서 인박스를 연다. 헤더의 수집 버튼과 Ctrl+K의 `인박스에 수집` 명령은
현재 화면에서 작은 입력창을 연다. 생각·링크·파일을 직접 입력/붙여넣기/드롭으로 수집하고
나중에 메모·할일·일정·바로가기로 옮긴다. 출처·생성 시각·처리 여부를 저장하며 클립보드를 감시하지 않는다.
저장과 이동 동작은 [인박스 유지보수 안내](src/features/inbox/README.md)를 참고한다.

## 우측 실시간 현황 패널

`widgets/live-status`의 `LiveStatusPanel`이 우측 현황 패널을 연결한다.
`app/ui/workspace-layout.tsx`는 레이아웃 슬롯과 props/콜백만 받아 좌우 패널을 조절한다.
좌측은 shadcn의 `SidebarProvider → Sidebar + SidebarInset` 구성을 사용한다.
접을 때는 콘텐츠 폭을 유지한 채 offcanvas로 이동하고 gap만 줄여 내부 줄바꿈을 방지한다.
좌측 너비 조절 핸들은 포인터 드래그와 방향키·Home·End를 지원하며 완료 시 설정을 저장한다.
`react-resizable-panels`는 본문과 우측 현황 패널의 분할에만 사용한다.
기본 너비는 좌측 288px·우측 280px이고, 열린 패널의 최소 너비는 모두 200px이다.
최대 너비는 좌측 320px·우측 480px이다. 이전에 저장한 좌측 너비가 320px를 넘으면 읽을 때 보정한다.
드래그로는 200px 아래로 줄이거나 자동으로 접을 수 없다. 접기 버튼으로만 접으며,
접힌 너비(좌측 0px·우측 40px)는 저장된 펼침 너비를 변경하지 않는다.
너비 제한과 기본값은 루트 IPC 계약의 `APP_PANEL_WIDTHS`를 공유한다.
`ui/status-panel.tsx`는 props/콜백만 사용하고 고정 fixture의 Storybook 스토리를 갖는다.
오늘의 일정은 아직 시작하지 않은 오늘 일정만, 예정된 실행은 앞으로 시작할 일정 중
링크 실행을 설정한 항목만 표시한다. 종일 일정의 링크 실행은 알림과 같은 로컬 오전 9시 기준이다.
오늘 일정은 가장 가까운 1개와 남은 개수, 예정 실행은 최대 2개 일정과 대상 개수를 요약한다.
실행 대상은 대상 확인 버튼의 title로 확인하거나 전체 캘린더로 이동해 확인한다.
할일은 즐겨찾기보다 마감일을 먼저 정렬해 기한이 지난 항목·오늘 마감·다가오는 기한순으로 3개까지 표시한다.
나머지는 `외 N개`/전체 보기로 이동한다. 긴 제목은 두 줄 또는 줄임표와 전체 제목 title을 제공한다.
패널 자체는 링크를 실행하거나 별도 예약하지 않으며, 기존 main 알림 실행기를 그대로 사용한다.
바로가기는 현재 앱 실행 중 성공한 최근 실행 이력 중 최대 3개를 요약하고 나머지는 전체 보기로 연결한다.
최근 바로가기와 예정 실행이 없으면 해당 영역을 숨긴다.
`App`이 생성한 `ShortcutStore`를 바로가기 페이지와 패널이 공유해 등록·수정·삭제와 실행 이력을 동기화한다.
접힘 상태와 선호 너비는 `app-settings.json`에서 복원한다. 초기 복원·창 크기 변경은 다시 저장하지 않고,
사용자의 드래그와 접기 동작만 저장한다. 좁은 창의 왼쪽 탐색은 기존 모바일 시트를 사용한다.

사이드바 하단의 `src/features/weather`는 선택한 도시의 현재 날씨를 표시한다.
Open-Meteo 연결과 저장·갱신 규칙은 [날씨 유지보수 안내](src/features/weather/README.md)를 참고한다.

워크스페이스 메뉴와 번호는 `src/app/config/navigation.ts`에서 함께 관리한다.
홈은 앱의 시작 화면이고 Ctrl+H 홈, Ctrl+1 바로가기, Ctrl+2 메모, Ctrl+3 캘린더, Ctrl+4 할일, Ctrl+5 인박스로 이동한다.
`src/app/model/use-workspace-navigation.ts`가 선택 화면과 방문 이력을 한 상태로 관리한다.
방문 집합은 직접 변경하지 않고 화면 전환 시 필요한 경우에만 새 집합을 만든다.
`src/app/model/use-navigation-shortcuts.ts`가 키 입력을 처리하며 Ctrl을 누르는 동안
사이드바에 H·1·2·3·4·5를 표시한다. 키를 놓거나 창 포커스를 잃으면 단축키 표시를 숨긴다.
등록/수정 모달이 열린 동안에는 화면 이동 단축키를 적용하지 않는다.

중앙 작업 영역의 `features/shortcut-wheel` 공개 `ShortcutMenu`는 상시 버튼 없이
Ctrl 단독 또는 마우스 가운데(휠) 버튼을 200ms 누르면 커서 중심에 최대 8개 작업을 표시한다.
같은 slice의 `model/use-hold-quick-menu.ts`가 길게 누르기를 구독하고 짧은 입력·일반 스크롤·
Ctrl 조합 단축키·영역 밖 입력·열린 모달을 구분한다. 키/버튼을 누른 채 클릭해 선택하고,
놓으면 대기 타이머와 열린 메뉴를 즉시 취소한다. `App`이 기능 콜백을 주입하며
새 패키지나 전역 상태를 추가하지 않는다. 메모 작성은 기존 미저장 메모 처리 경로를 사용한다.
`model/use-shortcut-menu.ts`는 크기 측정·열림/닫힘·포커스·모달 구독 수명을 관리한다.
`shared/ui/floating-quick-menu.tsx`는 props/콜백만 사용하는 제어된 표시 컴포넌트다.
좌표 보정과 원형 배치는 순수 함수 `shared/lib/quick-menu-layout.ts`로 계산한다.
표시 상태 스토리는 고정 좌표·크기를 사용하고, feature 스토리에서 실제 길게 누르기를 검증한다.
할일·일정·바로가기는 `useHomeCreate`의 공용 store와 기존 Dialog 폼을 사용한다.
`features/calculator`는 홈의 접이식 계산기와 플로팅 메뉴의 계산기 Dialog가 공유한다.
계산 로직은 기존 사칙연산 파서를 그대로 사용하며 eval을 사용하지 않는다.
메뉴는 커서 중심에서 12시부터 시계 방향으로 펼쳐지고 ResizeObserver로 크기를 관찰한다.
반경은 5개 이하 80px, 6~8개 100px로 간격을 줄였다. 가장자리에서는 도착 위치를 보정한다.
원의 크기와 개수에 비해 작업 영역이 작으면
스크롤 가능한 목록으로 바꿔 사이드바와 현황 패널을 침범하지 않는다.
녹색 FAB 대신 앱의 popover·muted·accent 토큰을 사용해 차분한 중립색으로 표시한다.
CSS transform·opacity 열기 전환은 240ms/130ms, 항목 간격은 40ms이며 반복 호출도
현재 위치에서 반전된다. 닫힌 항목은 inert·tabIndex로 포커스에서 제외하고,
가장자리에서 배치 중심을 보정해도 각 항목은 실제 커서 위치에서 출발한다.
외부 클릭·Escape·포커스 이탈·다른 모달 열기·창 포커스 해제 시 닫는다.
영역 전체는 pointer-events: none이며 버튼만 입력을 받아 낙서장·스크롤을 가로채지 않는다.
설정의 **메뉴 애니메이션**은 켜기(기본)·시스템 설정 따르기·끄기를 제공한다.
`shortcutMenuMotion`은 기존 app-settings.json에 저장하고, 이전 파일에 없으면 켜기로 읽는다.
켜기는 OS의 모션 감소 설정과 관계없이 메뉴를 움직이고, 시스템 모드만
prefers-reduced-motion을 따른다. 끄기는 즉시 표시한다. 다른 UI의 모션 설정은 바꾸지 않는다.
다크 모드를 지원하고 Storybook은 로컬 콜백만 사용한다.
설정의 **커서 메뉴**에서 앱 기능과 등록된 프로그램·폴더·웹사이트 바로가기를 추가·제거한다.
추가 목록은 앱 기능과 등록된 바로가기를 나누어 표시하며, 바로가기의 실제 아이콘을 설정 목록과
커서 메뉴에서 공유한다. 아이콘을 가져오지 못하면 기존 종류별 기본 아이콘을 사용한다.
`shortcutMenuItems`는 중복 없는 최대 8개 항목이며, 기본 5개를 유지해 app-settings.json에 저장한다.
main에서 개수·중복·UUID를 검증하며 이전 설정 파일은 기본 목록으로 읽는다.
`app/model/use-configured-quick-menu.tsx`가 공용 ShortcutStore를 구독하고 설정 ID를 실제 기능에 연결한다.
삭제된 바로가기 항목은 비활성으로 표시해 설정에서 제거할 수 있으며 임의 경로를 설정에서 실행하지 않는다.

같은 slice의 이전 `ui/shortcut-wheel.tsx`는 Storybook에서만 사용하는 8개 원 애니메이션 미리보기다.
앱에는 `ShortcutMenu`만 마운트해 미리보기 및 기존 Ctrl 단축키와 중복 동작하지 않는다.
미리보기는 Ctrl 단독 또는 마우스 가운데(휠) 버튼을 400ms 누르면
커서 위치를 중심으로 작은 원 8개만 12시부터 시계 방향으로 순서대로 표시하는 미리보기다.
중심은 열린 위치에 고정하며 키/버튼 해제·Escape·창 포커스 해제 시 닫힌다.
기존 Ctrl 조합 단축키와 일반 휠 스크롤은 그대로 사용하고 열린 모달에서는 표시하지 않는다.
클릭·포커스를 가로채지 않는 애니메이션 단계이며 항목 등록·실행은 아직 연결하지 않았다.

사이드바 하단의 **설정**은 `src/features/settings/ui/settings-sheet.tsx`에서 표시한다.
`Ctrl+O`로도 열 수 있다. `src/app/App.tsx`에서 처리하며 다른 모달이 열려 있으면 중첩해서 열지 않는다.
라이트/다크/시스템 테마는 기존 `ThemeProvider`, 메모 폴더 변경은 `src/app/App.tsx`의 `useNote`를 사용한다.
`app/model/app-settings-store.ts`가 설정 초기 조회·이전·변경을 직렬 처리하고 Provider는 이를 구독한다.
이전 localStorage 테마는 파일 저장 성공 후 제거한다. 제어된 `ThemeProvider`는 변경 요청만 전달해
파일 저장에 실패한 테마가 별도 localStorage 값으로 남지 않게 한다.
설정이 열린 동안에는 메모 파일 단축키를 비활성화하며 자동 저장은 계속 동작한다.
설정의 **AI 연결 → Codex**는 로컬 Codex 설치/계정 확인과 브라우저 로그인을 제공한다.
구조와 인증 범위는 [Codex 연결 안내](src/features/settings/README.md)를 참고한다.
계정 연결과 모델·생각 수준 설정을 Ctrl+Shift+K의 캘린더·할일 AI 요청에 사용한다. 실행 구조와 한계는 `features/quick-command/README.md`를 참고한다.

`src/features/shortcuts`는 프로그램·폴더·웹사이트 바로가기를 관리한다.
대상 검증과 로컬 저장 구조는 [바로가기 유지보수 안내](src/features/shortcuts/README.md)를 참고한다.

앱 첫 화면은 `src/pages/home`이며 작은 빠른 작업 툴바, 최근 인박스 행, 낙서장, 접이식 계산기로 구성한다.
할일 추가·인박스 추가는 바로 표시하고 일정 추가·바로가기 등록은 더 보기 메뉴로 연다. 좁은 작업 영역에서는 줄바꿈한다.
최근 인박스는 기존 InboxStore 항목을 수집 시각순 최대 3개까지 작은 가로 행으로 보여 준다.
선택하면 인박스 화면의 필터와 검색을 맞춰 해당 항목을 표시하고 포커스한다. 처리 완료 항목도 열 수 있다.
인박스가 비어 있으면 영역 전체를 숨기며 별도 작업 이력·세션을 저장하지 않는다.
낙서장은 기본적으로 남는 높이를 채우며 바깥 테두리 하나만 표시하고 빈 입력에는 플레이스홀더를 제공한다.
하단 손잡이의 드래그 또는 위아래 화살표로 높이를 조절하고 Home 키로 자동 맞춤에 복귀한다.
수동 높이는 현재 홈 UI 상태에만 보관한다. 확대 버튼으로 다른 홈 요소를 숨겨 작성 영역을 넓힌다.
확대·축소해도 입력과 저장 상태를 유지하며 계산기는 기본적으로 접혀 있다.
`ui/home-page.tsx`가 `model/use-scratchpad.ts`와 props 기반 `ui/home-page-view.tsx`를 연결한다.
저장 결과는 idle/saving/saved/error 중 한 상태로만 관리해 모순된 플래그 조합을 피한다.
`app/model/use-scratchpad-save.ts`가 제목 생성과 기존 NoteStore 저장을 연결한다.
반복 저장용 문서 식별자는 화면에 표시하지 않으므로 state 대신 ref에 보관한다.
평소 입력은 메모에 연결하거나 자동 저장하지 않는다. Ctrl+S를 누르면 `codex:note-title`로
본문 앞 6,000자를 연결된 AI에 보내 제목을 생성한다. 기존 Codex 모델·사고 수준 설정을 사용하며
전체 본문은 NoteStore의 `saveText`로 전달해 기본 메모 폴더에 Markdown 파일로 저장한다.
제목 생성은 최대 60초 대기하며 실패·미연결·잘못된 제목이면 저장하지 않고 오류와 낙서장을 유지한다.
AI 제목을 파일명으로 검증하고 생성 중 상태·저장된 파일명을 홈에 표시한다.
반복 저장은 같은 메모를 갱신하되, 다른 메모를 열었거나 메모에서 본문을 바꾸었다면 새 메모로 보존한다.
전환 전 기존 미저장 메모를 먼저 저장하며 실패하면 덮어쓰지 않는다. 저장 후에도 낙서장 내용을 유지한다.
화면 이동 중 초안은 유지되며 앱 종료 후 복원하지 않는다. 하단 계산기는 펼칠 때만 수식 입력을 표시한다.
빠른 등록 버튼은 홈에 머문 채 shadcn Base UI Dialog로 할일·일정·바로가기 등록 폼을 연다.
`app/model/use-home-create.ts`가 공용 store 초기화와 모달 시작 시 revision을 고정하고,
`app/ui/home-create-dialog.tsx`가 기존 TodoForm·EventSheet·ShortcutSheet를 조합한다.
일정·바로가기 화면의 기존 Sheet는 유지하며 홈과 커서 메뉴의 빠른 등록은 Dialog 표시를 사용한다.
저장은 기존 store 경로로 목록과 우측 패널에 반영하고, 실패하면 폼 입력을 유지한다.
닫기·저장 후에도 낙서장을 유지하며 모달 안에서는 홈 저장·메뉴 이동 단축키를 적용하지 않는다.
빠른 작업의 **인박스 추가**는 버튼 아래에 단일 텍스트 입력 비모달 팝오버를 연다.
입력창 자동 포커스, Enter/저장 버튼, Escape/취소, 중복 제출 방지와 한글 조합 보호를 제공한다.
기존 InboxStore에 `홈 빠른 추가` 출처와 미처리 상태로 저장하며 성공 시 닫고 안내를 표시한다.
실패 시 입력과 오류를 유지한다. 취소·바깥 클릭·버튼 재클릭으로 닫아도 같은 홈 세션의 초안을 유지하며,
정상 저장하면 초안을 비운다. 인박스 빠른 추가는 낙서장 저장과 별개이며 명령/AI를 실행하지 않는다.
메모 전체 편집은 메모 메뉴에서 계속 사용할 수 있다. Ctrl+K 통합 액션 런처는 메모 제목·일정·할일·등록된 프로그램을 검색하고 실행한다.
로컬 결과는 종류별로 표시하고 AI 호출 없이 열기·완료·실행한다. `오늘 일정`은 오늘의 캘린더 일간 목록으로 이동한다.
설정에서 검색 실행 단축키를 Ctrl+K / Ctrl+Alt+K / Ctrl+Shift+Space 중 선택한다.
자연어 요청은 별도의 Ctrl+Shift+K AI 빠른 입력에서 처리한다.
AI 전송 후 우측 하단에서 작업 상태를 확인한다. 설정에서 ChatGPT를 연결한 뒤 사용할 수 있으며,
변경 요청은 전후 미리보기를 확인하고 적용한다. 저장 후 최근 작업은 실행 취소할 수 있다.
구조는 [빠른 입력 안내](src/features/quick-command/README.md)를 참고한다.

캘린더 화면은 `src/pages/calendar`, 편집·알림은 `src/features/calendar`에 있으며 FullCalendar와 기존 shadcn UI를 사용한다.
파일별 역할, 날짜 규칙, 로컬 저장 구조는 [캘린더 유지보수 안내](src/features/calendar/README.md)를 참고한다.
`src/app/App.tsx`가 홈/메모/캘린더/할일/바로가기 전환을 관리하고 방문한 작업 화면은 전환 후에도 마운트를 유지한다.
기존 아래 문서의 메모 구조는 메모 화면에 적용된다.

Electron 창 안에서 실행하는 React 화면이다. Vite root는 이 디렉터리이며,
`@/`와 `@renderer/`는 모두 `src/renderer/src`를 가리킨다.

## FSD 구조와 의존 경계

의존 방향은 `app → pages → widgets → features → entities → shared`다.
중간 레이어를 건너뛰어 아래 레이어를 사용할 수 있지만 위쪽 레이어나 같은 레이어의
다른 slice를 참조하지 않는다. 여러 기능·위젯의 조합은 상위 레이어에서 담당한다.

| 레이어 | 현재 책임 |
| --- | --- |
| `app` | `providers`의 설정 구독·전역 테마, `config`의 메뉴 정의, `model`의 설정 저장·모달 수명·단축키, `ui`의 패널 레이아웃, App의 store 수명·화면 조립 |
| `pages/notes` | 파일 도구·저장 상태·오류·편집기·본문 스크롤의 실제 화면 구성 |
| `pages/home` | 독립된 낙서장·명시적 파일 저장, 접이식 계산기, 작업 생성 바로가기 |
| `pages/calendar` | FullCalendar 어댑터·탐색·선택·일정 편집창 조립 |
| `pages/shortcuts` | 카드 목록·검색·필터·드롭·편집창 조립 |
| `widgets` | `app-sidebar`, `site-header`, `live-status`의 큰 UI 블록 |
| `features` | notes 편집·자동 저장·복구, calendar 편집·알림, shortcuts 관리·실행, settings의 테마·Codex 연결, weather 지역 선택·갱신, quick-command 입력 |
| `entities/calendar-event` | 공유 CalendarStore, 일정 날짜·입력 변환과 다음 일정 계산 |
| `shared/ui`, `shared/lib` | 로컬 shadcn UI와 도메인에 의존하지 않는 유틸리티·테마·사이드바 Context |

기능별 `ui`, `model`, `lib`는 각각 표시·상태/동작·순수 도구를 담는다. 독립적인
재사용이 없는 기능을 작은 slice로 쪼개지 않는다. notes store는 저장·편집 시나리오에
속하므로 feature에 남기며, 여러 화면에서 공유하는 캘린더 모델만 entity로 추출했다.
연결하지 않은 shadcn 예제는 `pages/dashboard/ui`, 예제 데이터는 `model`에 보존한다.
빈 레이어나 deprecated된 `processes`는 만들지 않는다.

slice 밖에서는 `index.ts`의 명시적 export를 사용한다. 예를 들어
`@/features/notes`, `@/entities/calendar-event`, `@/widgets/app-sidebar`로 가져온다.
같은 slice 내부는 상대 import를 사용하며 `export *`는 쓰지 않는다.
app과 shared에는 slice가 없으므로 shared의 공개 모듈은 `@/shared/ui/button`,
`@/shared/lib/utils`처럼 파일 단위로 사용한다. 전체 UI barrel은 만들지 않는다.
테스트는 구현 내부를 직접 검사할 수 있지만 제품 코드가 이 경로를 따라가면 안 된다.

AppSidebar는 메뉴 목록, 일정 현황과 날씨 영역을 props로 받는다. App이 세 위젯과
기능을 조립하므로 위젯끼리 서로 import하지 않는다. 메뉴 ID와 번호는 App의 config에
한 번만 정의한다. 캘린더 store는 App이 한 번 생성해 페이지와 일정 현황에 함께 전달한다.
메모는 즉시 로드하고 캘린더·바로가기는 page 공개 API를 lazy import한다.
방문한 화면을 숨겨서 마운트를 유지하는 처리, 모달 우선순위와 단축키는 그대로 유지한다.

`@/`, `@renderer/`는 모두 렌더러 루트의 alias다. 루트 `src/shared`는 별도의 Electron
IPC 타입·검증 계약이며 렌더러 FSD의 `shared`와 다르다. 도메인 코드가 이 계약을
참조할 때는 루트로 향하는 상대 경로를 사용한다. 렌더러 shared는 이 계약과
`window.api`에 의존하지 않는다. 네이티브 권한 검사·파일·프로그램 실행은 main에,
좁은 공개 API는 preload에 유지한다. 라우터나 상태 관리 라이브러리는 추가하지 않았다.

`pnpm lint`의 `fsd/boundaries`가 전체 렌더러 TS/TSX에서 상위 레이어·같은 레이어의
다른 slice 참조, 외부 slice 내부 경로 참조, wildcard export, 레거시 폴더 재도입,
Electron/Node/main/preload 직접 import와 shared의 IPC 의존을 오류로 처리한다.
정적·동적·타입 import와 re-export, 상대 경로 및 두 renderer alias를 검사한다.
규칙 구현은 루트 `scripts/eslint-fsd.mjs`에 있으며 추가 패키지가 필요하지 않다.

## shadcn 출처와 현재 구성

화면 레이아웃의 기반은 [shadcn Blocks](https://ui.shadcn.com/blocks)의
`dashboard-01`이다. 현재 사이드바와 본문은 메모 기능에 맞게 변경했다.
원본의 `nav-*`, 지표 카드, 차트, 데이터 테이블과 `pages/dashboard/model/data.json`은
참고용으로 남아 있으며 현재 App에는 연결하지 않는다.
`src/shared/ui`의 기본 UI도 shadcn에서 가져온 로컬 소스다.

루트 `components.json`은 `base-vega`, `neutral`, CSS 변수, Lucide 아이콘을 사용한다.
기본 UI는 Base UI의 `render` prop 등을 사용하므로 다른 스타일이나 Radix 기반 예제를
가져올 때 props를 확인한다. 일부 `"use client"`는 가져온 코드에 남은 지시문이며,
이 프로젝트는 Next.js가 아닌 Vite React 앱이다. `src/app`은 자동 라우팅 경로가 아니다.

## 화면이 연결되는 순서

```text
index.html
└─ src/main.tsx: React 마운트, app 공개 API
   └─ AppProviders: AppSettingsProvider, 로컬 ThemeProvider
      └─ src/app/App.tsx: store 수명, 화면·모달 조립, useNote의 문서 상태
         └─ WorkspaceLayout: SidebarProvider, 좌우 크기 조절·설정 동기화
            ├─ AppSidebar: 메뉴·메모 목록, 주입된 일정 현황·날씨
            ├─ SiteHeader: 사이드바 토글, 화면 이름
            ├─ HomePage / NotesPage / Calendar / Todos / Shortcuts
            │  └─ 메모는 NoteEditor의 Plate 편집기와 본문 스크롤을 사용
            ├─ LiveStatusPanel: 오늘 일정·할일·실행 예정·바로가기
            └─ SettingsSheet / QuickCommand / CodexSetupPrompt 등 전역 모달
```

## 메모의 편집·저장 구조

| 파일                                    | 역할                                               |
| --------------------------------------- | -------------------------------------------------- |
| `src/features/notes/model/use-note.ts`        | React 구독, 단축키, 창 닫기/포커스 이벤트          |
| `src/features/notes/model/note-store.ts`      | 문서 상태, 작업 큐, 자동 저장, 초안 복원           |
| `src/pages/notes/ui/notes-page.tsx` | 파일 버튼, 저장 상태, 오류, 편집 화면              |
| `src/features/notes/ui/note-editor.tsx`    | Plate 생명주기, 툴바, 붙여넣기, 슬래시 메뉴        |
| `src/features/notes/model/editor-plugins.tsx` | 지원하는 Markdown 노드와 입력 규칙의 허용 목록     |
| `src/features/notes/ui/note-elements.tsx`  | 실제 HTML 노드, 체크박스, 링크 렌더링              |
| `src/features/notes/lib/markdown.ts`        | 미지원 Markdown 검사                               |
| `src/features/notes/ui/notes.css`          | 에디터 안에만 적용하는 Markdown 서식               |
| `../shared/notes.ts`                    | main/preload/renderer가 공유하는 파일 API 타입     |
| `../preload/index.ts`                   | `window.api.notes`의 제한된 IPC 브리지             |
| `../main/notes.ts`                      | 네이티브 파일 대화상자, 파일 ID 관리, 닫기 확인    |
| `../main/note-files.ts`                 | UTF-8 읽기, 외부 변경 검사, 임시 파일 작성 후 교체 |
| `../main/note-library.ts`               | 기본 폴더/설정, 메모 목록, 중복 없는 새 파일 생성  |

- 문서는 한 번에 하나를 편집하며 저장 결과는 UTF-8 `.md` 텍스트다.
  사이드바에 지정 폴더의 메모를 최근 수정 순으로 표시하고 이름으로 검색한다.
  하위 폴더 탐색과 클라우드 동기화는 아직 제공하지 않는다.
- 지원 범위는 문단, 제목 1~6, 굵게, 기울임, 취소선, 인라인 코드, 목록,
  중첩 목록, 체크리스트, 인용문, 링크, 코드 블록, 구분선이다.
  체크리스트와 취소선은 GitHub Flavored Markdown 확장이다.
- 기본 입력은 즉시 서식으로 바뀐다. 예: `# `, `## `, `- `, `1. `, `> `.
  코드 펜스는 백틱 3개 뒤 Enter, 체크리스트는 `- [ ] `로 시작한다.
- 빈 문단에서 `/`를 누르면 블록 메뉴를 연다. 위/아래 키로 이동하고 Enter로 선택,
  Escape로 취소한다. 툴바에서도 블록과 인라인 서식을 선택할 수 있다.
- 표·이미지·HTML·각주 등은 열기와 붙여넣기 전에 검사해 거부한다.
  원본이 일부 사라진 상태로 저장되는 일을 방지하기 위한 범위 제한이다.
- 편집 중에는 Plate 노드 트리를 유지하고 변경 시 Markdown으로 직렬화한다.
  **입력마다 Markdown을 다시 deserialize하지 않는다.** 커서와 undo가 초기화된다.
  파일 열기/새 문서 생성 시 `note.key`가 바뀌어 에디터를 새로 만든다.
- `schema`나 플러그인을 확장할 때 렌더러, 입력 규칙, Markdown 변환, 허용 검사와
  `tests/notes.test.ts`의 왕복 변환 테스트를 함께 수정한다.

## 파일과 초안의 구분

상단 파일명은 더블클릭(키보드 Enter/F2)하여 수정한다. Enter나 포커스 이동으로 적용하고
Esc로 취소한다. `.md`는 자동으로 붙으며 새 메모는 첫 저장의 기본 파일명으로 사용한다.
저장된 메모는 본문 변경을 저장하지 않고 같은 폴더의 실제 파일명만 바꾼다.
같은 이름의 다른 파일은 덮어쓰지 않는다.

기본 메모 폴더는 Electron의 `app.getPath("documents")/My Hub/Notes`이다.
사용자의 문서 폴더가 OneDrive 등으로 이동되어 있어도 OS 경로를 따른다.
사이드바의 **설정 → 메모 폴더 변경**으로 고른 위치는 `app.getPath("userData")/notes-settings.json`에
기억한다. 폴더 변경은 파일을 이동하지 않으며, 열린 메모는 기존 위치를 계속 사용하고
다음 새 메모부터 선택한 폴더에 저장한다. 목록은 저장/파일명 변경 후, 앱 포커스 복귀,
새로고침 버튼으로 갱신한다.

입력을 1초 멈추면 새 메모도 대화상자 없이 기본 폴더에 자동 저장한다.
빈 새 메모는 자동 생성하지 않으며, 같은 이름이 있으면 `(2)`, `(3)`을 붙인다.
Ctrl/Cmd+S는 즉시 저장하고 다른 이름으로 저장만 파일 대화상자를 연다.
저장 중에도 본문 입력을 허용하고 완료 응답은 해당 스냅샷까지만 저장된 것으로 처리한다.
추가 입력은 다음 저장에 반영한다. 파일 작업은 큐에서 직렬 실행하며 메모 전환 전에
남은 변경을 저장한다. 저장 실패 시에만 저장·버리기·취소를 확인한다.
외부 변경 등으로 자동 저장이 실패하면 자동 재시도를 멈추고 오류를 표시한다.
명시적인 저장 재시도나 다른 이름으로 저장 성공 후 자동 저장을 재개한다.

`localStorage`의 `my-hub:markdown-draft:v1`은 마지막 편집 내용과 파일 경로/저장된
기준 내용을 임시 보관한다. 재시작 시 같은 폴더의 저장된 메모는 디스크 최신본으로
다시 열고, 미저장 초안이 있으면 기준 내용을 비교한 뒤 이어서 저장한다.
초안과 디스크가 모두 변경된 경우 원본을 유지하고 `(복원)` 메모를 별도로 만든다.
폴더 밖에서 열었던 파일이나 삭제된 파일은 깨끗한 초안만 남아 있으면 다시 만들지 않는다.
임시 보관이 실패하면 오류를 표시하며 실제 파일 저장은 계속 시도할 수 있다.

Renderer는 파일 경로를 임의로 지정해 저장할 수 없다. 폴더 목록에서 열거나 사용자가
대화상자에서 선택한 파일에 main이 ID를 발급하고, 이후 저장은 그 ID로만 요청한다. 저장 직전에
파일 내용의 외부 변경을 확인하며 충돌 시 원본을 덮어쓰지 않는다. 5MB 이하 UTF-8
메모를 지원한다. 브라우저 미리 보기에서는 편집/초안만 가능하며 네이티브 열기·저장은
Electron 앱에서만 제공한다.

| 단축키                 | 동작               |
| ---------------------- | ------------------ |
| Ctrl/Cmd+N             | 새 메모            |
| Ctrl+O                 | 설정 열기          |
| Ctrl/Cmd+S             | 저장               |
| Ctrl/Cmd+Shift+S       | 다른 이름으로 저장 |
| Ctrl/Cmd+B / I         | 굵게 / 기울임      |
| Ctrl/Cmd+Z             | 실행 취소          |
| Ctrl/Cmd+B (본문 바깥) | 사이드바 토글      |
| D (입력 중이 아닐 때)  | 테마 전환          |

## 레이아웃·테마 변경 위치

- App의 `h-svh overflow-hidden`과 상위 flex의 `min-h-0`를 유지한다.
  스크롤은 NotesPage의 본문에서 처리하며 툴바는 그 안에서 sticky로 유지한다.
- `--sidebar-width`와 `--header-height`는 App에서 정하고 공통 컴포넌트가 참조한다.
- `src/app/styles/index.css`의 `:root` / `.dark`로 색상·폰트·반경을 바꾼다.
  에디터 서식은 전역 UI를 건드리지 않고 `features/notes/ui/notes.css`에서 조정한다.
- 테마는 `shared/lib/theme-provider.tsx`의 로컬 Provider와 `useTheme`을 사용한다.
  아직 연결하지 않은 `ui/sonner.tsx`는 next-themes를 참조하므로 도입 시 맞춰야 한다.
- `ui/sidebar.tsx`는 cookie를 기록만 한다. 다시 시작할 때 복원하지는 않는다.
- 외부 리소스/통신은 `index.html`의 CSP와 루트 `vite.config.ts` 개발 예외도 확인한다.
  Vite 정적 파일 경로는 저장소 루트의 `public/`이다.

UI 추가 명령은 루트에서 `pnpm exec shadcn add <component>`를 실행한다.
기존 UI를 다시 가져올 때는 프로젝트 소유 소스의 로컬 수정과 diff를 비교한다.

## 확인 명령

저장소 루트에서 실행한다.

```bash
pnpm typecheck
pnpm test:notes    # Markdown/파일 IO/IPC, 폴더 설정, 자동 저장/충돌/재시작
pnpm test:calendar
pnpm test:shortcuts
pnpm test:weather
pnpm test:codex
pnpm lint
pnpm test:fsd      # FSD import 경계의 허용·차단 회귀 테스트
pnpm build
corepack pnpm build-storybook
pnpm dev          # main/preload를 다시 빌드하고 Electron 창 실행
```

main/preload 변경은 개발 서버의 HMR 대상이 아니므로 Electron을 닫고 `pnpm dev`를
다시 실행해야 한다. 일정 카드 스토리는 `src/widgets/live-status/ui`에 있으며
props와 고정 fixture로 동작해 Electron API나 실제 계정·파일을 사용하지 않는다.

## FSD 도입 검증 (2026-10-28)

페이지 분리, 위젯·공유 UI 이동, 기능 segment·공유 일정 모델 정리,
의존 경계 자동화의 각 단계에서 typecheck·lint·build를 통과했다.
추가한 런타임 라이브러리는 없으며 Electron main/preload와 루트 IPC 계약은 변경하지 않았다.

- 기존 테스트 81개 통과: notes 19, calendar 10, shortcuts 17, weather 15, codex 20.
- ESLint 경계 규칙의 허용·차단 예제 21개 통과.
- 임시 프로필·가짜 IPC로 최종 renderer 빌드를 실행해 페이지 lazy loading,
  Ctrl+1/2/3 이동, Plate·검색 필터·주간 보기 유지, store 재사용,
  편집창의 이동 차단과 Ctrl+O/K 모달 우선순위 등 20개 항목을 확인했다.
- Storybook 정적 빌드와 일정 카드 15개 실제 렌더링 통과. 예상 문구, 70px 높이,
  248/288px 컨테이너, 가로 넘침 없음, light/dark 토큰과 `window.api` 미사용을 확인했다.
- import와 의도한 페이지·Provider·주입 props 변경을 제외한 소스·테스트 84개의
  구현 보존을 비교했다. shadcn·Prettier·Storybook의 스타일 경로도 새 위치에 맞췄다.

위 실행 검증은 실제 사용자 파일·로그인·OS 프로그램 실행을 사용하지 않았다.
빌드에는 기준선부터 있던 500KB 초과 청크 경고가 남아 있다.

## FSD 요구사항 재검증 (2026-10-28)

- `app → pages → widgets → features → entities → shared` 구조와 public API를 전체 renderer lint로 검사했다. 위반은 없다.
- 화면 선택과 방문 상태, lazy page import, Ctrl+O/K 및 모달 제한은 app에 남아 있다. 공통 위젯은 props로 조립하고 CalendarStore 인스턴스를 공유한다.
- main/preload 및 루트 `src/shared`의 IPC 계약은 이번 재검증에서 변경하지 않았다. 기존 store와 UI 소스를 유지하며 라우터·상태 관리 패키지를 추가하지 않았다.
- `pnpm test:fsd`로 별칭·상대·동적·타입 import, re-export, public API, 같은 레이어 slice, native/IPC 경계와 bootstrap을 포함한 27개 사례를 반복 검증할 수 있다.
- typecheck, lint, renderer build, 기존 도메인 테스트 81개와 FSD 테스트 27개, Storybook 정적 빌드가 통과했다. 500KB 청크 경고는 기존과 같다.
- 이 재검증의 자동 테스트는 실제 사용자 계정·OS 알림·프로그램 실행을 사용하지 않는다. 기존 수동 검증 기록은 위 절에 별도로 보존한다.

## UI Storybook 작업

기준 문서는 루트의 `storybook-prompt.md`다 (기존 파일명의 오타를 정정했다).
공용 `shared/ui` 22개 모듈과 일정 편집·알림, 바로가기 편집·타일, 날씨 표시·검색,
Codex 연결·모델·첫 안내, 설정 시트, 메모 파일명·편집기, 빠른 입력과 앱 위젯을 다룬다.
기존 일정 상태 카드와 앱 패널·제어된 테마·Textarea·Dialog·홈 등록 모달·이동 단축키·AI 제목 저장·바로가기 휠·플로팅 퀵 메뉴·계산기·낙서장 표시/저장 상태를 포함해 206개 typed CSF 3 스토리가 있다.
각 상태는 별도 스토리로 구성하고, 날짜·시간·서비스 응답은 고정 fixture로 제공한다.
Toolbar의 Light/Dark는 포털을 포함해 문서 루트에 테마 클래스를 적용한다.

- `pnpm storybook`: 개발 서버와 스토리 탐색기
- `pnpm build-storybook`: 정적 Storybook 빌드
- `pnpm test:storybook`: 정적 빌드 후 전체 스토리를 숨겨진 Chromium에서 light/dark 및 360px로 렌더링한다. 일정 링크 입력의 DOM/포커스 유지, 빈 지역 검색, 키보드 파일명 변경도 검사한다.

패널 스토리는 실제 마우스 드래그, 최소 너비, 접기·복원, 입력 유지, 초기 설정 복원 중 저장 방지와
모바일 시트 공간을 검사한다. 테마 스토리는 저장 성공 전 변경 보류와 중복 저장 방지를 검사한다.
`STORYBOOK_TEST_FILTER` 환경 변수에 `workspace-layout`처럼 스토리 파일 경로 일부를 지정하면
해당 스토리만 재검증할 수 있다. 전체 검사 때는 변수를 비운다.

브라우저 검사는 기존 Electron 개발 의존성만 사용하며 별도 테스트 애드온을 설치하지 않는다.
임시 프로필, preload 없음, Node 통합 없음, 외부 요청·새 창 차단으로 실사용 파일·계정과 격리한다.
날씨는 `WeatherWidgetView`에 상태를, 바로가기 타일·알림 카드는 콜백을 주입한다.
일정 파일 선택과 Codex는 props로 인메모리 응답을 제공하며 전역 `window.api` mock은 없다.
첫 안내의 저장 콜백도 주입하므로 실제 온보딩 기록을 쓰지 않는다.
설정 테마의 시험용 저장 키는 `storybook:theme:*`다.
스토리용 fixture는 production 코드에서 import하지 않는다.

Plate 툴바와 노드 렌더러는 선택·undo Context를 공유하므로 실제 편집기를 함께 렌더링한다.
이 제약은 `note-editor.stories.tsx` 주석에 기록했다. 연결되지 않은 dashboard 예제는
실제 앱 UI 검토 대상에서 제외하고 원본을 보존한다. `storybook-static`과 검증 스크린샷은 커밋하지 않는다.

## React 규칙 최종 검토 (2026-10-28)

`rules-of-react.md`의 15개 항목을 전체 렌더러(보관 중인 dashboard 예제 포함)에 대조했다.

- 순수성·불변성: props/state를 직접 바꾸지 않는다. 테마 저장과 알림 ID 생성은 상태 갱신 함수 밖의 이벤트에서 수행한다. 스켈레톤과 story fixture는 결정적이다.
- Hooks·Effect: Strict Mode와 Hooks 권장 린트를 유지한다. 구독·타이머·키보드 이벤트에는 해제를 제공하고 비동기 조회는 종료된 Effect의 응답을 무시한다. 시간 갱신·외부 store·미디어 쿼리 등 외부 시스템 동기화에 Effect를 한정한다.
- key·상태: 편집 중 바뀌는 링크 문자열이나 목록 인덱스를 key로 사용하지 않는다. 표시용 dirty·disabled·날씨 설명은 입력에서 계산하고, 편집 초안·방문 화면·undo 상태는 동작 보존을 위해 유지한다.
- composition·재사용: 표시 UI에는 props/콜백을 전달하고 공통 구독은 기존 custom Hook으로 유지한다. Plate의 선택·undo 결합은 story 주석으로 설명한다.
- 메모이제이션·추상화: 툴팁 라벨의 불필요한 useMemo를 제거했다. Context 값과 외부 캘린더·DnD 어댑터의 안정적인 입력은 기존 memo를 유지한다.
- 접근성·타입: 입력 label/aria 연결과 per-instance useId를 사용한다. 공유 UI는 시맨틱 HTML을 유지하고 공개 props와 스토리를 TypeScript로 검사한다.

최종 검증: Node/web typecheck, 전체 lint, renderer/main/preload 빌드, 도메인 테스트 81개,
FSD 경계 테스트 27개, Storybook 정적 빌드가 통과했다. 전체 128개 스토리를 light/dark 및
360px 화면에서 검사하며 label 연결, 링크 입력 포커스 유지, 빈 지역 검색, 키보드 파일명 변경,
Strict Mode에서 테마 단축키 저장 1회를 회귀 검사한다. 실제 사용자 파일·로그인·OS 실행은 사용하지 않는다.
500KB 초과 번들 경고는 남아 있으며 빌드 실패는 아니다.

## 순차 재점검 (2026-10-28)

1. **React 규칙**: 전체 renderer의 Hook/Effect 정리, 불변 갱신, 목록 key, 파생 상태,
   접근성 연결과 Strict Mode 설정을 재확인했다. 추가 제품 코드 수정 없이
   typecheck·lint·build 및 도메인 테스트 81개가 통과했다.
2. **FSD**: 레이어 방향·slice 공개 API·같은 레이어 독립성, shared의 IPC 격리,
   App의 lazy loading·방문 화면 유지·공유 store 조립을 재확인했다. 전체 lint와 경계 테스트
   27개가 통과했다. 도입 전 조사 기록을 현재 구조로 오인하지 않도록 `fsd-prompt.md`에 상태를 표시했다.
3. **Storybook**: 지침 파일명을 `storybook-prompt.md`로 정정하고 관련 참조를 갱신했다.
   개발 서버 smoke test·정적 빌드·128개 스토리의 384회 렌더링이 통과했다.
   빈 인덱스·중복 ID·테마 미적용을 실패로 처리하며, 일정 카드 15개 고정 fixture의
   예상 문구·70px 높이·가로 넘침도 검사한다. 기존 핵심 상호작용 4개와 label 연결 검사도 통과했다.
   이번 재점검에서는 제품 TS/TSX 코드를 변경하지 않았다. 기존 500KB 번들 경고는 유지된다.

## 할일 (TODO)

사이드바 **할일** 또는 `Ctrl+4`로 제목·마감일·완료 여부를 관리한다.
`pages/todos`가 `features/todos`의 store와 props 기반 UI를 조립한다.
저장 형식과 검증은 [할일 안내](src/features/todos/README.md)를 참고한다.
