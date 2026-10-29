# My Hub FSD 도입 조사 보고서

> 현재 상태 (2026-10-28 재점검): FSD 도입은 완료되었다. 아래의 기존 구조·이동 후보·첫 구현 프롬프트는 도입 전 조사 기록이다. 후속 작업은 `src/renderer/README.md`와 실제 코드를 기준으로 하며, 완료된 이동을 다시 수행하지 않는다. 전체 renderer 경계 lint와 `pnpm test:fsd` 27개가 통과했다.

- 조사일: 2026-10-28
- 범위: Electron 앱 전체가 아니라 `src/renderer/src`의 React 렌더러에 Feature-Sliced Design(FSD)을 점진적으로 적용하는 방안
- 결론: FSD 도입은 가능하고, 현재 `features/` 중심 구조에서 시작하기 좋다. 다만 모든 코드를 한 번에 옮기거나 전역 상태 라이브러리를 추가하지 말고, 화면 조립부와 레이어 경계를 먼저 세운 뒤 기능 단위로 옮기는 편이 안전하다.

## 요약

이 프로젝트는 이미 `features/notes`, `features/calendar`, `features/shortcuts`처럼 도메인 기준으로 코드를 모으고 있다. 따라서 FSD를 처음부터 다시 설계할 필요는 없다. 현재 구조에 빠진 `app`, `pages`, `widgets`, `entities`, `shared`의 책임을 구분하고, 기존 기능을 조금씩 올바른 위치로 이동시키면 된다.

적용 범위는 React 렌더러로 한정한다. Electron의 `src/main`, `src/preload`, 그리고 main/preload/renderer가 함께 쓰는 루트 `src/shared`는 FSD 폴더 구조로 재편하지 않는다. 이 폴더들은 렌더러 아키텍처가 아니라 프로세스 경계와 IPC 계약을 표현한다. 렌더러 FSD의 `shared`와 이름이 겹치므로 문서와 import 경로에서 두 영역을 분명히 구분해야 한다.

FSD는 라이브러리나 상태 관리 도구가 아니라 폴더와 의존 방향을 정하는 아키텍처 방법이다. 현재의 `useSyncExternalStore` 기반 Calendar/Note/Shortcut store, 테마 Context, 사이드바 Context를 교체할 이유가 없다. 필요한 범위의 상태를 기존 store와 React state로 관리하면 된다.

## 현재 프로젝트 구조와 관찰

렌더러는 React 19, TypeScript, Vite, Electron을 사용한다. shadcn에서 가져온 UI는 `src/renderer/src/components/ui`에 로컬 소스로 들어 있고, 주요 앱 코드는 `src/renderer/src/features` 아래에 기능별로 모여 있다. `App.tsx`가 현재 화면 전환과 전역 모달, 앱 레이아웃을 직접 조립한다. 현재 `AppView` 전환은 자체 상태와 `NAVIGATION_ITEMS`를 쓰므로 FSD 적용에 React Router를 새로 도입할 필요가 없다.

기능별 상태는 도메인 store와 hook으로 분리되어 있다. 메모는 `note-store.ts`와 `use-note.ts`, 캘린더는 `calendar-store.ts`, 바로가기는 별도 store/hook 경계를 가진다. 앱 전체를 위한 단일 전역 상태 저장소는 없다. FSD는 이 상태 관리 결정을 대신하지 않는다.

현재 렌더러의 주요 디렉터리는 다음과 같다.

```text
src/renderer/src/
├─ App.tsx
├─ components/
│  ├─ app-sidebar.tsx
│  ├─ site-header.tsx
│  ├─ theme-provider.tsx
│  └─ ui/...
├─ features/
│  ├─ calendar/
│  ├─ live-status/
│  ├─ notes/
│  ├─ quick-command/
│  ├─ settings/
│  ├─ shortcuts/
│  └─ weather/
├─ hooks/
└─ lib/
```

이미 기능 응집은 어느 정도 되어 있지만 모든 폴더가 같은 의미의 “feature”는 아니다. 예를 들어 메모/캘린더 작업 화면은 페이지 수준이고, 사이드바는 여러 도메인을 결합한 큰 UI이며, 개별 사용자 동작과 도메인 데이터 모델은 더 낮은 레이어에 속한다. 현재 구조를 유지하며 파일을 재배치하는 것만으로 끝내면 FSD의 이점을 충분히 얻지 못하므로, 특히 import 경계와 public API를 함께 도입해야 한다.

## FSD 원칙과 이 프로젝트에 적용할 해석

FSD 공식 문서는 `app`, `processes`(deprecated), `pages`, `widgets`, `features`, `entities`, `shared` 레이어를 정의한다. 모든 레이어를 반드시 사용할 필요는 없다. 이 앱에서는 deprecated된 `processes`를 만들지 않는다.

레이어 의존 방향은 위에서 아래로만 허용한다.

```text
app
 ↓
pages
 ↓
widgets
 ↓
features
 ↓
entities
 ↓
shared
```

중간 레이어를 건너뛰어 아래 레이어를 직접 사용하는 것은 가능하다. 예를 들어 `pages`는 `features`, `entities`, `shared`를 사용할 수 있다. 반대로 `features`가 `pages`나 `widgets`를 import하면 안 된다. 같은 레이어에 있는 별도 slice끼리 직접 import하지 않는다. 한 slice 내부에서는 필요한 구조를 자유롭게 정할 수 있지만, 다른 slice가 내부 파일 경로를 알지 않도록 public API를 둔다.

레이어는 책임의 높이, slice는 제품 도메인/기능의 응집도, segment는 기술적 목적을 표현한다. 보통 `ui`, `model`, `api`, `lib`, `config`를 segment로 쓴다. `components`, `hooks`, `types`처럼 코드의 형태만 설명하는 segment는 목적을 찾기 어렵게 하므로 피한다.

## 권장 목표 구조

한 번에 이 트리를 만들 필요는 없다. 초기에는 실제 코드가 있는 slice와 segment만 생성한다.

```text
src/renderer/src/
├─ app/
│  ├─ providers/
│  ├─ styles/
│  ├─ shell/                 # 최상위 앱 프레임 조립
│  ├─ model/                 # 선택 화면, 방문 상태 등 앱 수명 상태
│  └─ index.ts               # 필요할 때만 public API
├─ pages/
│  ├─ notes/
│  │  ├─ ui/
│  │  └─ index.ts
│  ├─ calendar/
│  │  ├─ ui/
│  │  └─ index.ts
│  └─ shortcuts/
│     ├─ ui/
│     └─ index.ts
├─ widgets/
│  ├─ app-sidebar/
│  │  ├─ ui/
│  │  ├─ model/              # 위젯 자체 UI 상태가 생길 때만
│  │  └─ index.ts
│  ├─ site-header/
│  │  ├─ ui/
│  │  └─ index.ts
│  ├─ live-status/           # 우측 현황/일정 상태 등 여러 도메인 조합
│  │  ├─ ui/
│  │  └─ index.ts
│  └─ weather-summary/       # 사이드바에서 날씨를 조립할 필요가 확인될 때
│     ├─ ui/
│     └─ index.ts
├─ features/
│  ├─ note-edit/             # 편집, 저장, 열기 등 사용자 시나리오
│  ├─ calendar-manage/       # 일정 생성/수정/삭제
│  ├─ calendar-reminders/    # 알림과 링크 실행 설정/동작
│  ├─ shortcut-manage/       # 등록/수정/삭제/실행
│  ├─ quick-command/         # Ctrl+K 입력과 작업 상태
│  ├─ settings/              # 설정 시트와 설정 변경 동작
│  ├─ codex-connection/      # 계정 연결/모델 설정, 기존 settings 하위 분리는 선택
│  └─ weather-location/      # 위치 검색/선택 같은 명시적 사용자 동작이 있을 때
├─ entities/
│  ├─ note/                  # 도메인 모델이 여러 기능/화면에서 실제 공유될 때
│  ├─ calendar-event/        # 일정 타입/표현/도메인 규칙이 재사용될 때
│  └─ shortcut/              # 바로가기 데이터가 여러 slice에서 공유될 때
├─ shared/
│  ├─ ui/                    # shadcn 기반 범용 UI
│  ├─ lib/                   # 날짜/문자열 등 실제로 범용인 도구
│  ├─ api/                   # window.api 접근을 감싼 renderer 어댑터가 필요할 때
│  └─ config/
└─ main.tsx

src/shared/                   # Electron 프로세스 간 IPC 타입/계약, 그대로 유지
src/main/                     # Electron main process, 그대로 유지
src/preload/                  # 제한된 contextBridge API, 그대로 유지
```

`entities`는 처음부터 전부 만들지 않는다. 공식 원칙상 실세계의 도메인 개념을 담는 레이어지만, 현재 기능 하나에만 쓰이는 상태와 로직을 억지로 entity로 올리면 오히려 결합이 늘 수 있다. 여러 feature/page/widget에서 같은 일정 데이터 타입이나 규칙을 공유할 때만 해당 모델을 아래로 추출한다. 메모 자동 저장과 Plate 편집 로직처럼 특정 사용자 시나리오에 붙은 코드는 공유되는 도메인 모델이 따로 확인되지 않는 한 feature 내부에 둔다.

## 현재 코드의 이동 후보

| 현재 위치 | 권장 위치 | 적용 기준 |
| --- | --- | --- |
| `App.tsx`의 Provider/전체 프레임/전역 단축키 | `app` | 앱 시작, 전체 수명, 모든 화면 조립 책임만 남긴다. 화면 내부 UI와 도메인 구현은 점차 분리한다. |
| `App.tsx`의 메모/캘린더/바로가기 화면 내용 | `pages/notes`, `pages/calendar`, `pages/shortcuts` | 페이지는 화면 조립만 하고 실제 사용자 동작은 아래 feature를 사용한다. 기존 lazy loading과 화면 마운트 유지 동작을 보존한다. |
| `components/app-sidebar.tsx` | `widgets/app-sidebar` | 메모 목록, 화면 메뉴, 설정 버튼처럼 여러 기능을 조합하는 앱 전용 큰 블록이다. |
| `components/site-header.tsx` | `widgets/site-header` 또는 `app/shell` | 모든 페이지에서 쓰이는 앱 프레임 요소다. Ctrl+K 같은 기능 연결이 있다면 widget 쪽이 자연스럽다. |
| `components/ui/*` | `shared/ui` | shadcn 기반 범용 디자인 시스템 컴포넌트다. 앱 도메인 상태를 가져오지 않게 유지한다. |
| `features/notes/note-workspace.tsx` | `pages/notes/ui` | 메모 화면 전체 구성. |
| `features/notes/note-editor.tsx`, 저장/열기 동작 | `features/note-edit` | 편집 및 파일 작업 시나리오. 필요하면 화면에서 재사용하는 순수 도메인 규칙만 `entities/note`로 내린다. |
| `features/calendar/calendar-workspace.tsx` | `pages/calendar/ui` | 캘린더 화면 구성. |
| 일정 CRUD와 알림 관리 | `features/calendar-manage`, `features/calendar-reminders` | 현재 동작의 책임이 분리되어 있으면 slice도 나눈다. 이동 첫 단계에서는 기존 `features/calendar`를 유지해도 된다. |
| `features/live-status` | `widgets/live-status` | 일정/바로가기/실행 예정 등 여러 정보를 한 패널에서 조립하면 widget이다. 계산 로직이 특정 도메인에 속하는지는 별도 판단한다. |
| `features/shortcuts/shortcut-workspace.tsx` | `pages/shortcuts/ui` | 바로가기 화면 구성. 등록/실행 동작은 feature. |
| `features/settings/settings-sheet.tsx` | `features/settings/ui` | 전체 페이지가 아니라 사용자가 열고 닫는 설정 동작/시트다. |
| `features/quick-command/*` | `features/quick-command` | Ctrl+K 입력/작업 흐름은 제품 기능으로 그대로 둔다. |
| `features/weather` | 사용자 동작은 `features/weather-location`; 표시 조립은 `widgets/weather-summary` 후보 | 앱 내 작은 날씨 표시 하나를 위해 복잡한 분리는 하지 않는다. 실제 재사용이 없으면 기존 feature slice로 유지한다. |
| `hooks/use-navigation-shortcuts.ts`, `lib/navigation.ts` | `app/model` 또는 `app/config` | 화면 전환과 전역 키 입력 수명 주기를 앱 레이어가 소유한다. |
| `hooks/use-mobile.ts`, `lib/utils.ts` | `shared/lib` 후보 | UI/도메인에 무관하고 둘 이상의 slice에서 쓰인다는 것이 확인된 코드만 이동한다. |
| `src/shared/{notes,calendar,shortcuts,codex}.ts` | 현 위치 유지 | main/preload/renderer 간 IPC 계약이다. 렌더러의 FSD `shared`와 합치거나 Electron API를 UI 컴포넌트에 직접 노출하지 않는다. |

이 표는 이동을 확정하는 명령이 아니라 분류 제안이다. 현재 실제 import graph와 최근 기능 동작을 기준으로 각 파일을 옮기기 직전에 확인한다. 특히 `weather`, `live-status`, `calendar`처럼 이름이 비슷해 보여도 데이터 소유권과 사용자 시나리오가 다르면 같은 slice로 합치지 않는다.

## 상태와 Electron 경계

FSD를 도입해도 Redux, Zustand, Jotai 등을 추가할 필요는 없다. 상태는 필요한 소유 범위에 둔다.

- 편집 중 입력/모달 열림 등 단일 UI 상태는 해당 `ui` 컴포넌트나 feature의 React state에 둔다.
- Note/Calendar/Shortcut의 저장·구독 store는 현 동작을 먼저 보존한다. 상태를 실제로 여러 상위 조립부가 공유하는 경우 해당 도메인 entity 또는 앱 composition root가 store 인스턴스를 만들고 하위에 전달한다.
- 앱 선택 화면, 전역 Provider, 전역 키 이벤트처럼 앱 수명과 일치하는 상태는 `app`이 소유한다.
- `src/shared` IPC 타입은 계약이며, 실제 권한 검증과 네이티브 파일·프로그램 실행은 main process에 남긴다. renderer slice는 `window.api`의 좁은 공개 함수만 호출한다.
- FSD `shared/ui`는 순수 공통 UI다. `window.api`, 특정 메모 파일, 캘린더 규칙을 직접 참조하지 않는다.

렌더러의 FSD `shared`와 루트 `src/shared`는 경로 alias에서도 구분한다. 현재 `@/`와 `@renderer/`가 renderer root를 가리키므로 첫 단계에서 alias를 대규모 변경하지 않는다. 기존 alias를 유지한 채 상대 import 또는 구체적인 renderer alias를 사용하고, 루트 IPC 타입 alias와 혼동될 때에만 별도 정리한다.

## 점진 도입 순서

### 0단계: 기준선 확보

현재 `pnpm typecheck`, `pnpm lint`, `pnpm build` 결과와 관련 테스트 명령을 확인한다. 기존 실패와 새 구조의 회귀를 구분할 수 있도록 기록한다. 특히 메모 자동 저장/복구, 캘린더 알림, 바로가기 실행, Codex 설정, Storybook을 주요 동작 목록으로 삼는다.

### 1단계: 구조 원칙과 경계부터 확정

`src/renderer/src`에 `app`, `pages`, `widgets`, `entities`, `shared`를 필요할 때만 만든다. `processes`는 만들지 않는다. `src/main`, `src/preload`, 루트 `src/shared`는 그대로 둔다. 각 레이어 README 또는 renderer 아키텍처 문서에 import 방향, IPC 경계, alias 의미를 기록한다. 이 단계에서는 동작 변경이나 대형 파일 이동을 섞지 않는다.

### 2단계: 페이지와 앱 프레임 분리

`App.tsx`에서 provider/공통 프레임/화면 선택 책임을 `app`으로 모으고, notes/calendar/shortcuts 본문 조립을 각각 page slice로 옮긴다. 기존 메뉴 ID와 Ctrl+1/2/3/4, Ctrl+O, Ctrl+K, 화면 lazy import, 방문한 화면을 숨김 처리하여 마운트 유지하는 동작, 온보딩 모달 우선순위를 바꾸지 않는다. 라우터 라이브러리는 추가하지 않는다.

### 3단계: 큰 UI 조립부를 widget으로 이동

사이드바와 헤더부터 `widgets`로 분리한다. 사용 중인 달력 현황/실행 예정/바로가기 패널이 실제로 여러 도메인을 조합한다면 `widgets/live-status`를 후보로 삼는다. Storybook story와 스타일 import도 컴포넌트 이동에 맞춰 함께 수정한다.

### 4단계: 기능 slice 내부를 정돈

기존 `features/notes`, `features/calendar`, `features/shortcuts`를 한 번에 세분화하지 않는다. 먼저 `ui`, `model`, `api`, `lib` 중 실제 필요가 있는 segment를 추가하고, 다른 slice가 내부 경로를 직접 참조하는 import를 public API로 바꾼다. 이후 의미 있는 독립 사용자 시나리오가 확인될 때만 feature slice를 나눈다.

### 5단계: 공통 UI와 재사용 모델 추출

shadcn 범용 UI를 `shared/ui`로 옮기고, 실제로 다수 위치에서 공유하는 순수 모델/도구만 `entities` 또는 `shared/lib`로 추출한다. entity는 “파일 종류가 같다”는 이유만으로 만들지 않고, 제품 도메인 규칙을 공유하는지 확인한다.

### 6단계: import 규칙 자동화

수동 구조가 안정된 뒤 ESLint import-boundary 규칙이나 현재 ESLint 구성에 맞는 검증을 검토한다. 먼저 기존 위반을 분류하고 새로운 위반을 막는 방식으로 적용한다. FSD 적용을 위해 무거운 상태 관리나 런타임 패키지를 설치할 이유는 없다. 강제 규칙 도구는 현재 ESLint 설정과 호환성, 유지보수 비용을 확인한 후 최소한으로 추가한다.

## 검증과 완료 기준

각 단계마다 다음을 확인한다.

1. `pnpm typecheck`, `pnpm lint`, `pnpm build`가 통과하거나 기준선 대비 새로운 오류가 없는가.
2. 페이지 전환과 단축키, 모달 간 중첩 제한, 화면 재방문 시 상태 유지가 동작하는가.
3. 메모 열기/저장/자동 저장/복원/충돌 처리, 캘린더 일정 및 OS·앱 내 알림, 링크 자동 실행, 바로가기 실행과 아이콘, Codex 연결 설정이 유지되는가.
4. Storybook이 컴포넌트 이동 후에도 실행되고 해당 스토리가 렌더링되는가.
5. 새 import가 레이어 아래 방향만 따르는가. 외부 slice가 내부 경로를 직접 참조하지 않는가.
6. main/preload IPC 공개 범위와 권한 검사가 달라지지 않았는가.

FSD 도입 완료는 특정 폴더 트리를 만든 상태가 아니다. 새 코드가 정한 import 규칙을 따르고, 기존 기능을 옮긴 코드가 같은 사용자 동작을 보이며, 팀이 유지할 수 있는 정도로 public API 경계가 문서화된 상태를 뜻한다.

## 예상 비용과 주의점

- 작은 개인용 앱에서 모든 레이어와 `index.ts`를 기계적으로 추가하면 파일 탐색과 변경량만 늘 수 있다. 실제 코드가 있는 곳부터 시작한다.
- 기존 `features/*`가 이미 도메인 단위라서 폴더 이름만 바꾸는 대규모 커밋은 이점이 작다. import 방향과 내부 경로 의존을 개선하는 것이 핵심이다.
- 현재 `App.tsx`가 상태와 여러 lifecycle을 조정하므로 파일 이동 중 동작 회귀 위험이 있다. 한 번에 화면 하나씩 분리한다.
- 캘린더 store를 사이드바와 캘린더 화면이 공유하는 등 cross-widget state가 있다. store의 인스턴스 생성 위치와 구독 소유권을 먼저 파악하고 이동한다.
- shadcn 코드는 프로젝트가 소유하는 로컬 코드다. `shared/ui`로 옮기더라도 업데이트를 자동 동기화하지 말고, 가져온 소스의 수정 사항을 보존한다.
- FSD만으로 Electron 보안이 강화되는 것은 아니다. IPC 권한과 main/preload 책임 분리가 기존 보안 경계다.

## 참고 자료

- [FSD 공식 문서: Layers](https://feature-sliced.design/docs/reference/layers) — 표준 레이어, 레이어 import 규칙, 각 레이어의 책임.
- [FSD 공식 문서: Slices and segments](https://feature-sliced.design/docs/reference/slices-segments) — slice 응집도, 같은 레이어 slice 간 독립성, segment의 기술적 목적.
- [FSD 공식 문서: Public API](https://feature-sliced.design/docs/reference/public-api) — slice 외부 공개 계약과 wildcard re-export 주의점.
- [FSD 공식 문서: Migration from a custom architecture](https://feature-sliced.design/docs/guides/migration/from-custom) — 기존 구조에서 점진적으로 옮기는 접근과 도입 전 비용 검토.

## 다음 구현 작업에 사용할 프롬프트

아래 지시로 실제 코드 변경을 시작할 수 있다. 첫 작업은 경계 설정과 첫 작은 이동에 한정하고, 구현 전 현재 git 변경 상태와 문서를 먼저 확인한다.

```text
이 프로젝트의 React 렌더러에 Feature-Sliced Design(FSD)을 점진적으로 도입해줘.

먼저 루트의 fsd-prompt.md와 src/renderer/README.md, 관련 feature README를 읽고 현재 작업 트리와 테스트 기준선을 확인해. 이 문서의 조사 결과를 따르되, 실제 코드와 달라진 부분은 코드에 근거해 조정해.

범위는 src/renderer/src로 한정해. Electron src/main, src/preload, 루트 src/shared의 IPC 계약과 책임을 이동하거나 변경하지 마. React Router나 Redux/Zustand 같은 새 런타임 의존성을 추가하지 마. 기존 상태 store, shadcn 소스 수정, 메모 저장/복원, 캘린더 알림, 바로가기 실행, Codex 연결 동작을 보존해.

이번 작업은 한 단계만 구현해: app/pages/widgets/shared 경계를 세우고 App.tsx에서 화면 조립을 page slice로 분리할 계획을 실제 import graph로 검증한 뒤, 위험이 낮은 한 화면부터 이동해. 범위가 커지면 이동을 더 하지 말고 현재 단계까지만 마무리해. public API는 필요한 slice에만 명시적으로 만들고 export *를 쓰지 마. 외부 slice가 내부 파일 경로를 import하지 않도록 하되, 일괄 자동 이동이나 무관한 포맷 변경은 피한다.

완료 후 pnpm typecheck, pnpm lint, pnpm build와 해당 기능의 관련 테스트를 실행해. 기존 실패는 기준선과 비교해 구분하고, 어떤 파일/경계가 바뀌었는지와 다음 단계 제안을 보고해. 커밋은 요청받기 전까지 만들지 마.
```
