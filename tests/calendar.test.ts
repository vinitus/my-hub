import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  CalendarEventSchema,
  type CalendarEvent,
  type CalendarAPI,
} from "../src/shared/calendar"
import { CalendarRepository } from "../src/main/calendar-repository"
import { registerCalendar } from "../src/main/calendar"
import { CalendarStore } from "../src/renderer/src/entities/calendar-event/model/calendar-store"
import { panelSchedule } from "../src/renderer/src/widgets/live-status/model/panel-status"
import {
  eventDraft,
  eventFromDraft,
  shiftDate,
} from "../src/renderer/src/entities/calendar-event/lib/calendar-dates"
import { app, BrowserWindow, handlers, dialog, shell } from "./fakes/electron"

function sample(): CalendarEvent {
  return {
    id: crypto.randomUUID(),
    title: "회의",
    description: "회의 내용",
    color: "blue",
    referenceUrls: [],
    openLinks: "never",
    notifyOS: true,
    notifyInApp: true,
    allDay: false,
    start: "2026-10-27T09:00:00+09:00",
    end: "2026-10-27T10:00:00+09:00",
  }
}

test("우측 현황은 진행 중·지난 일정을 빼고 오늘 일정과 실행 예정 대상을 분리한다", () => {
  const now = new Date(2026, 9, 27, 8, 30).getTime()
  const timed = (
    id: string,
    minutes: number,
    overrides: Partial<CalendarEvent> = {}
  ) =>
    ({
      ...sample(),
      id,
      start: new Date(now + minutes * 60_000).toISOString(),
      end: new Date(now + (minutes + 60) * 60_000).toISOString(),
      ...overrides,
    }) as CalendarEvent
  const events = [
    timed("ongoing", -10, {
      referenceUrls: ["https://example.com/ongoing"],
      openLinks: "at-start",
    }),
    timed("later", 120, {
      referenceUrls: ["C:\\Documents\\자료.pdf"],
      openLinks: "on-notification",
    }),
    timed("next", 30, {
      referenceUrls: ["https://example.com"],
      openLinks: "at-start",
    }),
    timed("never", 40, {
      referenceUrls: ["https://example.com/never"],
      openLinks: "never",
    }),
    timed("empty", 50, { openLinks: "at-start" }),
    timed("tomorrow", 1440, {
      referenceUrls: ["https://example.com/tomorrow"],
      openLinks: "at-start",
    }),
    timed("past", -120),
    timed("now", 0),
  ]
  const result = panelSchedule(events, now)
  assert.deepEqual(
    result.today.map((event) => event.id),
    ["next", "never", "empty", "later"]
  )
  assert.deepEqual(
    result.executions.map((event) => event.id),
    ["next", "later", "tomorrow"]
  )
  assert.equal(events[0].id, "ongoing", "입력 배열의 순서를 바꾸지 않는다")
  assert.deepEqual(panelSchedule(events, now + 2 * 86400_000), {
    today: [],
    executions: [],
  })
  const allDay = {
    ...sample(),
    allDay: true,
    start: "2026-10-27",
    end: "2026-10-28",
    referenceUrls: ["https://example.com"],
    openLinks: "at-start",
  } as CalendarEvent
  assert.equal(panelSchedule([allDay], now).today.length, 0)
  assert.equal(panelSchedule([allDay], now).executions.length, 1)
  assert.equal(
    panelSchedule([allDay], new Date(2026, 9, 27, 9).getTime()).executions
      .length,
    0
  )
})

test("제목, 실제 날짜, 종료 순서와 저장 형식을 검사한다", () => {
  const valid = sample()
  assert.equal(CalendarEventSchema.parse(valid).title, "회의")
  assert.deepEqual(
    CalendarEventSchema.parse({
      ...valid,
      referenceUrls: [join(tmpdir(), "참고.pdf")],
    }).referenceUrls,
    [join(tmpdir(), "참고.pdf")]
  )
  assert.equal(
    CalendarEventSchema.safeParse({
      ...valid,
      referenceUrls: ["javascript:alert(1)"],
    }).success,
    false
  )
  const legacy = { ...valid } as Record<string, unknown>
  delete legacy.referenceUrls
  delete legacy.openLinks
  delete legacy.notifyOS
  delete legacy.notifyInApp
  assert.deepEqual(CalendarEventSchema.parse(legacy).referenceUrls, [])
  for (const invalid of [
    { ...valid, title: "  " },
    { ...valid, end: valid.start },
    { ...valid, start: "2026-10-27T09:00:00" },
    { ...valid, allDay: true, start: "2026-02-30", end: "2026-03-02" },
    { ...valid, allDay: true, start: "2026-10-27", end: "2026-10-27" },
  ])
    assert.equal(CalendarEventSchema.safeParse(invalid).success, false)
})

test("종일 일정은 포함하는 마지막 날짜와 내부 미포함 종료 날짜를 왕복한다", () => {
  const event: CalendarEvent = {
    ...sample(),
    allDay: true,
    start: "2026-10-27",
    end: "2026-10-30",
  }
  const draft = eventDraft(event)
  assert.equal(draft.startDate, "2026-10-27")
  assert.equal(draft.endDate, "2026-10-29")
  assert.deepEqual(eventFromDraft(draft, event), event)
  assert.equal(
    eventFromDraft({ ...draft, endDate: draft.startDate }).end,
    "2026-10-28"
  )
  assert.equal(shiftDate("2028-02-28", 1), "2028-02-29")
  assert.throws(() => shiftDate("2026-02-30", 1), /날짜/)
})

test("시간 일정의 표시/편집 왕복에서 오프셋과 초 단위를 잃지 않는다", () => {
  const event: CalendarEvent = {
    ...sample(),
    start: "2026-10-27T09:00:32+09:00",
    end: "2026-10-27T10:00:32+09:00",
  }
  assert.deepEqual(eventFromDraft(eventDraft(event), event), event)
  assert.throws(
    () => eventFromDraft({ ...eventDraft(event), endDate: "2026-10-20" }),
    /종료/
  )
})

test("서머타임의 없는 시간은 거부하고 날짜 이동은 24시간 가정에 의존하지 않는다", () => {
  const previous = process.env.TZ
  process.env.TZ = "America/New_York"
  try {
    const draft = eventDraft({
      ...sample(),
      allDay: true,
      start: "2026-03-08",
      end: "2026-03-09",
    })
    assert.throws(
      () =>
        eventFromDraft({
          ...draft,
          allDay: false,
          startTime: "02:30",
          endTime: "03:30",
        }),
      /날짜와 시간/
    )
    assert.equal(shiftDate("2026-03-08", 1), "2026-03-09")
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
})

test("일정 생성·수정·삭제는 원자적으로 저장하고 재실행 후 유지된다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "my-hub-calendar-test-"))
  try {
    const repository = new CalendarRepository(dir)
    let snapshot = await repository.load()
    assert.deepEqual(snapshot.events, [])
    const event = sample()
    snapshot = await repository.save({
      event,
      expectedRevision: snapshot.revision,
    })
    assert.equal(
      (await new CalendarRepository(dir).load()).events[0].title,
      "회의"
    )
    snapshot = await repository.save({
      event: { ...event, title: "수정한 일정" },
      expectedRevision: snapshot.revision,
    })
    assert.equal(snapshot.events.length, 1)
    assert.equal(snapshot.events[0].title, "수정한 일정")
    snapshot = await repository.remove({
      id: event.id,
      expectedRevision: snapshot.revision,
    })
    assert.deepEqual((await new CalendarRepository(dir).load()).events, [])
    assert.deepEqual(await readdir(dir), ["calendar.json"])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("동시에 저장하면 오래된 리비전은 거부하고 다른 일정을 덮어쓰지 않는다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "my-hub-calendar-concurrency-"))
  try {
    const repository = new CalendarRepository(dir)
    const initial = await repository.load()
    const results = await Promise.allSettled([
      repository.save({ event: sample(), expectedRevision: initial.revision }),
      repository.save({ event: sample(), expectedRevision: initial.revision }),
    ])
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1
    )
    assert.equal((await repository.load()).events.length, 1)
    const current = await repository.load()
    await writeFile(current.path, JSON.stringify({ version: 1, events: [] }))
    await assert.rejects(
      () =>
        repository.remove({
          id: current.events[0].id,
          expectedRevision: current.revision,
        }),
      /다른 곳에서/
    )
    assert.deepEqual((await repository.load()).events, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("잘못된 입력이나 손상된 일정 파일은 원본을 변경하지 않는다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "my-hub-calendar-corrupt-"))
  try {
    const repository = new CalendarRepository(dir)
    const path = join(dir, "calendar.json")
    for (const raw of [
      "{broken",
      JSON.stringify({ version: 2, events: [] }),
      JSON.stringify({
        version: 1,
        events: [sample(), { ...sample(), start: "invalid" }],
      }),
    ]) {
      await writeFile(path, raw)
      await assert.rejects(() => repository.load(), /원본 파일을 보존/)
      await assert.rejects(() =>
        repository.save({ event: sample(), expectedRevision: "missing" })
      )
      assert.equal(await readFile(path, "utf8"), raw)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("IPC는 다른 발신자를 거부하고 유효한 일정만 앱 경로에 저장한다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "my-hub-calendar-ipc-"))
  app.paths.userData = dir
  const window = new BrowserWindow()
  registerCalendar(window as never)
  try {
    await assert.rejects(
      async () =>
        handlers.get("calendar:load")!({ sender: {}, senderFrame: {} }),
      /허용되지 않은/
    )
    const initial = (await handlers.get("calendar:load")!(
      window.event()
    )) as Awaited<ReturnType<CalendarAPI["load"]>>
    await assert.rejects(
      async () =>
        handlers.get("calendar:save")!(window.event(), {
          event: { ...sample(), title: "" },
          expectedRevision: initial.revision,
        }),
      /제목/
    )
    await handlers.get("calendar:save")!(window.event(), {
      event: { ...sample(), referenceUrls: [join(dir, "meeting.pdf")] },
      expectedRevision: initial.revision,
    })
    const file = join(dir, "meeting.pdf")
    await writeFile(file, "test file")
    dialog.openResult = { canceled: false, filePaths: [file] }
    assert.equal(
      await handlers.get("calendar:choose-file")!(window.event()),
      file
    )
    await handlers.get("calendar:open-links")!(
      window.event(),
      (await new CalendarRepository(dir).load()).events[0].id
    )
    assert.ok(shell.openedPaths.includes(file))
    dialog.openResult = { canceled: true, filePaths: [] }
    assert.equal((await new CalendarRepository(dir).load()).events.length, 1)
  } finally {
    window.close()
    assert.equal(handlers.size, 0)
    await rm(dir, { recursive: true, force: true })
  }
})

test("저장 오류 시 화면 상태를 되돌릴 수 있도록 기존 일정을 유지한다", async () => {
  const event = sample()
  const store = new CalendarStore({
    load: async () => ({
      events: [event],
      revision: "v1",
      path: "calendar.json",
    }),
    save: async () => {
      throw new Error("쓰기 실패")
    },
    remove: async () => {
      throw new Error("쓰기 실패")
    },
    openLinks: async () => {},
    onReminder: () => () => {},
  })
  await store.initialize()
  assert.equal(
    await store.save({ ...event, title: "실패한 수정" }, "v1"),
    false
  )
  assert.equal(store.getSnapshot().snapshot!.events[0].title, "회의")
  assert.equal(store.getSnapshot().busy, false)
  assert.equal(store.getSnapshot().error, "쓰기 실패")
  assert.equal(await store.remove(event.id, "v1"), false)
  assert.equal(store.getSnapshot().snapshot!.events.length, 1)
})

test("이전 preload와 초기 로드 실패는 명확한 복구 안내를 제공한다", async () => {
  const store = new CalendarStore(undefined)
  await store.initialize()
  assert.match(store.getSnapshot().error, /pnpm dev/)
  assert.equal(store.getSnapshot().snapshot, null)
})
