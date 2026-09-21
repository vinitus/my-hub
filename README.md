# Electron + React + TypeScript + Vite + shadcn/ui

기존 shadcn 대시보드와 루트 의존성 버전을 유지한 Electron 소스 이식 프로젝트입니다.
`electron-vite`는 사용하지 않습니다. Main/preload 빌드와 Electron 실행·재시작 자동화는 직접 구성할 영역으로 남겨 두었습니다.

## 현재 제공하는 명령

```bash
pnpm install
pnpm dev          # Vite renderer 개발 서버만 실행
pnpm typecheck    # main/preload 및 renderer 타입 검사
pnpm build        # 타입 검사 후 renderer만 out/renderer에 빌드
pnpm preview      # renderer를 브라우저에서 미리 보기
pnpm lint
```

`pnpm dev`, `pnpm build`, `pnpm preview`는 Electron을 실행하거나 main/preload를 빌드하지 않습니다.
브라우저 미리 보기에는 `window.electron`, `window.api`가 주입되지 않습니다.

## 직접 작성할 빌드·실행 구성의 연결 지점

| 입력                      | 필요한 출력               | 형식                    |
| ------------------------- | ------------------------- | ----------------------- |
| `src/main/index.ts`       | `out/main/index.js`       | ESM                     |
| `src/preload/index.ts`    | `out/preload/index.cjs`   | CommonJS                |
| `src/renderer/index.html` | `out/renderer/index.html` | 기존 Vite 설정으로 빌드 |

- 루트의 `type: module`과 `main: ./out/main/index.js`를 기준으로 구성합니다.
- Main/preload 빌드에서 `electron`과 Node 내장 모듈은 번들에 포함하지 않습니다.
- `@electron-toolkit/utils`, `@electron-toolkit/preload`는 원본 스캐폴딩의 런타임 유틸리티입니다. `electron-vite`와 별개이며 dependencies에 선언되어 있습니다.
- 개발 실행기는 Vite 서버가 준비된 뒤 실제 주소를 `ELECTRON_RENDERER_URL`에 넣고 Electron을 시작해야 합니다.
- 해당 환경변수가 없거나 패키징된 앱에서는 `out/renderer/index.html`을 읽습니다.
- Main/preload 변경 감지, 빌드 순서, Electron 재시작 및 종료 처리는 직접 구현해야 합니다.
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

```bash
pnpm exec shadcn add button
```

컴포넌트는 `src/renderer/src/components/ui`, CSS는 `src/renderer/src/index.css`를 사용합니다.
`@/` 및 `@renderer/`는 `src/renderer/src`를 가리킵니다.

```tsx
import { Button } from "@/components/ui/button"
```
