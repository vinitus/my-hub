# 할일 (TODO)

사이드바 **할일**, `Ctrl+4`로 연다. 제목(1~200자), 선택 마감일(YYYY-MM-DD), 완료 여부와 즐겨찾기를 관리한다.
추가·수정·삭제·완료 체크마다 저장하고 전체/미완료/완료 필터와 마감일순 목록을 제공한다. 기한이 없는 항목은 목록 하단에 모으며, 수정 중 기한을 지울 수 있다.
방문 후 화면을 마운트해 이동 시 입력 초안과 필터를 보존한다.

홈의 할일 추가는 420px 중앙 모달을 사용한다. 제목 자동 포커스, 선택 마감일,
완료 체크와 취소·추가 버튼을 제공한다. 날짜는 기본 달력의 키보드 동작을 유지하며
Delete로 기한을 지울 수 있다. Enter 등록은 IME 조합 중에는 실행하지 않는다.
저장 중 중복 제출을 막고 실패 시 모든 입력을 유지한다. 성공 안내는 잠시 표시한다.

- `model/todo-store.ts`: 외부 store, 초기 로드·구독·작업 중복 방지·오류 처리.
- `model/use-todo-form.ts`: 폼 초안과 제출 잠금·성공 초기화·예외 처리를 관리한다. 초기 초안은 마운트 시 한 번만 읽으며 편집 항목의 수명은 기존 호출자가 제어한다.
- `ui/todo-workspace.tsx`: props/콜백 기반 UI, 독립된 입력 초안.
- `pages/todos`: store 수명과 화면 조립.
- 루트 `src/shared/todos.ts`: Zod 검증 및 IPC 계약.
- `src/main/todos.ts`: 요청 창/프레임 검사, 제한된 preload API.
- `src/main/todo-repository.ts`: userData의 `todos.json`, revision 충돌 검사, 직렬 저장 및 임시 파일 교체.

손상된 파일은 덮어쓰지 않고 오류를 표시한다. 저장 실패 시 목록과 입력을 유지하며 새로고침으로 재시도한다.
마감일은 선택 사항이며 비어 있으면 기한 없는 할일로 저장한다. 최대 500개/1MB. 알림과 캘린더 연동은 제공하지 않는다. 마감일은 시간대 변환 없이 날짜 그대로 보존한다.

검증: `pnpm test:todos`, `pnpm typecheck`, `pnpm lint`, `pnpm test:fsd`, `pnpm build`,
`pnpm build-storybook`, `pnpm test:storybook`. 스토리는 고정 fixture와 로컬 상태만 사용한다.
main/preload 변경 후에는 Electron을 닫고 `pnpm dev`로 다시 시작한다.
