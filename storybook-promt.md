# My Hub Storybook 조사 보고서

- 조사일: 2026-10-28
- 범위: Storybook의 현재 프로젝트 적용 상태와 UI 개발·검증을 위한 다음 단계
- 핵심 결론: Storybook은 이미 프로젝트에 설치·설정되어 있다. 새로 도입하는 작업은 필요하지 않고, 현재 스토리를 실제 UI 검토에 맞게 확장하고 Electron 의존성 경계를 분명히 하는 것이 다음 일이다.

## 요약

프로젝트는 Storybook 10.6.0과 `@storybook/react-vite`를 개발 의존성으로 사용한다. `.storybook/main.ts`, `.storybook/preview.ts`, `.storybook/vite.config.ts` 설정이 있고 `storybook`/`build-storybook` 명령도 `package.json`에 등록돼 있다. `ScheduleStatusCard`의 일정 상태와 색상 변형을 다루는 스토리 파일도 이미 존재한다.

`corepack pnpm build-storybook`으로 실제 정적 빌드를 확인했고 성공했다. 샌드박스 안에서는 Storybook Manager가 상위 디렉터리를 읽지 못해 실패했지만, 권한을 올려 다시 실행하자 설정 오류 없이 빌드됐다. 빌드 중 500KB가 넘는 번들 청크 경고가 있었으나 Storybook 미리보기 번들에 대한 경고이며 제품 앱 빌드와 별개다. 우선 스토리 작성 기준을 정하고, 필요한 UI만 우선순위에 따라 추가하는 접근을 권한다.

## 현재 상태

| 항목 | 프로젝트 현황 |
| --- | --- |
| Storybook 버전 | `storybook`, `@storybook/react-vite`, `@storybook/addon-docs` 모두 10.6.0 |
| 프레임워크 | React + Vite용 `@storybook/react-vite` |
| 스토리 검색 | `src/renderer/src/**/*.stories.ts` 및 `.tsx` |
| 글로벌 스타일 | `.storybook/preview.ts`에서 렌더러 `index.css` 로드 |
| Vite 통합 | `.storybook/vite.config.ts`에 기반 Vite config 경로 지정, Tailwind 플러그인과 `@`/`@renderer` alias 병합 |
| 실행 명령 | `corepack pnpm storybook` (개발 서버), `corepack pnpm build-storybook` (정적 빌드) |
| 기존 스토리 | `features/live-status/schedule-status-card.stories.tsx` — 다음 일정까지 남은 시간, 임박/곧 시작, 다음 날짜 없음, 다크 모드, 좁은 너비 등 |
| 정적 산출물 | `storybook-static/`; `.gitignore`에서 제외됨 |
| 현재 테스트 도구 | Storybook Docs 애드온은 설치됨. 별도 Storybook interaction/test 애드온과 테스트 명령은 아직 구성되지 않음 |

따라서 지금 상태는 “Storybook 설치 및 기본 설정”까지 완료된 단계다. 최근 커밋 기록에도 Storybook 설정과 일정 카드 스토리 도입이 별도 작업으로 남아 있다.

## Storybook을 이 앱에서 쓰는 목적

Storybook은 Electron 앱 전체를 실행하지 않고 React 컴포넌트와 화면 조각을 독립적으로 만들어 보고, 상태별 UI를 검토하는 작업 공간이다. My Hub에서는 디자인 변화가 잦거나 시간/데이터 조건에 따라 모습이 달라지는 UI를 고정된 예시로 재현하는 데 유용하다.

특히 이미 만든 일정 상태 카드는 현재 시각에 의존하지 않도록 `now` 값을 인자로 전달하고, `CalendarEvent`를 fixture로 만들어 스토리에서 공급한다. 이런 방식은 시간을 기다리거나 실제 캘린더 파일을 준비하지 않고도 “24분 후”, “5분 후”, “곧 시작”, “내일 일정”, “예정된 일정 없음” 같은 상태를 검토하게 해준다. 이 패턴을 캘린더 알림 UI, 바로가기 카드, 날씨 표시, 설정 UI 등 필요한 부분에 선택적으로 적용하면 된다.

## 프로젝트에 맞는 스토리 기준

### 스토리로 만들 대상

- **공용 UI**: Button, Dialog, Input처럼 시각적 변형과 상호작용이 재사용되는 컴포넌트.
- **복합 UI**: 일정 상태 카드, 일정 편집 폼, 바로가기 타일, 날씨 카드처럼 자체 UI 경계와 입력 데이터가 분명한 컴포넌트.
- **상태가 많은 UI**: 빈 목록, 오류, 로딩, 임박, 선택됨, 비활성화, 좁은 너비 등 사용자가 검토해야 하는 대표 상태.
- **대표 화면 조각**: 전체 앱이 아닌 페이지 일부를 조립해 레이아웃 밀도와 상호작용을 확인할 필요가 있을 때.

모든 작은 내부 컴포넌트마다 스토리를 만들 필요는 없다. 공용 디자인 시스템과 사용자에게 보이는 변형, 회귀 가능성이 큰 상호작용을 우선한다.

### 스토리 작성 방법

- `Meta`와 `StoryObj<typeof meta>`를 이용하는 현재 CSF 3 TypeScript 형식을 이어간다.
- 한 스토리는 의미 있는 한 가지 상태를 표현한다. 하나의 긴 스토리 안에 여러 상태를 순서대로 넣지 않는다.
- 가능한 경우 컴포넌트 입력을 `args`로 공급해 Controls에서 바꿔 볼 수 있게 한다.
- 시간, 날짜, 무작위 값, 네트워크 응답은 고정 fixture로 만든다. UI가 시스템 시각이나 실행 순서에 따라 흔들리지 않게 한다.
- 시각적으로 필요한 스토리에는 이름과 `parameters.layout`을 지정하고, 폭/다크 모드/배경 차이는 decorator 또는 Storybook 글로벌 설정으로 재현한다.
- 사용자가 실제로 조작하는 중요한 흐름은 필요할 때만 `play` interaction으로 검증한다. 모든 스토리에 테스트 코드를 덧붙일 필요는 없다.
- 스토리 fixture와 목(mock)은 스토리 목적에 맞는 로컬 파일에 두고, 실제 사용자 데이터를 읽거나 실제 서비스에 연결하지 않는다.

## Electron 앱에서 지킬 격리 경계

Storybook은 브라우저에서 동작하는 별도 개발 앱이다. Electron main/preload 프로세스가 실행되지 않으므로 `window.api` 같은 브리지를 사용하는 컴포넌트를 그대로 렌더링하면 실패하거나 잘못된 환경 의존을 만들 수 있다.

- UI 컴포넌트는 가능하면 데이터를 props로 받고, Electron API 호출은 feature의 model/API 계층이나 상위 조립부에 둔다.
- Storybook에는 실제 파일 시스템, OS 알림, 프로그램 실행, Codex 세션을 연결하지 않는다.
- 컴포넌트 검토에 필요한 API 결과는 인메모리 fixture나 명시적인 mock adapter로 제공한다.
- `App` 전체를 Storybook에 억지로 올리기보다, 독립 입력을 갖춘 UI와 페이지 조각만 올린다.
- Electron API가 꼭 필요한 사례의 mock은 해당 스토리에만 제한하거나, 재사용해야 하는 경우 테스트 전용 helper로 분리한다. production 경로에서 mock을 로드하지 않도록 확인한다.

이 경계를 적용하면 Storybook에서 테스트하려고 preload API를 브라우저에 노출하거나 권한 설정을 완화할 필요가 없다.

## 테마, Tailwind, shadcn 설정

현재 preview가 `src/renderer/src/index.css`를 import하므로 Tailwind 유틸리티와 CSS 토큰을 Storybook에서도 사용할 기반은 갖춰져 있다. `main.ts`에서 Tailwind Vite 플러그인과 앱 별칭을 병합하고 있어 shadcn UI가 쓰는 토큰을 재사용한다.

다크 테마를 반복해서 확인해야 할 때는 스토리마다 수동 decorator를 복사하기보다 Storybook global toolbar/decorator로 `light`/`dark`를 적용할 수 있다. 단, 기존 `ThemeProvider`가 `next-themes`나 Electron 저장소에 직접 의존한다면 전체 Provider를 무조건 올리지 말고, `.dark` class와 CSS 변수만 바꾸는 preview decorator로 충분한지 먼저 확인한다. 컴포넌트가 실제 Provider 동작 자체를 검토하는 스토리에서만 Provider를 사용한다.

shadcn 컴포넌트는 로컬 소스이므로 `components/ui`의 수정본을 그대로 스토리에서 렌더링한다. Storybook 전용 복제본을 만들지 않는다. `src/renderer/src/index.css`가 앱 전체 레이아웃이나 Electron 전용 스타일을 포함하게 되면, preview에서 필요한 글로벌 토큰/폰트만 가져오도록 stylesheet를 점검한다.

## 권장 확장 순서

### 1단계: 현재 설치를 기준으로 사용 시작

Storybook을 다시 설치하거나 프레임워크를 바꾸지 않는다. 로컬에서 `corepack pnpm storybook`을 실행하고 기존 일정 카드의 각 상태가 잘 렌더링되는지 확인한다. Storybook 정적 빌드는 `corepack pnpm build-storybook`으로 검증한다.

### 2단계: 중요한 UI부터 스토리 추가

다음 후보 중 실제 디자인 검토 필요도가 높은 것부터 진행한다.

1. **캘린더 알림/일정 편집 UI**: 참조 링크 없음/여러 개, OS 알림과 앱 내 알림 on/off, 자동 실행 설정 on/off, 오류/저장 상태.
2. **바로가기 UI**: 웹사이트, 폴더, 설치 앱/바로가기 파일, 긴 경로, 아이콘 없음, 빈 목록.
3. **날씨 UI**: 검색 전/검색 결과 없음/선택된 동네/오류/마지막 갱신 상태.
4. **설정 및 Codex 연결 UI**: 연결 전, 로그인 진행, 연결됨, 연결 끊김, 모델/생각 수준 선택.
5. **메모 UI**: 파일명 편집, 저장/저장 중/실패, 편집 툴바의 주요 상태. Plate 편집기 전체는 의존성이 크므로 작은 툴바나 요소부터 검토한다.

위 목록 전부를 한꺼번에 스토리화하지 않는다. 각 컴포넌트의 공개 입력과 IPC 호출 경계를 먼저 정하고, 디자인 작업 때 실제로 자주 비교하는 상태를 스토리로 만든다.

### 3단계: 공통 preview 개선

- 앱과 Storybook의 light/dark 토큰 결과를 맞춘다.
- 필요한 화면 조각에는 viewport preset이나 고정 컨테이너 폭을 사용한다.
- Storybook 내부에 필요한 범위에서만 `window.api` mock을 제공한다.
- 스토리 이름을 도메인 계층으로 정리한다. 예: `캘린더/일정 현황 카드`, `바로가기/바로가기 타일`.

### 4단계: 테스트는 선택적으로 추가

현재는 Docs 애드온만 설치되어 있다. 기본 스토리도 렌더링 smoke test 역할을 할 수 있으며, 스토리 수가 늘고 브라우저 상호작용을 자동으로 검증할 이점이 커지면 현재 Storybook 10 및 Vite 8 구성과 맞는 공식 Vitest 애드온 설치 방법을 다시 확인한다. 팩키지와 브라우저 실행 비용을 검토한 후 별도 작업으로 도입한다.

우선 상호작용 테스트가 가치 있는 대상은 일정 폼 검증, 모달 열기/닫기, 시간 선택, 링크 추가/삭제, 검색 필터, 키보드 이동 등 사용자가 실제로 조작하는 핵심 흐름이다. 정적 표시만 있는 카드에는 모든 변형별 play 테스트를 만들 필요가 없다. 스크린샷 비교나 Chromatic 같은 외부 시각 회귀 서비스는 팀의 CI와 유지비를 검토하기 전에는 도입하지 않는다.

### 5단계: CI/배포는 필요할 때만

현재 `storybook-static`은 git에 포함하지 않는다. 제품 앱과 달리 개발용 정적 결과물이므로 기본 Electron 패키지에 넣지 않는다. 공유 링크나 CI에서 시각 검토가 필요해지면 정적 빌드를 artifact로 보관하거나 별도 호스팅을 검토한다. 이 프로젝트에 공개 사이트가 이미 존재한다는 가정으로 배포 경로를 만들지 않는다.

## 검증 기준

- `corepack pnpm storybook`이 실행되고 스토리 탐색기에서 주요 스토리가 표시된다.
- `corepack pnpm build-storybook`이 성공한다.
- 일정 상태 카드 스토리가 고정 시간에 대해 임박/일반/다음 날짜/빈 상태를 안정적으로 표시한다.
- 다크 모드와 좁은 폭에서 색상, 줄바꿈, 고정 높이가 앱 디자인과 일치한다.
- Storybook을 열기 위해 Electron main/preload 또는 실사용자의 파일/계정이 필요하지 않다.
- 새 테스트 애드온은 추가하는 경우에만 브라우저 실행과 CI 비용, 기존 테스트 명령과의 역할을 확인한다.

## 참고 자료

- [Storybook 공식 문서: Get started](https://storybook.js.org/docs/) — Storybook의 목적과 지원 프레임워크.
- [Storybook 공식 문서: Install](https://storybook.js.org/docs/get-started/install/) — 프로젝트에 설치하는 방법과 요구 환경.
- [Storybook 공식 문서: Vite builder](https://storybook.js.org/docs/builders/vite) — Vite 기반 앱의 설정 재사용.
- [Storybook 공식 문서: Args](https://storybook.js.org/docs/writing-stories/args) — Controls와 상호작용할 수 있는 story 입력.
- [Storybook 공식 문서: Play function](https://storybook.js.org/docs/writing-stories/play-function) — 스토리 상호작용 시나리오.
- [Storybook 공식 문서: UI 테스트](https://storybook.js.org/docs/writing-tests) — render/interaction 테스트 방식과 테스트 애드온 안내.

## 다음 작업에 사용할 프롬프트

Storybook 기본 설정은 이미 있으므로, 아래 프롬프트는 재설치가 아니라 실제 UI 스토리를 추가하는 작업에 사용한다.

```text
이 프로젝트는 Storybook 10.6 + @storybook/react-vite 설정이 이미 되어 있다. 먼저 storybook-promt.md, .storybook 설정, 기존 schedule-status-card.stories.tsx와 대상 컴포넌트/관련 README를 읽어.

이번에는 내가 지정한 컴포넌트 하나만 Storybook으로 다뤄줘: [대상 컴포넌트 또는 UI]. 기존 동작을 바꾸지 말고, 현재 컴포넌트 입력에 맞는 대표 상태와 경계 상태를 재현하는 typed CSF 3 stories를 추가해. 날짜/시간/네트워크 데이터는 고정 fixture를 사용하고, Storybook에서 실제 Electron window.api, 파일 시스템, OS 알림, 프로그램 실행, Codex 계정을 호출하지 않게 해. 필요한 의존은 props나 story 범위 mock으로 제공해.

프로젝트의 Tailwind/shadcn 토큰, 앱 스타일, 현재 Storybook 설정과 alias를 재사용해. story 전용 production 코드나 전역 보안 설정 변경은 만들지 마. 상호작용이 핵심인 경우에만 play 테스트를 추가하고, 테스트 애드온 설치는 이번 범위에서 제외해.

완료 후 corepack pnpm build-storybook을 실행하고, 실패하면 기존 설정 문제인지 이번 변경인지 구분해 보고해. storybook-static을 커밋하거나, 요청받지 않은 다른 컴포넌트 스토리/테스트/패키지 변경은 추가하지 마.
```
