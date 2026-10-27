# 공유 일정 모델

App은 `CalendarStore`를 한 번 생성해 캘린더 페이지와 일정 현황 위젯에 전달한다.
두 소비자가 같은 구독 상태를 사용하므로 화면 재방문 시 store를 만들거나 IPC를
다시 초기화하지 않는다. 다른 slice는 `@/entities/calendar-event`에서 가져온다.

- `model/calendar-store.ts`: 일정 로드·저장·삭제, revision과 충돌·오류 상태.
- `lib/calendar-dates.ts`: 날짜 이동, 새 일정, 편집 초안과 계약 데이터 간 변환.
- `lib/schedule-status.ts`: 일정 시작·종료·진행 상태와 다음 일정·카운트다운 계산.

이 entity는 UI나 feature·widget·page를 참조하지 않는다. IPC 타입·스키마의 원본은
루트 `src/shared/calendar.ts`에 유지하며, main/preload 계약을 복제하지 않는다.
store는 생성자로 전달받은 API만 사용한다. React나 전역 `window.api`에 의존하지 않는다.
