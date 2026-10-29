# 통합 액션 런처

Ctrl+K 또는 헤더의 검색 및 실행 버튼으로 연다. 설정의 `통합 검색 실행 단축키`에서
Ctrl+K / Ctrl+Alt+K / Ctrl+Shift+Space 중 선택하며 app-settings.json에 저장한다.
기존 설정은 Ctrl+K로 이전한다. AI 빠른 입력의 Ctrl+Shift+K는 검색 단축키로 선택할 수 없다.
두 입력창은 서로 또는 다른 모달 위에 중복해서 열리지 않는다. 앱 내부 단축키이며 OS 전역 등록은 하지 않는다.
메모 제목, 일정 제목·설명·날짜,
할일, 등록된 프로그램·폴더·웹사이트와 앱 명령을 한 번에 검색한다.
결과는 메모·할일·일정·바로가기·명령으로 구분한다. 빈 입력은 종류별 최대 3개,
검색 중에는 종류별 최대 10개를 표시한다.
위아래 화살표로 선택하고 Enter 또는 클릭으로 실행한다. 한글 조합 Enter는 실행하지 않는다.
`메모 회의 검색`, `할일 보고서 완료`, `VS Code 실행`처럼 짧은 구문은 로컬에서 검색한다.
정확한 제목과 포함 검색을 먼저 보여 주고, `보거서` 같은 한 글자 오타,
`vsc` 같은 순서대로 입력한 축약형, `ㅂㄱㅅ` 같은 한글 초성도 검색한다.
메모는 기존 저장/전환 경로로 열고, 일정은 해당 날짜의 캘린더 일간 목록으로 이동한다.
미완료 할일은 완료 처리하며 완료된 할일은 목록을 연다. 프로그램은 바로가기에 먼저 등록한다.
새 메모·할일·일정의 수동 등록 폼, 오늘 일정, 프로그램 등록, 화면 이동, 계산기와 설정도 검색해 실행한다.
열 때마다 목록을 새로고침하며 저장·실행에는 기존 store의 busy/revision 검사를 사용한다.

통합 검색은 AI 호출이나 AI 전송 항목을 제공하지 않는다. 결과가 없으면 실행하지 않는다.

AI 빠른 입력은 Ctrl+Shift+K 또는 헤더의 `AI 빠른 입력`으로 별도 실행한다.
새 할일 생성 등 자연어 요청을 Enter로 전송하면 실제 Codex 요청을 처리하고 우측 하단에 결과를 표시한다.
변경 요청은 항목별 변경 전후(제목·시간/마감·내용·색상·완료 여부)를 먼저 보여 준다.
`변경 적용`을 눌러야 저장하며 `변경 취소`는 저장 없이 계획을 폐기한다. 조회는 바로 결과를 표시한다.
캘린더와 할일의 조회·추가·수정·삭제, 할일 완료/미완료를 지원한다.
설정의 ChatGPT 연결과 저장된 모델·생각 수준을 재사용한다. AI 경로는 메모 작업을 지원하지 않는다.
메모 제목과 프로그램 경로는 AI 컨텍스트에 추가하지 않는다.

- `ui/action-launcher.tsx`: 설정 가능한 단축키·종류별 검색·선택·로컬 실행. Storybook은 `actions` 콜백으로 격리한다.
- `ui/ai-quick-command.tsx`: Ctrl+Shift+K, AI 입력·미리보기·실행 취소와 최근 요청 결과. AI 콜백으로 격리한다.
- `model/action-search.ts`: 범위 구문, 검색 정규화·순위. 실행 부작용이 없는 순수 함수다.
- 루트 `src/shared/launcher-shortcut.ts`: 검색 단축키 후보·표시와 modifier 일치 검사.
- `app/model/use-action-launcher.ts`: 공유 store를 구독하고 실제 도메인 동작을 콜백으로 조립한다. feature 간 직접 의존은 없다.
- `model/command-runner.ts`: 제한된 `window.api.commands` 어댑터와 응답 검증.
- 루트 `src/shared/command.ts`: 입력·결과·계획 계약.
- `src/main/codex-command-planner.ts`: ephemeral thread/turn 추론, JSON 계획, 프로세스 수명과 시간 제한.
- `src/main/codex-structured-request.ts`: 명령 계획과 메모 제목 생성이 공유하는 구조화 응답·프로세스 수명·시간 제한.
  `thread/start`·`turn/start.outputSchema` 계약은 [공식 App Server 문서](https://learn.chatgpt.com/docs/app-server)를 따른다.
- `src/main/command-service.ts`: 컨텍스트 구성, 전체 계획 검증, revision 충돌 검사와 기존 저장소 적용.
- `src/main/commands.ts`: 현재 창/프레임 확인, 저장된 도메인의 변경 이벤트와 캘린더 알림 재계산.
- App: 변경 이벤트를 구독해 공유 Calendar/Todo store를 새로고침한다. feature 사이에 직접 의존하지 않는다.

메시지는 최대 500자, 한 요청은 최대 20개 작업, 컨텍스트는 UTF-8 200KB다.
메시지와 일정/할일 컨텍스트는 AI로 전송되며 메모·토큰·파일 경로는 포함하지 않는다.
모호한 요청은 추가 설명을 요구하도록 지시한다. 최근 상태는 영구 저장하지 않으며 후속 대화 문맥은 없다.
여러 작업은 순차 저장하므로 일부 저장이 발생할 수 있다. 저장된 내역을 표시하며 자동 재시도하지 않는다.

저장 성공 또는 일부 저장 결과의 `실행 취소`로 실제 저장된 항목만 역순으로 되돌릴 수 있다.
삭제한 항목은 원래 ID와 데이터(일정 링크·알림 포함)로 복원한다. 새 요청 전송 또는 창 종료 시 만료되며
최근 한 작업만 메모리에 보관한다. 실행 취소 중 실패하면 복원한 내역을 표시하고 중단하며 다시 실행하지 않는다.
미리보기 이후 및 실행 취소 전에 양쪽 revision을 검사한다. 수동 변경이 있으면 덮어쓰지 않고 다시 요청하도록 안내한다.
각 쓰기도 repository의 revision 검사를 거친다. 여러 항목 및 두 저장소에 대한 원자적 저장·복원은 제공하지 않는다.
계획·복원 데이터는 main이 보관하고 renderer는 일회용 토큰만 전송한다. 중복 클릭이나 사용한 토큰은 재실행하지 않는다.

Escape/바깥 클릭으로 닫을 때 입력 초안을 유지한다. 한글 조합 Enter와 다른 모달의 우선순위를 보존한다.
메모 파일 단축키는 모달 동안 비활성화하고 자동 저장은 유지한다.
홈의 Ctrl+S 제목 생성은 별도 `NoteTitleService`와 `codex:note-title` 경로로 처리한다.
이 명령 서비스에는 메모 본문이나 제목 생성 작업을 전달하지 않는다.
실행 중 추가 요청은 막으며 앱 종료 시 자신의 Codex 프로세스를 종료한다.

검증: `pnpm test:commands`, `pnpm test:codex`, `pnpm test:calendar`, `pnpm test:todos`,
`pnpm test:fsd`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm build-storybook`, `pnpm test:storybook`.
설계 의견·한계·실제 계정 검증 범위는 루트 `ctrl-k-report.md`를 참고한다.
main/preload 변경 후 Electron을 재시작해야 한다.

planner의 단계별 로그는 `pnpm dev`를 실행한 main 터미널에 `[Ctrl+K planner 요청ID +경과ms]`로 출력한다.
실행 파일 탐색 → 프로세스 시작 → RPC 초기화 → 계정 확인 → 스레드 생성 → 추론 요청·응답 →
계획 검증 → 정리 순서와 실패 단계를 확인할 수 있다. 모델·사고 수준, 응답 종류(`actions`/`answer`/`clarification`),
작업 수·도메인·작업 종류를 기록하며 요청 원문·일정/할일 내용·응답 본문·계정·경로는 출력하지 않는다.

자연어 해석 회귀 평가는 `tests/commands.test.ts`에 별도로 둔다. 일반 `pnpm test:commands`에서는
건너뛰며, PowerShell에서 다음처럼 명시적으로 켠다. 설치된 Codex CLI와 ChatGPT 연결이 필요하고
실제 모델 사용량이 발생한다. 사용자 목록 대신 고정된 빈 목록·시각·시간대만 전송하며 저장은 하지 않는다.
현재 제목 재질문 사례는 개선 전 회귀 케이스로, 실제 모델 실행 시 실패할 수 있다.

```powershell
$env:MY_HUB_LIVE_COMMAND_EVAL = '1'
try { corepack pnpm test:commands } finally { Remove-Item Env:MY_HUB_LIVE_COMMAND_EVAL }
```
