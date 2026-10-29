# Codex 프로젝트 작업 지침

My Hub는 Electron + React + TypeScript + Vite 앱이다. FSD와 Storybook은 이미 도입되어 있으며, 앞으로의 변경은 현재 구조를 이어서 작업한다.

- 규칙 우선순위는 `docs/engineering/rules-of-react.md` → `docs/engineering/fsd-prompt.md` → `docs/engineering/storybook-prompt.md`다. 현재 구현은 `src/renderer/README.md`, 기능별 세부사항은 해당 README를 참고한다. 조사 문서의 과거 구조보다 실제 코드를 우선 확인한다.
- 렌더러는 `app → pages → widgets → features → entities → shared` 방향으로 의존한다. 다른 slice는 공개 `index.ts`로 참조하고 같은 레이어의 slice끼리 직접 의존하지 않는다.
- 렌더러의 `shared`와 루트 `src/shared`의 IPC 계약을 구분한다. 네이티브 작업·권한 검사는 main, 제한된 브리지는 preload가 담당한다.
- React 컴포넌트와 상태 갱신은 순수하게 유지한다. 계산 가능한 값의 중복 저장과 불필요한 Effect·메모이제이션을 피하고, 구독 정리·안정적인 key·접근성을 지킨다.
- 기존 store, shadcn 수정본, 자동 저장·복원, 화면 재방문 상태와 단축키·모달 동작을 보존한다. 불필요한 폴더 분리·추상화·의존성 추가는 피한다.
- UI는 props·콜백으로 로직과 분리하고 대표 상태의 typed CSF 3 story를 유지한다. 고정 fixture와 로컬 mock을 사용해 실제 Electron API·파일·계정과 격리한다. 분리하기 어려운 결합은 이유를 주석에 남긴다.
- 변경 범위에 맞게 타입 검사·lint·build·관련 테스트를 검증한다. FSD 변경은 `test:fsd`, UI 변경은 `build-storybook`과 `test:storybook`도 확인한다. 실패는 원인을 수정하고 재검증한다.
- 기존 사용자 변경과 무관한 파일은 보존한다. 커밋을 요청받으면 검증한 작업 파일만 포함하고, 결과와 남은 제약을 간결하게 보고한다.

