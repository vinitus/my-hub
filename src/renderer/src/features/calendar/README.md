# 캘린더 유지보수 안내

FullCalendar 7 React를 사용한다. 월·주·일·목록 보기, 날짜 클릭/범위 선택,
일정 추가·수정·삭제, 드래그 이동과 길이 조절을 지원한다.
반복 일정과 외부 서비스 동기화는 아직 구현하지 않았다. 일정 시각의 OS·앱 내 알림,
여러 참고 링크, 사용자가 선택하는 링크 자동 실행 시점을 지원한다.

## 코드와 데이터 흐름

| 파일                                      | 역할                                                |
| ----------------------------------------- | --------------------------------------------------- |
| `../../pages/calendar/ui/calendar-page.tsx`                  | FullCalendar 연결, 탐색 도구, 일정 편집창 열기      |
| `ui/calendar-reminder-center.tsx`            | 앱 내 일정 알림 표시와 알림 클릭 링크 실행          |
| `../../pages/calendar/ui/fullcalendar-views.tsx`                  | 공식 shadcn 어댑터의 테마와 뷰 스타일               |
| `ui/event-sheet.tsx`                         | 일정 입력, 유효성 검사, 삭제 확인                   |
| `../../entities/calendar-event/lib/calendar-dates.ts`                       | 날짜/시간 입력과 저장 형식 변환                     |
| `../../entities/calendar-event/model/calendar-store.ts`                       | React 외부 상태, IPC 요청, 저장 실패 처리           |
| `../../../../shared/calendar.ts`          | main/preload/renderer 공통 스키마와 API             |
| `../../../../main/calendar.ts`            | IPC 호출자 확인과 핸들러 등록                       |
| `../../../../main/calendar-repository.ts` | JSON 읽기, 충돌 검사, 원자적 교체 저장              |
| `../../../../main/calendar-reminders.ts`  | 앱 실행 중 일정 시각 감시, OS 알림과 선택 링크 실행 |

`window.api.calendar`를 통해 main에 요청하며, renderer에서 임의의 파일 경로를
전달할 수 없다. 저장 파일은 `app.getPath("userData")/calendar.json`이다.
실제 경로는 캘린더 하단의 로컬 저장 안내에 마우스를 올려 확인한다.
메모 폴더와 별도로 관리하며, 저장/삭제 성공 응답을 받은 뒤 화면 상태를 갱신한다.
드래그 저장 실패 시 FullCalendar의 `revert()`로 화면을 복구한다.

기존 일정에는 링크 없음, 알림 켜짐, 링크 자동 실행 안 함을 기본 적용한다. 참고 링크는 최대 30개이며
HTTP/HTTPS 주소와 파일 선택으로 지정한 로컬 파일을 저장·실행한다. 알림은 시간 일정의 시작 시각, 종일 일정의 오전 9시(로컬 시간)에 발생한다.
OS 알림과 앱 내 알림은 일정별로 각각 끌 수 있다. 참고 링크 자동 실행은 기본 꺼짐이며,
켰을 때 일정 시각 또는 OS/앱 알림 클릭 중 실행 시점을 고른다. 앱을 종료한 동안의 알림은 예약하지 않는다.

파일 내용의 SHA-256을 revision으로 사용한다. 편집창을 연 시점의 revision을
저장할 때 전달하므로, 외부 수정이나 오래 열린 편집창이 최신 파일을 덮어쓰지 않는다.
충돌 시 새로고침 후 다시 편집한다. 손상된 파일은 자동 초기화하지 않는다.

## 날짜 규칙

- 종일 일정은 `YYYY-MM-DD`이며 종료일은 **포함하지 않는다**. 예를 들어
  10월 27일 하루 일정은 start=`2026-10-27`, end=`2026-10-28`이다.
  편집창에서는 사용자가 이해하기 쉽도록 포함하는 마지막 날짜로 표시한다.
- 시간 일정은 시간대 오프셋이 있는 ISO 문자열이다. 표시/입력은 OS의 로컬 시간대를 쓴다.
  제목만 수정할 때 기존 시간의 오프셋과 초를 보존한다.
- 종일 날짜 계산은 UTC 날짜 연산을 사용해 일광 절약 시간제의 영향을 피한다.
  시간 입력은 실제 존재하는 로컬 시간인지 확인한다.

## 화면과 출처

`App.tsx`는 처음 캘린더를 열 때 lazy load하고 이후에는 숨겨서 유지한다.
메모의 undo/커서와 캘린더의 선택한 보기를 탭 전환 시 보존하기 위한 구조다.
메모 키보드 단축키는 캘린더에서 비활성화하지만 메모 자동 저장은 유지한다.

뷰 어댑터 출처는 [FullCalendar 공식 shadcn 레지스트리](https://shadcn-registry.fullcalendar.io/monarch-event-calendar.json)다.
기존 Base UI 기반 Button을 유지하기 위해 어댑터의 뷰만 가져오고 탐색 도구는
프로젝트의 shadcn 컴포넌트로 구성했다. MIT 고지는 `../../pages/calendar/LICENSE.fullcalendar.md`에 있다.
루트 `components.json`에 `@fullcalendar` 레지스트리가 등록되어 있다.
v7은 플러그인을 `@fullcalendar/react/daygrid` 등의 하위 경로에서 가져온다.
v6 예제를 적용할 때 옵션/API 차이를 확인한다.

## 검증

```bash
pnpm test:calendar
pnpm test:notes
pnpm typecheck
pnpm build
```

`tests/calendar.test.ts`는 날짜 변환, DST, 저장·삭제, 외부 수정/동시 저장 충돌,
손상 파일 보존, IPC 호출자 검증, 저장 실패 시 상태 유지를 검사한다.
main/preload 변경 후에는 Electron을 완전히 닫고 `pnpm dev`를 다시 실행한다.
