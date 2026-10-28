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
