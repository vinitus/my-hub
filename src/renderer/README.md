# Renderer 작업 안내

Electron 창 안에서 실행하는 React 화면이다. Vite root는 이 디렉터리이며,
`@/`와 `@renderer/`는 모두 `src/renderer/src`를 가리킨다.

## shadcn 출처와 현재 구성

화면 레이아웃의 기반은 [shadcn Blocks](https://ui.shadcn.com/blocks)의
`dashboard-01`이다. 현재 사이드바와 본문은 메모 기능에 맞게 변경했다.
원본의 `nav-*`, 지표 카드, 차트, 데이터 테이블과 `app/dashboard/data.json`은
참고용으로 남아 있으며 현재 App에는 연결하지 않는다.
`src/components/ui`의 기본 UI도 shadcn에서 가져온 로컬 소스다.

루트 `components.json`은 `base-vega`, `neutral`, CSS 변수, Lucide 아이콘을 사용한다.
기본 UI는 Base UI의 `render` prop 등을 사용하므로 다른 스타일이나 Radix 기반 예제를
가져올 때 props를 확인한다. 일부 `"use client"`는 가져온 코드에 남은 지시문이며,
이 프로젝트는 Next.js가 아닌 Vite React 앱이다. `src/app`은 자동 라우팅 경로가 아니다.

## 화면이 연결되는 순서

```text
index.html
└─ src/main.tsx: React 마운트, 로컬 ThemeProvider
   └─ src/App.tsx: SidebarProvider, useNote의 문서 상태
      ├─ AppSidebar: 메모 선택, 새 메모, 열기, 테마 전환
      └─ SidebarInset
         ├─ SiteHeader: 사이드바 토글, 화면 이름
         └─ NoteWorkspace: 파일 도구, 상태/오류, 본문 스크롤
            └─ NoteEditor: Plate 편집기, 서식 도구, / 메뉴
```

## 메모의 편집·저장 구조

| 파일                                    | 역할                                                  |
| --------------------------------------- | ----------------------------------------------------- |
| `src/features/notes/use-note.ts`        | 문서 상태, dirty, 초안 복원, 단축키, 비동기 파일 작업 |
| `src/features/notes/note-workspace.tsx` | 파일 버튼, 저장 상태, 오류, 편집 화면                 |
| `src/features/notes/note-editor.tsx`    | Plate 생명주기, 툴바, 붙여넣기, 슬래시 메뉴           |
| `src/features/notes/editor-plugins.tsx` | 지원하는 Markdown 노드와 입력 규칙의 허용 목록        |
| `src/features/notes/note-elements.tsx`  | 실제 HTML 노드, 체크박스, 링크 렌더링                 |
| `src/features/notes/markdown.ts`        | 미지원 Markdown 검사                                  |
| `src/features/notes/notes.css`          | 에디터 안에만 적용하는 Markdown 서식                  |
| `../shared/notes.ts`                    | main/preload/renderer가 공유하는 파일 API 타입        |
| `../preload/index.ts`                   | `window.api.notes`의 제한된 IPC 브리지                |
| `../main/notes.ts`                      | 네이티브 파일 대화상자, 파일 ID 관리, 닫기 확인       |
| `../main/note-files.ts`                 | UTF-8 읽기, 외부 변경 검사, 임시 파일 작성 후 교체    |

- 문서는 단일 메모 단위로 편집하며 저장 결과는 UTF-8 `.md` 텍스트다.
  메모 목록/폴더 탐색/동기화는 아직 구현하지 않았다.
- 지원 범위는 문단, 제목 1~6, 굵게, 기울임, 취소선, 인라인 코드, 목록,
  중첩 목록, 체크리스트, 인용문, 링크, 코드 블록, 구분선이다.
  체크리스트와 취소선은 GitHub Flavored Markdown 확장이다.
- 기본 입력은 즉시 서식으로 바뀐다. 예: `# `, `## `, `- `, `1. `, `> `.
  코드 펜스는 백틱 3개 뒤 Enter, 체크리스트는 `- [ ] `로 시작한다.
- 빈 문단에서 `/`를 누르면 블록 메뉴를 연다. 위/아래 키로 이동하고 Enter로 선택,
  Escape로 취소한다. 툴바에서도 블록과 인라인 서식을 선택할 수 있다.
- 표·이미지·HTML·각주 등은 열기와 붙여넣기 전에 검사해 거부한다.
  원본이 일부 사라진 상태로 저장되는 일을 방지하기 위한 범위 제한이다.
- 편집 중에는 Plate 노드 트리를 유지하고 변경 시 Markdown으로 직렬화한다.
  **입력마다 Markdown을 다시 deserialize하지 않는다.** 커서와 undo가 초기화된다.
  파일 열기/새 문서 생성 시 `note.key`가 바뀌어 에디터를 새로 만든다.
- `schema`나 플러그인을 확장할 때 렌더러, 입력 규칙, Markdown 변환, 허용 검사와
  `tests/notes.test.ts`의 왕복 변환 테스트를 함께 수정한다.

## 파일과 초안의 구분

상단 파일명은 더블클릭(키보드 Enter/F2)하여 수정한다. Enter나 포커스 이동으로 적용하고
Esc로 취소한다. `.md`는 자동으로 붙으며 새 메모는 첫 저장의 기본 파일명으로 사용한다.
저장된 메모는 본문 변경을 저장하지 않고 같은 폴더의 실제 파일명만 바꾼다.
같은 이름의 다른 파일은 덮어쓰지 않는다.

`localStorage`의 `my-hub:markdown-draft:v1`은 마지막 편집 내용의 임시 복원용이다.
실제 `.md` 저장은 저장 버튼 또는 단축키로 수행한다. 재시작 후 초안은 새 메모로
복원하며 이전 파일 경로에 자동 덮어쓰지 않는다. 새 메모/열기와 창 닫기는 변경이
있으면 저장·저장하지 않음·취소를 확인한다. 초안 보관이 실패하면 오류를 표시한다.

Renderer는 파일 경로를 임의로 지정해 저장할 수 없다. 사용자가 대화상자에서
선택한 파일에 main이 ID를 발급하고, 이후 저장은 그 ID로만 요청한다. 저장 직전에
파일 내용의 외부 변경을 확인하며 충돌 시 원본을 덮어쓰지 않는다. 5MB 이하 UTF-8
메모를 지원한다. 브라우저 미리 보기에서는 편집/초안만 가능하며 네이티브 열기·저장은
Electron 앱에서만 제공한다.

| 단축키                 | 동작               |
| ---------------------- | ------------------ |
| Ctrl/Cmd+N             | 새 메모            |
| Ctrl/Cmd+O             | `.md` 파일 열기    |
| Ctrl/Cmd+S             | 저장               |
| Ctrl/Cmd+Shift+S       | 다른 이름으로 저장 |
| Ctrl/Cmd+B / I         | 굵게 / 기울임      |
| Ctrl/Cmd+Z             | 실행 취소          |
| Ctrl/Cmd+B (본문 바깥) | 사이드바 토글      |
| D (입력 중이 아닐 때)  | 테마 전환          |

## 레이아웃·테마 변경 위치

- App의 `h-svh overflow-hidden`과 상위 flex의 `min-h-0`를 유지한다.
  스크롤은 NoteWorkspace의 본문에서 처리하며 툴바는 그 안에서 sticky로 유지한다.
- `--sidebar-width`와 `--header-height`는 App에서 정하고 공통 컴포넌트가 참조한다.
- `src/index.css`의 `:root` / `.dark`로 색상·폰트·반경을 바꾼다.
  에디터 서식은 전역 UI를 건드리지 않고 `features/notes/notes.css`에서 조정한다.
- 테마는 `components/theme-provider.tsx`의 로컬 Provider와 `useTheme`을 사용한다.
  아직 연결하지 않은 `ui/sonner.tsx`는 next-themes를 참조하므로 도입 시 맞춰야 한다.
- `ui/sidebar.tsx`는 cookie를 기록만 한다. 다시 시작할 때 복원하지는 않는다.
- 외부 리소스/통신은 `index.html`의 CSP와 루트 `vite.config.ts` 개발 예외도 확인한다.
  Vite 정적 파일 경로는 저장소 루트의 `public/`이다.

UI 추가 명령은 루트에서 `pnpm exec shadcn add <component>`를 실행한다.
기존 UI를 다시 가져올 때는 프로젝트 소유 소스의 로컬 수정과 diff를 비교한다.

## 확인 명령

저장소 루트에서 실행한다.

```bash
pnpm typecheck
pnpm test:notes    # Markdown 왕복/입력 규칙, UTF-8 파일 저장, IPC/닫기 흐름
pnpm lint
pnpm dev          # main/preload를 다시 빌드하고 Electron 창 실행
```

main/preload 변경은 개발 서버의 HMR 대상이 아니므로 Electron을 닫고 `pnpm dev`를
다시 실행해야 한다. 원본 shadcn 예제의 기존 ESLint 오류는 메모 기능과 별도로 남아 있다.
