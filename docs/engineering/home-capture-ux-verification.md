# 홈 인박스·할일 추가 UX 검증

## 범위와 구현

- `인박스추가.md`, `할일추가.md`를 읽고 아래 완료 기준을 대조했다. 두 원본 요구 문서는 커밋에서 제외한다.
- 인박스는 `InboxQuickAddPopover`, 할일은 `HomeCreateDialog`와 기존 `TodoForm`을 사용한다.
- 홈은 `inboxAction` 슬롯으로 실제 버튼과 팝오버를 함께 조립한다. 다른 slice는 공개 API로 참조한다.
- 저장 모델·API·store·main/preload·자동 저장/복원 로직·패키지 의존성은 변경하지 않았다.
- 성공 안내는 기존 Sonner와 앱의 테마를 재사용한다. 두 기능이 같은 안내 ID를 갱신해 연속 저장 안내가 겹치지 않는다. 토스트의 추가 전역 단축키는 비활성화했다.

## 인박스 완료 기준 대조

| 기준 | 구현 및 확인 근거 |
| --- | --- |
| 버튼 아래 비모달 팝오버 | Base UI Popover, `modal={false}`, 버튼을 실제 Trigger로 사용. Storybook에서 위치·비모달 속성 확인. |
| 전체 화면 블러·오버레이 제거 | Backdrop 없이 Portal/Positioner/Popup만 사용. 오버레이 부재 검사. |
| 입력·저장·취소·닫기 유지 | 단일 입력, 저장, 취소, X, Esc, 바깥 클릭, 버튼 재클릭 흐름 검사. |
| 화면 경계 내 표시 | 400px 기본 폭, 뷰포트 최대 폭, 가용 높이 제한, 충돌 회피. 1100px/360px 경계 검사. |
| 자동 포커스·Enter·Esc | 입력 자동 포커스, 실제 Enter 저장, Escape 닫기와 트리거 포커스 복귀 검사. |
| IME·중복 방지 | 조합 중 Enter 차단, ref 기반 즉시 제출 잠금. 저장 중 반복 제출에도 1개만 수집되는지 검사. |
| 저장 성공·실패 피드백 | 저장 중 버튼, 성공 토스트, 오류 alert. 실패 후 입력값·항목 수 확인. |
| 닫은 초안 보존 | 초안을 팝오버 콘텐츠 밖 상태에 보존. 바깥 클릭·재클릭·X·취소 후 다시 열어 초안 확인. 성공 후 초기화 확인. |
| 전체 인박스에서 확인 | 실제 InboxStore의 로컬 메모리 API로 링크·출처·미처리 상태 확인. 최근 인박스 클릭으로 전체 화면의 해당 항목 포커스 확인. |
| 낙서장·홈 보존 | 저장 전후 낙서장 내용 유지, 입력 중 Ctrl+S 차단, 기존 크기 조절·확대·계산기·패널 회귀 검사. |

대표 스토리: `앱/홈 인박스 빠른 추가`의 Default, Save Failure.
각 스토리에서 빈 입력, 작성, 저장 중, 성공 또는 실패 상태를 상호작용으로 검증한다.

## 할일 완료 기준 대조

| 기준 | 구현 및 확인 근거 |
| --- | --- |
| 제목·마감일·완료·추가·취소·X 유지 | 기존 폼과 store를 재사용. 날짜 지정/지우기, 완료 체크, 취소, Esc, 기존 할일 화면 CRUD 검사. |
| 간결한 모달 높이·여백 | 420px 중앙 모달, 좁은 화면 최대 폭·높이 제한, 간격 축소와 가로 푸터. 라이트/다크/360px 화면 확인. |
| 제목 자동 포커스 | 모달 개방 후 실제 활성 요소 검사. |
| 마감일·선택 안내 | 레이블과 선택 사항을 같은 행에 표시. 기본 날짜 필드와 달력 아이콘 유지. Delete 또는 기존 지우기 버튼으로 제거. 날짜 변경 전후 높이 검사. |
| 가로 취소·추가 버튼 | 동일 행의 좌우 위치 검사. 취소 보조·추가 주요 스타일, 빈 제목 비활성화 유지. |
| Enter·Esc·Tab·IME | 실제 키 입력으로 등록/닫기 및 제목→날짜 세그먼트→완료→취소→추가 순서 확인. 조합 Enter 차단과 열린 날짜 선택기 우선 처리 검사. |
| 저장 상태·입력 보존 | 저장 중 버튼·중복 제출 방지·성공 토스트 확인. 저장 실패 시 제목·날짜·완료를 모두 보존하는지 확인. |
| 저장·현황 반영 회귀 방지 | 홈 controller가 기존 공유 TodoStore를 갱신하는지 검사. 기한·완료 값과 기한 없는 새 할일 확인. App의 할일 화면·오른쪽 패널 공유 store 연결 유지. |

대표 스토리: Todo, Dated Completed, Loading, Load Error, Saving, Save Error,
Home Actions, Home Save Failure. 기존 TodoWorkspace 스토리와 CRUD 검증도 유지한다.

## 통합 검증

`Combined Actions`는 같은 홈에 두 기능을 조립한 고정 fixture다.
실제 마우스 입력으로 인박스 작성 중 할일 등록으로 이동하고, 취소 후 인박스 초안이
복원되는지 확인한다. 이어서 인박스와 기한 없는 할일을 연속 저장해 각각 1개만
추가되고 낙서장이 유지되며 최신 성공 안내 하나만 표시되는지 검사한다.

Storybook은 Strict Mode, 라이트 1100px·다크 1100px·다크 360px에서 실행한다.
고정 시각과 로컬 mock만 사용하며 Electron 브리지·실제 사용자 파일·계정·외부 요청을 사용하지 않는다.

## 검증 한계와 진단 기록

- 숨겨진 offscreen Electron에서는 기본 OS 날짜 팝업이 실제로 표시되지 않았다.
  날짜 필드의 실제 Tab/Delete 입력과 값 저장은 검증했고, 열린 팝업의 `:open` 상태는
  해당 테스트 안에서만 mock해 Enter/Esc가 모달 닫기나 할일 제출로 이어지지 않는지 검사했다.
  OS 달력 팝업 자체의 시각·키보드 검증을 수행한 것으로 간주하지 않는다.
- 추가 메모 회귀 검사에서 파일명 변경 중 편집 보존 사례가 한 번 실패했다.
  관련 테스트·메모 store·낙서장 저장 코드가 기준 커밋과 동일함을 확인했고,
  해당 사례 단독 실행 및 전체 메모 23개 재실행은 모두 통과했다. 재현되지 않은 원인은 단정하지 않았다.
- 기존 500KB 초과 번들 경고와 Electron `chrome_100_percent.pak` 경고는 남아 있다.
  최종 명령의 성공 여부와 별도로 기록한다.

## 최종 실행 결과

| 명령 | 결과 |
| --- | --- |
| `corepack pnpm typecheck` | Node/Web 모두 통과. 최종 `build`에서도 재실행. |
| `corepack pnpm lint` | 통과. 최종 테스트 보강 후 다시 통과. |
| `corepack pnpm build` | 통과. |
| `corepack pnpm build-storybook` | 통과. |
| `corepack pnpm test:storybook` | 전체 232개 스토리 × 3환경 = 696회 통과. |
| `STORYBOOK_TEST_FILTER=home-`의 `test:storybook` | X 닫기·성공 후 초기화 보강 후 홈 24개 × 3환경 = 72회 통과. |
| `corepack pnpm test:inbox` | 5개 통과. |
| `corepack pnpm test:todos` | 5개 통과. |
| `corepack pnpm test:fsd` | 27개 통과. |
| `corepack pnpm test:notes` | 재실행 23개 통과. 위 일시 실패 진단 참조. |
| `corepack pnpm test:calendar` | 11개 통과. |
| `corepack pnpm test:shortcuts` | 19개 통과. |
| `git diff --check` | 통과. |

라이트 인박스 팝오버와 다크 360px 할일 모달의 생성된 PNG도 직접 확인했다.
스크린샷·빌드 산출물·임시 테스트 프로필은 커밋에 포함하지 않는다.

## 변경 파일

- `src/renderer/src/features/inbox`: 빠른 추가 UI를 팝오버로 변경, 공개 API와 README 갱신.
- `src/renderer/src/features/todos`: 공유 폼의 제출 보호와 dialog 전용 간격·버튼 배치, README 갱신.
- `src/renderer/src/pages/home/ui`: 버튼에 붙는 인박스 UI를 슬롯으로 받아 기존 홈 배치를 유지.
- `src/renderer/src/app/App.tsx`: 팝오버 슬롯과 기존 토스트 UI 조립.
- `src/renderer/src/app/ui/home-create-dialog.tsx`: 중앙 할일 등록 모달의 크기·설명·성공 피드백.
- 홈 빠른 추가/등록 모달의 두 Storybook 파일: 로컬 fixture·대표 상태·통합 상태.
- `scripts/test-storybook-browser.cjs`: 키보드·저장·초안·동시 사용·뷰포트 회귀 검증.
- 본 문서: 요구사항별 완료 근거와 실행 결과.
