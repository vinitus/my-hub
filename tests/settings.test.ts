import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  AppSettingsRepository,
  registerAppSettings,
} from "../src/main/app-settings"
import { DEFAULT_APP_SETTINGS } from "../src/shared/app-settings"
import { BrowserWindow, handlers } from "./fakes/electron"
import { AppSettingsStore } from "../src/renderer/src/app/model/app-settings-store"

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
  const update = store.update({ leftSidebarWidth: 360, theme: "light" })
  await Promise.resolve()
  resolveRead({ ...DEFAULT_APP_SETTINGS })
  assert.equal(await update, true)
  assert.equal(reads, 1)
  assert.deepEqual(changes, [
    { theme: "dark" },
    { leftSidebarWidth: 360, theme: "light" },
  ])
  assert.equal(store.getSnapshot().settings.theme, "light")
  assert.equal(store.getSnapshot().settings.leftSidebarWidth, 360)
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
  fail = false
  assert.deepEqual(
    await Promise.all([
      store.update({ leftSidebarWidth: 340 }),
      store.update({ rightPanelWidth: 310 }),
    ]),
    [true, true]
  )
  assert.equal(store.getSnapshot().settings.leftSidebarWidth, 340)
  assert.equal(store.getSnapshot().settings.rightPanelWidth, 310)
  assert.equal(store.getSnapshot().error, "")
})

test("테마 이전이 실패하면 이전 값을 보존하고 브라우저 설정은 최신 상태에 병합한다", async () => {
  const legacy = memoryTheme("dark")
  let fail = true
  const store = new AppSettingsStore(
    {
      read: async () => ({ ...DEFAULT_APP_SETTINGS, leftSidebarWidth: 400 }),
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
  assert.equal(store.getSnapshot().settings.leftSidebarWidth, 400)
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
        leftSidebarWidth: 400,
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
  assert.equal(store.getSnapshot().settings.leftSidebarWidth, 400)
  assert.equal(store.getSnapshot().error, "")
})

test("앱 설정은 기본값을 제공하고 변경을 병합해 파일에 저장한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-settings-"))
  try {
    const repository = new AppSettingsRepository(directory)
    assert.deepEqual(await repository.read(), DEFAULT_APP_SETTINGS)
    const next = await repository.update({
      theme: "dark",
      leftSidebarWidth: 360,
    })
    assert.deepEqual(next, {
      ...DEFAULT_APP_SETTINGS,
      theme: "dark",
      leftSidebarWidth: 360,
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
