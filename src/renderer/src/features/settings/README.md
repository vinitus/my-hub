# 설정과 Codex 연결

`ui/settings-sheet.tsx`는 테마·메모 폴더 설정, `ui/codex-connection.tsx`는 Codex 계정 연결을 표시한다.
`ui/codex-model-settings.tsx`는 모델·생각 수준 선택과 자동 저장을 담당한다.
첫 실행의 `ui/codex-setup-prompt.tsx`는 사용 여부 → 로그인 → 모델 → 사고 수준 순서로 안내한다.
사용을 선택하기 전에는 CLI를 조회하지 않는다. 사용하지 않으면 localStorage에 기억하고 다시 묻지 않는다.
시작 후 나중에 닫으면 다음 실행에서 로그인 단계부터 이어 간다. 완료 후에는 시작 시 연결 상태를 확인하고,
연결이 끊겼을 때 로그인부터 다시 안내한다. 설정(Ctrl+O)에서는 언제든 직접 연결할 수 있다.
단계별 UI는 설정과 `model/use-codex-connection.ts`의 상태 구독·IPC 호출만 공유한다.
`model/codex-onboarding.ts`는 진행 여부와 기본값을 담당한다. 최초 설정은 실제 목록의 Luna와 low를 우선하며,
없으면 지원되는 기본값으로 대체하고 안내한다. 재연결 시 유효한 기존 선택을 보존한다.
단계 이동은 저장하지 않으며 마지막 **설정 완료**에서 저장이 성공해야 완료 처리한다.
첫 화면에서 Ctrl+K의 캘린더·할일 관리를 안내한다. 브라우저 미리 보기에서는 자동 안내를 생략한다.
설정을 열면 로컬 CLI 버전과 기존 로그인 상태를 확인한다. 로그인되지 않았다면 **ChatGPT로 연결**이
시스템 브라우저에서 인증을 시작하고, 완료 알림 후 이메일·플랜과 연결 상태를 갱신한다.
로그인을 취소하거나 5분이 지나면 대기를 끝낸다. **다시 확인**으로 외부 CLI에서 바뀐 로그인도 반영한다.

## main/preload 경계

- `src/shared/codex.ts`: 상태, 모델·선택값 타입, 연결 및 설정 API.
- `src/main/codex-executable.ts`: PATH 및 표준 설치 위치 탐색. Windows npm 설치는 `.cmd`/`.ps1` 대신
  해당 패키지의 네이티브 실행 파일을 찾는다. CLI를 앱에 번들하거나 자동 설치하지 않는다.
- `src/main/codex-rpc.ts`: `codex app-server`를 숨겨진 자식 프로세스로 시작하고 stdio JSON-RPC로 통신한다.
  초기화와 요청 시간 제한을 처리한다. renderer가 실행 파일·인수·RPC 메서드를 임의로 지정할 수 없다.
- `src/main/codex-connection.ts`: 버전 확인, `account/read`, `account/login/start`, 완료 알림과 취소 처리.
  인증 URL은 HTTPS의 `auth.openai.com` / `chatgpt.com`만 시스템 브라우저로 전달한다.
- `src/main/codex-settings.ts`: `app.getPath("userData")/codex-settings.json`에 모델·생각 수준을 임시 파일 교체로 저장한다.
  Codex CLI의 공유 `config.toml`은 변경하지 않는다.
- `src/main/codex.ts`: 현재 창의 메인 프레임만 허용하는 IPC와 창 종료 시 정리.
- `src/preload/index.ts`: 제한된 메서드와 상태 변경 구독을 노출한다.

로그인 토큰은 Codex가 저장·갱신한다. My Hub는 인증 파일을 읽거나 토큰을 별도로 저장하지 않으며,
renderer에는 이메일·플랜·CLI 경로·버전과 상태만 전달한다. API 키/Bedrock 계정은 ChatGPT 구독 연결로
표시하지 않는다. 자식 프로세스에는 `OPENAI_API_KEY`, `CODEX_API_KEY`, `ELECTRON_RUN_AS_NODE`를 전달하지 않는다.

기존 CLI와 로그인 상태를 공유한다. **로그인 취소**는 진행 중인 인증과 My Hub가 실행한 프로세스만 정리하며
기존 계정을 로그아웃시키지 않는다. **연결 해제**는 공식 `account/logout`을 실행하고 `account/read`로 결과를
확인한다. 공유 로그인 정보가 제거되어 이 기기의 Codex CLI에서도 로그아웃된다는 점을 버튼 옆에 안내한다.
모델/생각 수준 설정은 유지한다. 상태 확인/로그인 완료·실패·취소·해제·시간 초과 후 프로세스를 종료하므로
사용하지 않을 때 상주하지 않는다. 창을 닫을 때도 자기 자식 프로세스만 종료한다.

연결 후 `model/list`의 모든 페이지에서 모델과 `supportedReasoningEfforts`를 가져온다. 모델명과 지원 수준을
고정하지 않으며, 저장할 때 현재 목록의 모델/수준 조합인지 main에서 검증한다. 목록 조회 실패는 별도로 표시한다.
모델 변경 시 생각 수준은 모델 기본값으로 초기화한다. `Codex 기본값`은 모델/생각 수준을 모두 `null`로 저장하여
Ctrl+K 작업 요청에서 명시적 override를 생략한다. 특정 모델의 `모델 기본값` 역시 수준 override를 생략한다.
목록에서 사라진 선택은 자동 삭제하지 않고 다시 선택하도록 표시한다. 손상된 설정도 명시적 재선택 전에는 보존한다.

설정 화면 자체는 계정 확인과 선택값 저장을 담당한다. Ctrl+K는 별도 요청 프로세스의
`thread/start` / `turn/start`에 저장한 모델과 생각 수준을 적용하고 캘린더·할일을 관리한다.
실행 경계와 한계는 `features/quick-command/README.md`와 루트 `ctrl-k-report.md`를 참고한다.
`connected`는 Codex의 계정 조회 결과를 의미하며 특정 모델 사용 권한이나 남은 한도를 보장하지 않는다.
main/preload 변경을 적용하려면 Electron을 완전히 닫고 `pnpm dev`를 다시 실행한다.

## 검증과 배포 범위

`pnpm test:codex`는 메모리 스트림으로 stdio를 흉내 내 실제 계정 변경 없이 인증 흐름, 취소·실패·시간 초과,
프로세스 정리, 토큰 비노출과 IPC 프레임 제한을 검사한다. CLI 탐색은 임시 npm 설치 구조로 확인한다.
모델 목록의 페이지 처리, 숨김 모델 제외, 지원 수준 검증과 설정 파일 복원도 검사한다.

공식 [App Server 인증 문서](https://learn.chatgpt.com/docs/app-server#auth-endpoints)는 기존 인증을
로컬·오픈소스 앱용으로 안내하며 상용/호스팅 서비스에는 허용하지 않는다. 상용 배포 시에는
[Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source) 또는 API 키 인증을 검토한다.
