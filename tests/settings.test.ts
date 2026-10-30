import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  AppSettingsRepository,
  registerAppSettings,
} from "../src/main/app-settings"
import {
  DEFAULT_APP_SETTINGS,
  AppSettingsPatchSchema,
} from "../src/shared/app-settings"
import { BrowserWindow, handlers } from "./fakes/electron"
import { AppSettingsStore } from "../src/renderer/src/app/model/app-settings-store"
import { matchesLauncherShortcut } from "../src/shared/launcher-shortcut"
import {
  itemVisibility,
  modeItemKey,
  PersonalItemKeysSchema,
  mergeVisibleOrder,
} from "../src/shared/item-mode"
import {
  matchesModeShortcut,
  ModeShortcutSchema,
} from "../src/shared/mode-shortcut"

test("classification notifications invalidate stale visibility until new settings arrive", async () => {
  let release!: (value: typeof DEFAULT_APP_SETTINGS) => void
  let reads = 0
  const pending = new Promise<typeof DEFAULT_APP_SETTINGS>((resolve) => {
    release = resolve
  })
  const store = new AppSettingsStore(
    {
      read: async () => (++reads === 1 ? DEFAULT_APP_SETTINGS : pending),
      update: async () => DEFAULT_APP_SETTINGS,
    },
    { read: () => null, write: () => {}, remove: () => {} }
  )
  await store.initialize()
  assert.equal(store.getSnapshot().loaded, true)
  const refreshing = store.refresh(true)
  assert.equal(store.getSnapshot().loaded, false)
  release({
    ...DEFAULT_APP_SETTINGS,
    modeEnabled: true,
    personalItemKeys: ["note:new-private"],
  })
  await refreshing
  assert.equal(store.getSnapshot().loaded, true)
  assert.equal(
    itemVisibility(store.getSnapshot().settings, false)("note:new-private"),
    false
  )
})

test("item mode normalizes note paths and hides all five kinds without removing data", () => {
  assert.equal(
    modeItemKey("note", "C:\\Notes\\Private.md"),
    "note:c:/notes/private.md"
  )
  const keys = ["note:a", "inbox:b", "todo:c", "event:d", "shortcut:e"]
  const settings = { modeEnabled: true, personalItemKeys: keys }
  for (const key of keys) {
    assert.equal(itemVisibility(settings, false)(key), false)
    assert.equal(itemVisibility(settings, true)(key), true)
    assert.equal(
      itemVisibility({ ...settings, modeEnabled: false }, false)(key),
      true
    )
  }
  assert.equal(itemVisibility(settings, false)("note:public"), true)
  assert.deepEqual(settings.personalItemKeys, keys)
  assert.equal(
    PersonalItemKeysSchema.safeParse(["note:a", "note:a"]).success,
    false
  )
  assert.equal(PersonalItemKeysSchema.safeParse(["invalid:a"]).success, false)
  assert.deepEqual(
    mergeVisibleOrder(["a", "private", "b", "private2", "c"], ["c", "a", "b"]),
    ["c", "private", "a", "private2", "b"]
  )
})

test("personal metadata persists, starts in work mode, inherits before publication and resets on disable", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-item-mode-"))
  try {
    const repository = new AppSettingsRepository(directory)
    await repository.update({
      modeEnabled: true,
      personalItemKeys: ["inbox:source"],
    })
    assert.equal((await repository.visibility()).allows("inbox:source"), false)
    await repository.setPersonalMode(true)
    assert.equal((await repository.visibility()).allows("inbox:source"), true)
    await Promise.all([
      repository.inheritPersonal("inbox:source", "todo:target"),
      repository.inheritPersonal("inbox:source", "note:c:/notes/a.md"),
    ])
    await repository.preserveNotePrivacy("C:\\Notes\\a.md", "C:\\Notes\\b.md")
    const restarted = new AppSettingsRepository(directory)
    for (const key of [
      "inbox:source",
      "todo:target",
      "note:c:/notes/a.md",
      "note:c:/notes/b.md",
    ])
      assert.equal((await restarted.visibility()).allows(key), false)
    await repository.update({ modeEnabled: false })
    await repository.update({ modeEnabled: true })
    assert.equal((await repository.visibility()).allows("inbox:source"), false)
    const original = await readFile(
      join(directory, "app-settings.json"),
      "utf8"
    )
    await assert.rejects(repository.inheritPersonal("bad", "todo:target"))
    assert.equal(
      await readFile(join(directory, "app-settings.json"), "utf8"),
      original
    )
    const window = new BrowserWindow()
    registerAppSettings(window as never, repository)
    await assert.rejects(async () =>
      handlers.get("settings:personal-mode")!(
        { sender: {}, senderFrame: {} },
        true
      )
    )
    await assert.rejects(async () =>
      handlers.get("settings:personal-mode")!(window.event(), "true")
    )
    assert.equal(
      await handlers.get("settings:personal-mode")!(window.event(), true),
      true
    )
    window.close()
    assert.equal(handlers.has("settings:inherit-personal"), false)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("mode shortcut excludes composition, repeats, handled events and other app shortcuts", () => {
  const event = {
    key: "m",
    code: "KeyM",
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    metaKey: false,
    isComposing: false,
    repeat: false,
    defaultPrevented: false,
  }
  assert.equal(matchesModeShortcut(event, "ctrl+shift+m"), true)
  assert.equal(
    matchesModeShortcut({ ...event, key: "ㅡ" }, "ctrl+shift+m"),
    true
  )
  for (const patch of [
    { isComposing: true },
    { keyCode: 229 },
    { repeat: true },
    { defaultPrevented: true },
    { metaKey: true },
    { ctrlKey: false },
    { shiftKey: false },
    { altKey: true },
    { key: "k", code: "KeyK" },
    { key: "s", code: "KeyS" },
  ])
    assert.equal(
      matchesModeShortcut({ ...event, ...patch }, "ctrl+shift+m"),
      false
    )
  assert.equal(
    matchesModeShortcut({ ...event, altKey: true }, "ctrl+alt+shift+m"),
    true
  )
  for (const reserved of [
    "ctrl+k",
    "ctrl+shift+k",
    "ctrl+o",
    "ctrl+s",
    "ctrl+h",
  ])
    assert.equal(ModeShortcutSchema.safeParse(reserved).success, false)
})

test("mode shortcut migrates existing settings and persists without modifying other preferences", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-mode-shortcut-"))
  try {
    const legacy: Record<string, unknown> = { ...DEFAULT_APP_SETTINGS }
    delete legacy.modeShortcut
    await writeFile(
      join(directory, "app-settings.json"),
      JSON.stringify(legacy)
    )
    const repository = new AppSettingsRepository(directory)
    assert.equal((await repository.read()).modeShortcut, "ctrl+shift+m")
    const updated = await repository.update({
      modeShortcut: "ctrl+alt+shift+m",
    })
    assert.deepEqual(updated, {
      ...DEFAULT_APP_SETTINGS,
      modeShortcut: "ctrl+alt+shift+m",
    })
    assert.equal(
      (await new AppSettingsRepository(directory).read()).modeShortcut,
      "ctrl+alt+shift+m"
    )
    await assert.rejects(() =>
      repository.update({ modeShortcut: "ctrl+k" as never })
    )
    assert.equal((await repository.read()).modeShortcut, "ctrl+alt+shift+m")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("launcher shortcuts exclude AI, composition and extra modifiers", () => {
  const event = {
    key: "k",
    code: "KeyK",
    ctrlKey: true,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    isComposing: false,
  }
  assert.equal(matchesLauncherShortcut(event, "ctrl+k"), true)
  assert.equal(
    matchesLauncherShortcut({ ...event, shiftKey: true }, "ctrl+k"),
    false
  )
  assert.equal(
    matchesLauncherShortcut({ ...event, shiftKey: true }, "ctrl+alt+k"),
    false
  )
  assert.equal(
    matchesLauncherShortcut({ ...event, altKey: true }, "ctrl+alt+k"),
    true
  )
  assert.equal(matchesLauncherShortcut(event, "ctrl+alt+k"), false)
  assert.equal(
    matchesLauncherShortcut(
      { ...event, key: " ", code: "Space", shiftKey: true },
      "ctrl+shift+space"
    ),
    true
  )
  assert.equal(
    matchesLauncherShortcut({ ...event, isComposing: true }, "ctrl+k"),
    false
  )
  assert.equal(
    matchesLauncherShortcut({ ...event, metaKey: true }, "ctrl+k"),
    false
  )
})

test("launcher shortcut migrates old settings, persists and rejects reserved AI shortcut", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-launcher-shortcut-"))
  try {
    const legacy: Record<string, unknown> = { ...DEFAULT_APP_SETTINGS }
    delete legacy.launcherShortcut
    await writeFile(
      join(directory, "app-settings.json"),
      JSON.stringify(legacy)
    )
    const repository = new AppSettingsRepository(directory)
    assert.equal((await repository.read()).launcherShortcut, "ctrl+k")
    await repository.update({ launcherShortcut: "ctrl+alt+k" })
    assert.equal(
      (await new AppSettingsRepository(directory).read()).launcherShortcut,
      "ctrl+alt+k"
    )
    assert.equal(
      AppSettingsPatchSchema.safeParse({ launcherShortcut: "ctrl+shift+k" })
        .success,
      false
    )
    assert.equal(
      (await repository.update({ theme: "dark" })).launcherShortcut,
      "ctrl+alt+k"
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

function memoryTheme(initial: string | null = null) {
  let value = initial
  return {
    read: () => value,
    write: (theme: string) => {
      value = theme
    },
    remove: () => {
      value = null
    },
  }
}

test("설정 초기 조회와 이전은 한 번만 실행하며 대기 중 사용자 변경을 덮지 않는다", async () => {
  let resolveRead!: (value: typeof DEFAULT_APP_SETTINGS) => void
  let reads = 0
  const changes: unknown[] = []
  let persisted = { ...DEFAULT_APP_SETTINGS }
  const theme = memoryTheme("dark")
  const store = new AppSettingsStore(
    {
      read: () => {
        reads++
        return new Promise((resolve) => {
          resolveRead = resolve
        })
      },
      update: async (patch) => {
        changes.push(patch)
        persisted = { ...persisted, ...patch }
        return persisted
      },
    },
    theme
  )
  const first = store.initialize()
  assert.equal(store.initialize(), first)
  const update = store.update({ leftSidebarWidth: 300, theme: "light" })
  await Promise.resolve()
  resolveRead({ ...DEFAULT_APP_SETTINGS })
  assert.equal(await update, true)
  assert.equal(reads, 1)
  assert.deepEqual(changes, [
    { theme: "dark" },
    { leftSidebarWidth: 300, theme: "light" },
  ])
  assert.equal(store.getSnapshot().settings.theme, "light")
  assert.equal(store.getSnapshot().settings.leftSidebarWidth, 300)
  assert.equal(theme.read(), null)
  assert.equal(store.getSnapshot().ready, true)
})

test("실패한 설정 저장은 직전 값을 유지하고 다음 변경을 순서대로 적용한다", async () => {
  let persisted = { ...DEFAULT_APP_SETTINGS }
  let fail = true
  const store = new AppSettingsStore(
    {
      read: async () => persisted,
      update: async (patch) => {
        if (fail) throw new Error("저장 실패")
        persisted = { ...persisted, ...patch }
        return persisted
      },
    },
    memoryTheme()
  )
  assert.equal(await store.update({ theme: "dark" }), false)
  assert.equal(store.getSnapshot().settings.theme, DEFAULT_APP_SETTINGS.theme)
  assert.match(store.getSnapshot().error, /저장 실패/)
  assert.equal(
    store.getSnapshot().loaded,
    true,
    "failed updates keep the last loaded visibility settings"
  )
  fail = false
  assert.deepEqual(
    await Promise.all([
      store.update({ leftSidebarWidth: 310 }),
      store.update({ rightPanelWidth: 310 }),
    ]),
    [true, true]
  )
  assert.equal(store.getSnapshot().settings.leftSidebarWidth, 310)
  assert.equal(store.getSnapshot().settings.rightPanelWidth, 310)
  assert.equal(store.getSnapshot().error, "")
})

test("테마 이전이 실패하면 이전 값을 보존하고 브라우저 설정은 최신 상태에 병합한다", async () => {
  const legacy = memoryTheme("dark")
  let fail = true
  const store = new AppSettingsStore(
    {
      read: async () => ({ ...DEFAULT_APP_SETTINGS, leftSidebarWidth: 320 }),
      update: async (patch) => {
        if (fail) throw new Error("이전 실패")
        return { ...DEFAULT_APP_SETTINGS, ...patch }
      },
    },
    legacy
  )
  await store.initialize()
  assert.equal(legacy.read(), "dark")
  assert.match(store.getSnapshot().error, /이전 실패/)
  assert.equal(store.getSnapshot().settings.leftSidebarWidth, 320)
  fail = false
  assert.equal(await store.update({ theme: "light" }), true)
  assert.equal(legacy.read(), null)
  const preview = new AppSettingsStore(undefined, memoryTheme())
  await Promise.all([
    preview.update({ sidebarOpen: false }),
    preview.update({ rightPanelOpen: false }),
  ])
  assert.equal(preview.getSnapshot().settings.sidebarOpen, false)
  assert.equal(preview.getSnapshot().settings.rightPanelOpen, false)
})

test("이전 브라우저 저장소에 접근할 수 없어도 파일 설정을 읽는다", async () => {
  const store = new AppSettingsStore(
    {
      read: async () => ({
        ...DEFAULT_APP_SETTINGS,
        theme: "dark",
        leftSidebarWidth: 320,
      }),
      update: async () => {
        throw new Error("호출되면 안 됨")
      },
    },
    {
      read: () => {
        throw new Error("Storage blocked")
      },
      write: () => {},
      remove: () => {},
    }
  )
  await store.initialize()
  assert.equal(store.getSnapshot().settings.theme, "dark")
  assert.equal(store.getSnapshot().settings.leftSidebarWidth, 320)
  assert.equal(store.getSnapshot().error, "")
})

test("앱 설정은 기본값을 제공하고 변경을 병합해 파일에 저장한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-settings-"))
  try {
    const repository = new AppSettingsRepository(directory)
    assert.deepEqual(await repository.read(), DEFAULT_APP_SETTINGS)
    const next = await repository.update({
      theme: "dark",
      leftSidebarWidth: 300,
    })
    assert.deepEqual(next, {
      ...DEFAULT_APP_SETTINGS,
      theme: "dark",
      leftSidebarWidth: 300,
    })
    assert.deepEqual(
      JSON.parse(await readFile(join(directory, "app-settings.json"), "utf8")),
      next
    )
    assert.deepEqual(await new AppSettingsRepository(directory).read(), next)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("잘못된 설정 변경은 거부하고 손상된 설정 원본을 보존한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-settings-"))
  try {
    const repository = new AppSettingsRepository(directory)
    await assert.rejects(repository.update({ leftSidebarWidth: 100 }))
    await assert.rejects(repository.update({ leftSidebarWidth: 321 }))
    const path = join(directory, "app-settings.json")
    await writeFile(path, "broken")
    await assert.rejects(
      repository.update({ theme: "dark" }),
      /원본 파일을 보존/
    )
    assert.equal(await readFile(path, "utf8"), "broken")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("이전 좌측 너비는 320px로 보정하고 다른 설정을 보존한 채 다음 저장에 반영한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-settings-width-"))
  try {
    const path = join(directory, "app-settings.json")
    const previous = {
      ...DEFAULT_APP_SETTINGS,
      theme: "dark",
      leftSidebarWidth: 640,
      rightPanelWidth: 350,
      sidebarOpen: false,
    }
    await writeFile(path, JSON.stringify(previous))
    const repository = new AppSettingsRepository(directory)
    assert.deepEqual(await repository.read(), {
      ...previous,
      leftSidebarWidth: 320,
    })
    const next = await repository.update({ rightPanelOpen: false })
    assert.deepEqual(next, {
      ...previous,
      leftSidebarWidth: 320,
      rightPanelOpen: false,
    })
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), next)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("이전 설정의 메뉴 애니메이션은 켜기로 읽고 사용자 선택은 재시작 후에도 보존한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-menu-motion-"))
  try {
    const path = join(directory, "app-settings.json")
    const legacy: Record<string, unknown> = {
      ...DEFAULT_APP_SETTINGS,
      theme: "dark",
      rightPanelWidth: 350,
    }
    delete legacy.shortcutMenuMotion
    delete legacy.shortcutMenuItems
    await writeFile(path, JSON.stringify(legacy))
    const repository = new AppSettingsRepository(directory)
    assert.deepEqual(await repository.read(), {
      ...legacy,
      shortcutMenuMotion: "on",
      shortcutMenuItems: DEFAULT_APP_SETTINGS.shortcutMenuItems,
    })
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), legacy)
    await repository.update({ shortcutMenuMotion: "off" })
    const restored = new AppSettingsRepository(directory)
    assert.equal((await restored.read()).shortcutMenuMotion, "off")
    assert.equal(
      (await restored.update({ theme: "light" })).shortcutMenuMotion,
      "off"
    )
    assert.equal(
      (await restored.update({ shortcutMenuMotion: "system" }))
        .shortcutMenuMotion,
      "system"
    )
    assert.equal((await restored.read()).rightPanelWidth, 350)
    assert.deepEqual(AppSettingsPatchSchema.parse({ theme: "dark" }), {
      theme: "dark",
    })
    assert.equal(
      AppSettingsPatchSchema.safeParse({ shortcutMenuMotion: "invalid" })
        .success,
      false
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("커서 메뉴는 중복 없이 최대 8개를 저장하고 등록된 바로가기 ID를 복원한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-menu-items-"))
  try {
    const repository = new AppSettingsRepository(directory)
    const items = [
      ...DEFAULT_APP_SETTINGS.shortcutMenuItems,
      { kind: "action" as const, action: "home" as const },
      { kind: "action" as const, action: "notes" as const },
      { kind: "shortcut" as const, id: "11111111-1111-4111-8111-111111111111" },
    ]
    await repository.update({ shortcutMenuItems: items })
    assert.deepEqual(
      (await new AppSettingsRepository(directory).read()).shortcutMenuItems,
      items
    )
    assert.equal(
      AppSettingsPatchSchema.safeParse({
        shortcutMenuItems: [...items, { kind: "action", action: "calendar" }],
      }).success,
      false
    )
    assert.equal(
      AppSettingsPatchSchema.safeParse({
        shortcutMenuItems: [items[0], items[0]],
      }).success,
      false
    )
    assert.equal(
      AppSettingsPatchSchema.safeParse({
        shortcutMenuItems: [{ kind: "shortcut", id: "C:\\program.exe" }],
      }).success,
      false
    )
    assert.deepEqual(
      (await repository.update({ shortcutMenuItems: [] })).shortcutMenuItems,
      []
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("앱 설정 IPC는 현재 창의 최상위 프레임만 허용하고 종료 시 해제한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-settings-"))
  const window = new BrowserWindow()
  try {
    registerAppSettings(window as never, new AppSettingsRepository(directory))
    const read = handlers.get("settings:read")!
    assert.throws(() => read({ sender: {}, senderFrame: {} }), /허용/)
    assert.throws(
      () => read({ sender: window.webContents, senderFrame: {} }),
      /허용/
    )
    const update = handlers.get("settings:update")!
    const saved = await update(window.event(), { rightPanelOpen: false })
    assert.equal(saved.rightPanelOpen, false)
    window.emit("closed")
    assert.equal(handlers.has("settings:read"), false)
    assert.equal(handlers.has("settings:update"), false)
  } finally {
    window.emit("closed")
    await rm(directory, { recursive: true, force: true })
  }
})
