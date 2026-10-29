# AGENTS.md 기준 리팩토링 점검

## 기준선과 범위

- 시작 시 `git status`에 추적 파일 변경은 없었다. 기존 미추적 사용자 문서 `인박스추가.md`, `할일추가.md`는 수정하지 않았다.
- 기준 HEAD는 `9911aa0`이다. 이 작업에서는 커밋·스테이징·외부 전송을 수행하지 않는다.
- `AGENTS.md`의 우선순위대로 React → FSD → Storybook 지침을 읽고 현재 renderer 및 관련 기능 README·구현을 확인했다. 필수 문서 누락은 없었다.
- 전체 lint·FSD 검사와 함께 app 조립부, 페이지/위젯의 상태·구독, 할일·인박스·빠른 입력·설정·일정·바로가기 구현 및 main 저장소/IPC 일부를 검토했다. 모든 파일의 의미적 정확성을 전수 증명한 것으로 보지는 않는다.

## 후보 우선순위와 선택 근거

| 우선순위 | 실제 근거 | 영향·위험 | 결정 |
| --- | --- | --- | --- |
| 1 | `TodoForm`의 JSX 안에 초안 초기화, 제출 ref 잠금, 데이터 생성, 성공/예외/종료 처리가 함께 있었다. | 같은 폼을 홈 모달과 할일 화면이 공유하므로 변경 근거를 한곳에서 검토해야 한다. 로직을 그대로 옮기면 동작 보존을 비교할 수 있다. | 기존 slice의 `model/use-todo-form.ts`로 분리. |
| 2 | `AIQuickCommand`가 전송·미리보기 적용·폐기·실행 취소의 비동기 상태 전이와 표시·단축키를 한 컴포넌트에 보유했다. | 요청 ID, 일회용 토큰, 중복 요청 잠금을 잃으면 회귀 위험이 크다. 새 상태 기계를 도입하지 않고 기존 함수 본문을 보존한다. | 기존 slice의 `model/use-command-task.ts`로 분리. |
| 3 | renderer README는 홈 인박스 빠른 추가를 여전히 Dialog로 설명했지만 실제 코드는 비모달 Popover였다. | 유지보수 시 잘못된 UI·포커스 전제를 만들 수 있다. 동작 변경 없는 문서 보정이다. | 현재 팝오버와 초안 수명으로 문서 갱신. |
| 후속 | `LiveScheduleStatus`와 `LiveStatusPanel`의 1초 타이머·focus 갱신 코드가 유사하다. | 각각 1개/3개 store를 초기화·갱신하며 구독과 재시작 수명이 연결돼 있다. 시계 공통화는 초기화 순서와 refresh 횟수를 별도로 입증해야 한다. | 이번에는 변경하지 않음. 필요 시 구독·타이머 수명 테스트를 먼저 마련한다. |
| 후속 | Calendar/Todo/Inbox 저장소의 직렬 쓰기·임시 파일 교체와 renderer store의 action 코드가 유사하다. | 파일 한도·UTF-8 처리·도메인 검증·refresh 보류 규칙이 다르다. 공통 기반 클래스로 합치면 데이터 보호 규칙이 묻힐 수 있다. | 공통화 보류. 구체적 결함이나 추가 소비자가 생긴 뒤 개별 계약부터 비교한다. |
| 제외 | App·FullCalendar 어댑터·보관 중인 dashboard 예제의 파일이 크다. | 길이만으로 분리하면 새로운 추상화와 수명 경계를 늘린다. 현재 app/page 역할과 FSD 검사는 통과한다. | 크기만을 이유로 이동·분할하지 않음. |

FSD 위반이나 불필요한 Effect를 찾았다고 가정해 형식적인 수정을 하지 않았다.
단축키·focus·store 초기화 Effect는 실제 외부 시스템 동기화를 수행하며 기존 해제를 유지한다.
이전 shortcut-wheel 미리보기의 index key는 고정된 위치의 장식 원에 사용돼 가변 데이터 목록 문제로 취급하지 않았다.

## 단계별 변경과 동작 보존

### 1. 할일 폼

- `useTodoForm`이 제목·날짜·완료 초안, 제출 잠금, 파생 `pending`, 저장 결과를 관리한다.
- `TodoForm`은 기존 props를 그대로 받아 hook에 전달한다. 필수 입력·IME·날짜 선택기 우선 처리·Tab·포커스·버튼 JSX는 유지한다.
- `item`에서 초안을 읽는 시점은 마운트 한 번이다. 항목 변경 시 초안을 Effect로 덮어쓰지 않으며 기존 부모의 편집 key/마운트 수명을 따른다.
- ID·즐겨찾기·기한·완료 값, 성공 시 초기화/닫기, `false` 반환 및 예외 시 입력 보존을 유지한다.
- typed CSF 3의 New, Editing, Rejected, Thrown Error, Saving 스토리를 추가했다. 외부 store의 busy 없이 연속 제출해도 한 번만 저장되는지 검사한다.

### 2. AI 빠른 입력

- `useCommandTask`가 기존 초안·작업 상태와 `submit`, `resolveTask`를 보유한다.
- UI에는 기존 단축키 구독·focus ref·상태 라벨·표시가 남는다. 공개 props와 기본 IPC adapter 선택은 동일하다.
- 요청 ID별 응답 적용, ref 잠금, 미리보기 토큰, 실행 취소 토큰 및 오류 메시지를 그대로 유지한다. 새 Effect·메모이제이션·공유 전역 상태는 추가하지 않았다.
- 기존 결과·미리보기·적용 충돌·부분 저장·폐기·실행 취소 스토리를 유지했다. Pending 및 요청/적용/폐기/복원 예외 스토리를 추가했다.
- 요청 중·미리보기 중 추가 제출 차단, 닫은 초안 보존, 오류 후 입력 복원 및 재요청 잠금 해제를 확인한다.
- 모든 요청은 고정 로컬 콜백이다. 실제 AI·계정·사용자 일정/할일은 접근하지 않는다.

### 코드 비교

TypeScript AST로 기준 HEAD와 작업 트리를 비교했다.

- AI의 `submit`, `resolveTask` 함수 본문은 주석·서식을 제외하고 동일하다.
- 할일 제출에서 hook으로 옮긴 검증·잠금·저장·초기화·예외 처리 본문도 AST 비교 결과 동일하다.
- 두 UI 파일의 JSX는 할일 `onSubmit`의 hook 위임 부분을 정규화하면 동일하다. className·label·aria·DOM 구성은 변경하지 않았다.
- 추적 diff에 main/preload, 루트 IPC 계약, 기존 store, App 조립/화면 수명, 패키지/lockfile 변경은 없다.
- 신규 hook은 같은 feature 내부 상대 경로로만 참조한다. 기존 공개 `index.ts`는 변경하지 않았다.

## 변경 파일

- `features/todos/model/use-todo-form.ts`: 기존 폼 모델 분리.
- `features/todos/ui/todo-workspace.tsx`: 폼 모델 위임.
- `features/todos/ui/todo-form.stories.tsx`: 로컬 저장 콜백으로 상태 검증.
- `features/quick-command/model/use-command-task.ts`: 기존 비동기 작업 모델 분리.
- `features/quick-command/ui/ai-quick-command.tsx`: 작업 모델 위임.
- `features/quick-command/ui/ai-quick-command.stories.tsx`: 고정 callback fixture와 예외/실행 중 상태 검증.
- `scripts/test-storybook-browser.cjs`: 두 모델의 기존 UI를 통한 회귀 검증 보강.
- renderer 및 해당 두 feature README, 본 문서: 역할·판단·검증 기록.

## 검증 한계

- `test:commands`의 실제 모델 평가 2건은 기본 설정대로 건너뛴다. CLI/계정·사용량과 외부 요청을 요구하므로 이번 리팩토링 검증에서 활성화하지 않았다.
- Storybook은 임시 Electron 프로필, Node 통합/브리지 없는 숨겨진 Chromium과 로컬 서버를 사용하며 외부 요청을 차단한다. 실사용자 프로필을 실행한 검증은 아니다.
- OS 네이티브 날짜 팝업 자체는 offscreen 환경에서 표시되지 않는다. 기존 날짜 필드 키보드와 열린 상태의 로컬 mock 검증을 유지한다.
- 기존 번들 500KB 초과 경고와 Electron 리소스 pak 경고는 리팩토링 대상에서 제외한다. 기능 실패로 숨기거나 검사 자체를 비활성화하지 않는다.

## 최종 검증 결과

| 검사 | 결과·범위 |
| --- | --- |
| 시작 전 typecheck·lint·FSD | 통과. 전체 FSD 사례 27개. |
| `corepack pnpm typecheck` | Node/Web 모두 통과. 최종 `build`에서도 재실행. |
| `corepack pnpm lint` | 전체 코드 통과. |
| `corepack pnpm build` | renderer 빌드 통과. 기존 대형 청크 경고 유지. |
| `corepack pnpm build-storybook` | 기준선, 할일 단계, AI 단계의 정적 빌드 통과. |
| `corepack pnpm test:storybook` | 최종 242개 스토리 × 3환경 = 726회 통과. |
| 단계별 Storybook | 기준선 홈 72회, 할일 폼/작업 화면 36회, AI 상태 45회 통과. |
| `corepack pnpm test:commands` | 20개 통과, 실제 모델 평가 2개는 위 이유로 건너뜀. |
| `corepack pnpm test:todos` | 5개 통과. |
| `corepack pnpm test:fsd` | 27개 통과. 새 model 참조는 같은 slice 내부이다. |
| `corepack pnpm test:notes` | 23개 통과. 자동 저장·복원·충돌·낙서장 저장 보존 포함. |
| `corepack pnpm test:inbox` | 5개 통과. |
| `corepack pnpm test:calendar` | 11개 통과. |
| `corepack pnpm test:shortcuts` | 19개 통과. |
| AST 동등성 비교 | AI 함수 2개·할일 저장 본문·두 UI의 정규화 JSX 비교 통과. |
| `git diff --check` | 통과. |

Storybook은 라이트 1100px, 다크 1100px, 다크 360px에서 실행했다.
생성된 모달 화면도 확인했으며, PNG 파일 해시를 엄격한 시각 회귀 판정으로 사용하지는 않았다.
제품 CSS·DOM 보존은 AST 비교와 뷰포트/상호작용 검사로 확인했다.

## 완료 대조

- [x] 지정 지침·현재 README와 실제 구현을 기준으로 후보를 선정하고 근거·위험을 기록했다.
- [x] 기존 사용자 문서를 보존하고, 이미 수정된 사용자 코드에 덧쓰지 않았다.
- [x] 기존 feature 두 곳에서 로직만 분리했다. 기능·디자인·데이터 모델·저장 API·공개 props는 유지했다.
- [x] 새 파생 상태·Effect·메모이제이션·라이브러리·전역 store·대규모 이동은 추가하지 않았다.
- [x] 기존 구독 해제·key·입력 접근성·화면/모달 수명·단축키를 보존했다.
- [x] FSD 경계와 기존 공개 API를 유지하고 관련 검사를 통과했다.
- [x] typed CSF 3, 고정 fixture, 로컬 mock과 실패/재시도 검증을 유지·보강했다.
- [x] 단계별 diff 및 최종 회귀 검증을 확인했고, 실행하지 않은 실제 모델 검사의 이유를 구분했다.
- [x] 변경 파일·검증 결과·후속 후보를 보고서에 기록했다. 커밋과 외부 전송은 하지 않았다.
