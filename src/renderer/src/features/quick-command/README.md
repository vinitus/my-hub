# 빠른 AI 입력

Ctrl+K 또는 헤더의 빠른 입력 버튼으로 한 줄 모달을 연다.
Enter로 전송하면 모달을 닫고 실제 Codex 요청을 처리해 우측 하단에 결과를 표시한다.
캘린더와 할일의 조회·추가·수정·삭제, 할일 완료/미완료를 지원한다.
설정의 ChatGPT 연결과 저장된 모델·생각 수준을 재사용한다. 메모 작업은 지원하지 않는다.

- `ui/quick-command.tsx`: 전역 단축키·입력·최근 요청 한 개의 결과. Storybook은 `runCommand` 콜백으로 격리한다.
- `model/command-runner.ts`: 제한된 `window.api.commands.execute` 어댑터와 응답 검증.
- 루트 `src/shared/command.ts`: 입력·결과·계획 계약.
- `src/main/codex-command-planner.ts`: ephemeral thread/turn 추론, JSON 계획, 프로세스 수명과 시간 제한.
- `src/main/command-service.ts`: 컨텍스트 구성, 전체 계획 검증, revision 충돌 검사와 기존 저장소 적용.
- `src/main/commands.ts`: 현재 창/프레임 확인, 저장된 도메인의 변경 이벤트와 캘린더 알림 재계산.
- App: 변경 이벤트를 구독해 공유 Calendar/Todo store를 새로고침한다. feature 사이에 직접 의존하지 않는다.

메시지는 최대 500자, 한 요청은 최대 20개 작업, 컨텍스트는 UTF-8 200KB다.
메시지와 일정/할일 컨텍스트는 AI로 전송되며 메모·토큰·파일 경로는 포함하지 않는다.
모호한 요청은 추가 설명을 요구하도록 지시한다. 최근 상태는 영구 저장하지 않으며 후속 대화 문맥은 없다.
여러 작업은 순차 저장하므로 일부 저장이 발생할 수 있다. 저장된 내역을 표시하며 자동 재시도하지 않는다.

Escape/바깥 클릭으로 닫을 때 입력 초안을 유지한다. 한글 조합 Enter와 다른 모달의 우선순위를 보존한다.
메모 파일 단축키는 모달 동안 비활성화하고 자동 저장은 유지한다.
실행 중 추가 요청은 막으며 앱 종료 시 자신의 Codex 프로세스를 종료한다.

검증: `pnpm test:commands`, `pnpm test:codex`, `pnpm test:calendar`, `pnpm test:todos`,
`pnpm test:fsd`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm build-storybook`, `pnpm test:storybook`.
설계 의견·한계·실제 계정 검증 범위는 루트 `ctrl-k-report.md`를 참고한다.
main/preload 변경 후 Electron을 재시작해야 한다.
