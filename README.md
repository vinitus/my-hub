# Electron + React + TypeScript + Vite + shadcn/ui

앱은 메모 화면으로 시작합니다. Ctrl+K 또는 헤더의 **빠른 입력**으로 한 줄 AI 요청을 입력하면
입력창이 닫히고 우측 하단에 작업 상태가 표시됩니다. AI는 아직 연결되지 않아 현재는
**AI 연결 필요**로 안내하며 실제 일정·메모를 생성하지 않습니다.

## 바로가기

사이드바의 **바로가기**에서 프로그램(`.exe`/`.lnk`), 폴더, 웹사이트를 등록합니다.
카드를 클릭하면 프로그램·탐색기·기본 브라우저로 열립니다.
프로그램·폴더나 브라우저의 웹 링크를 화면에 하나씩 끌어 놓아 등록할 수도 있습니다.
드롭하면 등록창에서 이름과 대상을 확인한 뒤 저장합니다.
이름/경로 검색, 종류별 필터, 수정과 목록에서 삭제를 지원합니다.
설정은 앱 데이터 폴더의 `shortcuts.json`에 저장합니다.

`pnpm test:shortcuts`로 저장과 실행 경계를 검사합니다.
상세 구조는 [바로가기 유지보수 안내](src/renderer/src/features/shortcuts/README.md)를 참고하세요.
새 main/preload API를 사용하려면 Electron을 완전히 닫고 `pnpm dev`를 다시 실행하세요.

## 캘린더

사이드바의 **캘린더**에서 월·주·일·목록 보기를 사용할 수 있습니다.
날짜 클릭이나 범위 선택으로 일정을 추가하고, 일정을 클릭해 수정·삭제합니다.
드래그 이동과 길이 조절 결과도 로컬에 저장합니다.

일정은 Electron 앱 데이터 폴더(`app.getPath("userData")/calendar.json`)에 저장합니다.
캘린더 하단의 저장 안내에 마우스를 올리면 실제 경로를 확인할 수 있습니다.
반복 일정과 알림, 외부 캘린더 동기화는 아직 지원하지 않습니다.

`pnpm test:calendar`로 날짜·저장·충돌 처리를 검증합니다.
구조와 날짜 규칙은 [캘린더 유지보수 안내](src/renderer/src/features/calendar/README.md)를 참고하세요.
main/preload가 추가되었으므로 기존 Electron을 닫고 `pnpm dev`로 다시 실행해야 합니다.

기존 shadcn 대시보드와 루트 의존성 버전을 유지한 Electron 소스 이식 프로젝트입니다.
`electron-vite`는 사용하지 않습니다. `scripts/dev.mjs`가 Vite API로 개발용 main/preload를 빌드하고 Electron을 실행합니다.

## 현재 제공하는 명령

```bash
pnpm install
pnpm dev          # main/preload 개발 빌드 → Vite 서버 → Electron 창 실행
pnpm typecheck    # main/preload 및 renderer 타입 검사
pnpm build        # 타입 검사 후 renderer만 out/renderer에 빌드
pnpm preview      # renderer를 브라우저에서 미리 보기
pnpm lint
```

`pnpm dev`는 Electron 창에서 대시보드를 엽니다. Renderer 수정은 Vite HMR로 반영됩니다. Main/preload 수정 후에는 `Ctrl+C`로 종료하고 `pnpm dev`를 다시 실행합니다.
Electron 프로세스가 종료되면 Vite 서버도 종료합니다. macOS에서 창만 닫으면 앱은 계속 실행될 수 있으므로 앱 종료 또는 `Ctrl+C`를 사용합니다.

Windows에서 Electron은 한글 오류를 UTF-8 바이트로 출력합니다. 자식 프로세스의 stderr를 터미널에 직접 연결하면 코드 페이지에 따라 `액세스가 거부되었습니다`가 깨져 보였습니다. 개발 실행기는 stderr를 UTF-8로 읽어 출력합니다. 콘솔 코드 페이지를 변경하지 않습니다.

동일한 앱을 두 번 실행했을 때 `Unable to move the cache`, `Gpu Cache Creation failed: -2` 오류도 재현했습니다. 두 프로세스가 같은 Chromium 캐시 경로에 접근한 상황입니다. 개발 앱은 한 인스턴스만 실행되도록 변경했습니다. 이미 이전 버전의 앱이 열려 있다면 창을 닫고 다시 `pnpm dev`를 실행하세요. `Port 5173 is in use`는 Vite 서버의 포트 충돌 메시지이며, 다른 서비스가 해당 포트를 사용해도 표시될 수 있습니다.

`pnpm build`는 아직 renderer만 빌드하고, `pnpm preview`는 renderer의 브라우저 미리 보기입니다. 브라우저 미리 보기에는 `window.electron`, `window.api`가 주입되지 않습니다.

## `pnpm dev`를 실행해도 Electron 창이 열리지 않았던 원인

2026-09-21에 Vite 8.2.2와 현재 프로젝트 설정으로 확인했습니다.

### 원인

`[vite] (client) [optimizer] bundling dependencies...`는 의존성 사전 번들링이 1초 이상 걸릴 때 표시하는 진행 로그입니다. 이 버전은 완료 메시지를 기본 로그 수준에 출력하지 않으므로, 작업이 끝나도 이 문구가 마지막 줄에 남을 수 있습니다. 개발 서버는 파일 변경과 브라우저 요청을 기다리며 계속 실행됩니다.

실제 누락은 `package.json`의 `dev` 명령이 `vite`만 실행하고 있었다는 점입니다. Main/preload 빌드, Electron 프로세스 실행, 개발 서버 URL 전달이 연결되지 않아 **Vite 서버가 정상이어도 Electron 창은 열리지 않았습니다.**

이전 검증은 HTTP 응답까지만 확인해서 Electron 실행 누락을 놓쳤습니다. 브라우저 자동 열기는 이 문제를 해결하지 않으므로 제거했습니다.

### 수정 내용

- `pnpm dev`가 `node scripts/dev.mjs`를 실행하도록 변경했습니다.
- Main을 `out/main/index.js`(ESM), preload를 `out/preload/index.cjs`(CommonJS)로 먼저 빌드합니다.
- Vite 서버가 준비되면 실제 주소를 `ELECTRON_RENDERER_URL`에 넣어 Electron을 실행합니다. 기본 포트가 사용 중이면 Vite가 선택한 포트를 그대로 전달합니다.
- Electron 창 준비, preload 오류, 화면 로딩 실패를 터미널에 표시합니다.
- 최초 실행 시 Electron 실행 파일이 없으면 Electron 패키지가 다운로드합니다. 다운로드 오류가 발생하면 터미널에 오류를 표시하고 실행을 중단합니다.

### 실행 확인 방법

```bash
pnpm dev
```

Electron 창이 열리고 터미널에 `[dev] Electron window ready.`가 표시되는지 확인합니다. 서버를 종료할 때는 `Ctrl+C`를 누릅니다.

창이 열려도 화면이 비어 있다면 F12로 Electron 개발자 도구를 열어 Console과 Network를 확인합니다. `Outdated Optimize Dep` 또는 최적화 캐시 관련 오류가 확인된 경우에는 서버를 종료한 뒤 `pnpm dev --force`로 Vite 캐시를 다시 생성할 수 있습니다. 일반 실행에는 이 옵션이 필요하지 않습니다.

참고: [Vite 8.2.2 optimizer 구현](https://github.com/vitejs/vite/blob/v8.2.2/packages/vite/src/node/optimizer/index.ts).

## 빌드·실행 구성의 연결 지점

| 입력                      | 필요한 출력               | 형식                    |
| ------------------------- | ------------------------- | ----------------------- |
| `src/main/index.ts`       | `out/main/index.js`       | ESM                     |
| `src/preload/index.ts`    | `out/preload/index.cjs`   | CommonJS                |
| `src/renderer/index.html` | `out/renderer/index.html` | 기존 Vite 설정으로 빌드 |

- 루트의 `type: module`과 `main: ./out/main/index.js`를 기준으로 구성합니다.
- Main/preload 빌드에서 `electron`과 Node 내장 모듈은 번들에 포함하지 않습니다.
- `@electron-toolkit/utils`, `@electron-toolkit/preload`는 원본 스캐폴딩의 런타임 유틸리티입니다. `electron-vite`와 별개이며 dependencies에 선언되어 있습니다.
- `scripts/dev.mjs`가 Vite 서버 준비 후 실제 주소를 `ELECTRON_RENDERER_URL`에 넣고 Electron을 시작합니다.
- 해당 환경변수가 없거나 패키징된 앱에서는 `out/renderer/index.html`을 읽습니다.
- 개발용 main/preload는 시작할 때 한 번 빌드합니다. 해당 소스의 변경 감지·자동 재시작과 프로덕션 빌드 구성은 추가 구현할 영역입니다.
- `resources/icon.png`는 `app.getAppPath()` 기준으로 읽으므로 별도의 `?asset` 플러그인이 필요하지 않습니다.
- `window.electron`에는 toolkit API, `window.api`에는 앱별 API를 노출합니다. 타입 선언은 `src/preload/index.d.ts`에 있습니다.

## 패키징 설정

`electron-builder.yml`과 `build/`의 플랫폼 아이콘·macOS entitlements를 이식했습니다.
직접 작성한 main/preload 빌드와 renderer 빌드를 모두 완료한 뒤 다음 명령을 사용할 수 있습니다.

```bash
pnpm exec electron-builder --dir
pnpm exec electron-builder --win
```

현재 `pnpm build`만으로는 Electron 패키징에 필요한 출력이 모두 생성되지 않습니다.
앱 식별자 `com.electron.app`은 예제 값이며, 배포 전에 제품 정보와 서명 설정을 지정하세요.
원본의 예제 업데이트 서버와 사용하지 않는 권한 설명은 이식하지 않았습니다.
`electron-scaffolding/`은 참고용 원본으로 유지하며 루트 lint·format·패키징 대상에서 제외합니다.

## shadcn/ui

화면 구조와 수정 지점은 [Renderer 작업 안내](src/renderer/README.md)를 참고하세요.

```bash
pnpm exec shadcn add button
```

컴포넌트는 `src/renderer/src/components/ui`, CSS는 `src/renderer/src/index.css`를 사용합니다.
`@/` 및 `@renderer/`는 `src/renderer/src`를 가리킵니다.

```tsx
import { Button } from "@/components/ui/button"
```

## Markdown 메모

Plate 기반으로 본문을 바로 편집하며 UTF-8 `.md` 파일을 열고 저장합니다.
제목, 굵게/기울임, 목록, 체크리스트, 인용, 링크, 코드 블록을 지원합니다.
빈 문단의 `/` 또는 툴바로 블록을 선택할 수 있습니다.

- `Ctrl/Cmd+N`: 새 메모, `Ctrl/Cmd+O`: 열기
- `Ctrl/Cmd+S`: 저장, `Ctrl/Cmd+Shift+S`: 다른 이름으로 저장
- 기본 저장 위치는 OS 문서 폴더의 `My Hub/Notes`이며 사이드바에서 변경할 수 있습니다.
- 저장된 메모 목록과 이름 검색을 제공하며 입력을 1초 멈추면 `.md`로 자동 저장합니다.
- 같은 이름의 새 메모는 번호를 붙여 저장하고, 외부 변경 충돌 시 자동 저장을 멈춥니다.
- 편집 내용은 로컬 초안으로도 보관하며 재실행하면 저장된 메모를 이어서 엽니다.
- 표·이미지·HTML 등 미지원 요소가 있는 파일은 내용 유실을 막기 위해 열기를 제한합니다.
- `pnpm test:notes`로 Markdown 변환, 파일 IO, IPC/닫기 흐름을 검증합니다.

main/preload도 변경했으므로 실행 중인 Electron을 닫고 `pnpm dev`를 다시 실행하세요.
브라우저 미리 보기에는 네이티브 파일 열기·저장이 제공되지 않습니다.
