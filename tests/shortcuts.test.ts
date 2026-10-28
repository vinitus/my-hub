import { test } from "node:test"
import assert from "node:assert/strict"
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  ShortcutSchema,
  websiteUrl,
  type Shortcut,
  type ShortcutsAPI,
} from "../src/shared/shortcuts"
import {
  validateShortcut,
  inspectShortcutDrop,
} from "../src/main/shortcut-target"
import { readShortcutDrop } from "../src/renderer/src/features/shortcuts/lib/drop-input"
import { ShortcutIcons } from "../src/main/shortcut-icons"
import { ShortcutRepository } from "../src/main/shortcut-repository"
import { registerShortcuts } from "../src/main/shortcuts"
import { ShortcutStore } from "../src/renderer/src/features/shortcuts/model/shortcut-store"
import { app, BrowserWindow, dialog, handlers, shell } from "./fakes/electron"

const website = (): Shortcut => ({
  id: crypto.randomUUID(),
  name: "문서",
  kind: "website",
  target: "https://example.com/docs",
})
async function directory() {
  return mkdtemp(join(tmpdir(), "my-hub-shortcuts-test-"))
}

test("웹사이트는 http/https만 허용하고 명령·파일·인증정보 주소는 거부한다", () => {
  assert.equal(websiteUrl("https://example.com"), "https://example.com/")
  for (const target of [
    "javascript:alert(1)",
    "file:///C:/Windows/test.exe",
    "mailto:a@b.com",
    "ms-settings:",
    "https://user:password@example.com",
    "example.com",
    "https://example.com/" + "x".repeat(2081),
  ]) {
    assert.equal(
      ShortcutSchema.safeParse({ ...website(), target }).success,
      false,
      target
    )
  }
  assert.equal(
    ShortcutSchema.safeParse({ ...website(), name: " " }).success,
    false
  )
  assert.equal(
    ShortcutSchema.safeParse({ ...website(), target: "https://example.com/\n" })
      .success,
    true
  ) // 앞뒤 공백은 정규화
  assert.equal(
    ShortcutSchema.safeParse({
      ...website(),
      target: "https://example.com/a\nb",
    }).success,
    false
  )
})

test("프로그램·폴더를 구분하고 상대 경로와 실행 인수가 섞인 문자열을 거부한다", async () => {
  const dir = await directory()
  try {
    const executable = join(dir, "공백 있는 앱.exe")
    const link = join(dir, "앱 바로가기.lnk")
    const text = join(dir, "메모.txt")
    await Promise.all(
      [executable, link, text].map((path) => writeFile(path, "test"))
    )
    const item = website()
    assert.equal(
      (await validateShortcut({ ...item, kind: "program", target: executable }))
        .target,
      executable
    )
    assert.equal(
      (await validateShortcut({ ...item, kind: "program", target: link }))
        .target,
      link
    )
    assert.equal(
      (await validateShortcut({ ...item, kind: "folder", target: dir })).target,
      dir
    )
    await assert.rejects(
      validateShortcut({ ...item, kind: "folder", target: executable }),
      /폴더/
    )
    await assert.rejects(
      validateShortcut({ ...item, kind: "program", target: text }),
      /실행 파일/
    )
    await assert.rejects(
      validateShortcut({ ...item, kind: "program", target: "app.exe" }),
      /절대 경로/
    )
    await assert.rejects(
      validateShortcut({
        ...item,
        kind: "program",
        target: `${executable} --flag`,
      }),
      /대상을 찾을 수 없습니다/
    )
    await assert.rejects(
      validateShortcut({ ...item, kind: "program", target: dir }),
      /실행 파일/
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("바로가기 CRUD와 재실행 복원, 수정 후 순서 유지와 임시 파일 정리를 검증한다", async () => {
  const dir = await directory()
  try {
    const repository = new ShortcutRepository(dir)
    let snapshot = await repository.load()
    assert.equal(snapshot.revision, "missing")
    const first = website(),
      second = website()
    snapshot = await repository.save({
      shortcut: first,
      expectedRevision: snapshot.revision,
    })
    snapshot = await repository.save({
      shortcut: second,
      expectedRevision: snapshot.revision,
    })
    snapshot = await repository.save({
      shortcut: { ...first, name: "이름 변경" },
      expectedRevision: snapshot.revision,
    })
    assert.deepEqual(
      snapshot.items.map((item) => item.id),
      [first.id, second.id]
    )
    assert.deepEqual(await new ShortcutRepository(dir).load(), snapshot)
    snapshot = await repository.remove({
      id: first.id,
      expectedRevision: snapshot.revision,
    })
    assert.deepEqual(snapshot.items, [second])
    assert.deepEqual(await readdir(dir), ["shortcuts.json"])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("동시 저장과 외부 변경 충돌은 기존 목록을 덮어쓰거나 다른 대상을 실행하지 않는다", async () => {
  const dir = await directory()
  try {
    const repository = new ShortcutRepository(dir)
    const item = website()
    const results = await Promise.allSettled([
      repository.save({ shortcut: item, expectedRevision: "missing" }),
      repository.save({ shortcut: website(), expectedRevision: "missing" }),
    ])
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1
    )
    const snapshot = await repository.load()
    await writeFile(
      snapshot.path,
      JSON.stringify({
        version: 1,
        items: [{ ...item, target: "https://changed.example.com" }],
      })
    )
    const raw = await readFile(snapshot.path, "utf8")
    await assert.rejects(
      repository.remove({ id: item.id, expectedRevision: snapshot.revision }),
      /변경/
    )
    await assert.rejects(
      repository.resolve({ id: item.id, expectedRevision: snapshot.revision }),
      /변경/
    )
    assert.equal(await readFile(snapshot.path, "utf8"), raw)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("손상 파일·중복 ID·지원하지 않는 버전·잘못된 UTF-8을 빈 목록으로 덮어쓰지 않는다", async () => {
  const dir = await directory()
  try {
    const repository = new ShortcutRepository(dir)
    const item = website()
    const path = join(dir, "shortcuts.json")
    const cases = [
      Buffer.from("{broken"),
      Buffer.from(JSON.stringify({ version: 2, items: [] })),
      Buffer.from(JSON.stringify({ version: 1, items: [item, item] })),
      Buffer.from([0xff, 0xfe]),
    ]
    for (const bytes of cases) {
      await writeFile(path, bytes)
      await assert.rejects(repository.load(), /원본 파일을 보존/)
      await assert.rejects(
        repository.save({ shortcut: website(), expectedRevision: "missing" }),
        /원본 파일을 보존/
      )
      assert.deepEqual(await readFile(path), bytes)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("이동·삭제된 실행 대상은 저장된 ID가 있어도 실행 전에 감지한다", async () => {
  const dir = await directory()
  try {
    const target = join(dir, "작업")
    await mkdir(target)
    const repository = new ShortcutRepository(dir)
    const item = { ...website(), kind: "folder" as const, target }
    const snapshot = await repository.save({
      shortcut: item,
      expectedRevision: "missing",
    })
    await rm(target, { recursive: true })
    await assert.rejects(
      repository.resolve({ id: item.id, expectedRevision: snapshot.revision }),
      /대상을 찾을 수 없습니다/
    )
    await assert.rejects(
      repository.resolve({
        id: crypto.randomUUID(),
        expectedRevision: snapshot.revision,
      }),
      /등록되지 않은/
    )
    assert.equal((await repository.load()).items.length, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("IPC는 발신자를 확인하고 등록된 항목만 OS에 전달하며 오류를 알린다", async () => {
  const dir = await directory()
  const previous = app.paths.userData
  app.paths.userData = dir
  const window = new BrowserWindow()
  shell.openedPaths = []
  shell.openedUrls = []
  shell.pathError = ""
  try {
    registerShortcuts(window as never)
    const call = (channel: string, request?: unknown) =>
      handlers.get(`shortcuts:${channel}`)!(
        window.event(),
        request
      ) as Promise<unknown>
    for (const name of [
      "load",
      "save",
      "remove",
      "choose",
      "launch",
      "inspect-drop",
      "icon",
    ]) {
      const handler = handlers.get(`shortcuts:${name}`)!
      assert.throws(() => handler({ sender: {} }, {}), /허용되지 않은/)
      assert.throws(
        () => handler({ sender: window.webContents, senderFrame: {} }, {}),
        /허용되지 않은/
      )
    }
    const item = website()
    const snapshot = (await call("save", {
      shortcut: item,
      expectedRevision: "missing",
    })) as Awaited<ReturnType<ShortcutsAPI["load"]>>
    await call("launch", { id: item.id, expectedRevision: snapshot.revision })
    assert.deepEqual(shell.openedUrls, [item.target])
    await assert.rejects(
      call("launch", {
        id: crypto.randomUUID(),
        expectedRevision: snapshot.revision,
      }),
      /등록되지 않은/
    )
    await assert.rejects(
      call("launch", {
        id: item.id,
        target: "file:///evil",
        expectedRevision: snapshot.revision,
      }),
      /실행할 바로가기/
    )
    const folder = { ...website(), kind: "folder" as const, target: dir }
    const saved = (await call("save", {
      shortcut: folder,
      expectedRevision: snapshot.revision,
    })) as typeof snapshot
    shell.pathError = "운영체제 오류"
    await assert.rejects(
      call("launch", { id: folder.id, expectedRevision: saved.revision }),
      /운영체제 오류/
    )
    shell.pathError = ""
    await call("launch", { id: folder.id, expectedRevision: saved.revision })
    assert.equal(shell.openedPaths.at(-1), dir)
    shell.externalError = new Error("브라우저 없음")
    await assert.rejects(
      call("launch", { id: item.id, expectedRevision: saved.revision }),
      /브라우저 없음/
    )
    assert.equal(shell.openedUrls.length, 2)
  } finally {
    window.close()
    app.paths.userData = previous
    shell.pathError = ""
    shell.externalError = null
    await rm(dir, { recursive: true, force: true })
  }
  assert.equal(handlers.has("shortcuts:launch"), false)
})

test("파일·폴더 선택과 취소는 저장·실행 없이 결과만 반환한다", async () => {
  const dir = await directory()
  const previous = app.paths.userData
  app.paths.userData = dir
  const window = new BrowserWindow()
  try {
    registerShortcuts(window as never)
    const choose = handlers.get("shortcuts:choose")!
    dialog.openResult = { canceled: true, filePaths: [] }
    assert.equal(await choose(window.event(), "program"), null)
    assert.deepEqual(dialog.openProperties, ["openFile", "noResolveAliases"])
    dialog.openResult = { canceled: false, filePaths: [dir] }
    assert.equal(
      ((await choose(window.event(), "folder")) as { target: string }).target,
      dir
    )
    assert.deepEqual(dialog.openProperties, ["openDirectory"])
    await assert.rejects(
      async () => choose(window.event(), "website"),
      /주소를 입력/
    )
    assert.deepEqual(await readdir(dir), [])
  } finally {
    window.close()
    app.paths.userData = previous
    dialog.openResult = { canceled: true, filePaths: [] }
    await rm(dir, { recursive: true, force: true })
  }
})

test("화면 저장·실행 실패 시 목록을 유지하고 중복 실행을 차단한다", async () => {
  const item = website()
  const snapshot = { items: [item], revision: "r1", path: "shortcuts.json" }
  let release!: () => void
  let count = 0
  const store = new ShortcutStore({
    icon: async () => null,
    inspectDrop: async () => item,
    load: async () => snapshot,
    choose: async () => null,
    save: async () => {
      throw new Error("외부 변경")
    },
    remove: async () => {
      throw new Error("삭제 실패")
    },
    launch: async () => {
      count++
      await new Promise<void>((resolve) => {
        release = resolve
      })
      throw new Error("실행 실패")
    },
  })
  await store.initialize()
  assert.equal(await store.save(item, "r1"), false)
  assert.equal(await store.remove(item.id, "r1"), false)
  const pending = store.launch(item)
  assert.equal(await store.launch(item), false)
  release()
  assert.equal(await pending, false)
  assert.equal(count, 1)
  assert.equal(store.getSnapshot().snapshot, snapshot)
  assert.equal(store.getSnapshot().busy, false)
  assert.match(store.getSnapshot().error, /실행 실패/)
  assert.deepEqual(store.getSnapshot().recentIds, [])
})

test("최근 바로가기는 성공한 실행만 중복 없이 최근 다섯 개를 공유한다", async () => {
  const items = Array.from({ length: 6 }, website)
  const snapshot = { items, revision: "r1", path: "shortcuts.json" }
  const store = new ShortcutStore({
    icon: async () => null,
    inspectDrop: async () => items[0],
    load: async () => snapshot,
    choose: async () => null,
    save: async () => snapshot,
    remove: async () => snapshot,
    launch: async () => {},
  })
  await store.initialize()
  for (const item of items) assert.equal(await store.launch(item), true)
  assert.deepEqual(
    store.getSnapshot().recentIds,
    items
      .slice(1)
      .reverse()
      .map((item) => item.id)
  )
  await store.launch(items[3])
  assert.deepEqual(
    store.getSnapshot().recentIds,
    [items[3], items[5], items[4], items[2], items[1]].map((item) => item.id)
  )
})

test("이전 preload에서는 재시작을 안내한다", async () => {
  const store = new ShortcutStore(undefined)
  await store.initialize()
  assert.equal(store.getSnapshot().snapshot, null)
  assert.match(store.getSnapshot().error, /pnpm dev/)
  assert.equal(store.getSnapshot().loading, false)
})

test("OS 아이콘은 등록된 대상만 읽고 캐시하며 실패하면 기본 아이콘을 사용한다", async () => {
  const dir = await directory()
  const previous = app.paths.userData
  app.paths.userData = dir
  app.iconPaths = []
  app.iconEmpty = false
  app.iconError = false
  const window = new BrowserWindow()
  try {
    registerShortcuts(window as never)
    const item = { ...website(), kind: "folder" as const, target: dir }
    const snapshot = (await handlers.get("shortcuts:save")!(window.event(), {
      shortcut: item,
      expectedRevision: "missing",
    })) as Awaited<ReturnType<ShortcutsAPI["load"]>>
    const icon = handlers.get("shortcuts:icon")!
    const request = { id: item.id, expectedRevision: snapshot.revision }
    assert.match(
      (await icon(window.event(), request)) as string,
      /^data:image\/png/
    )
    await icon(window.event(), request)
    assert.deepEqual(app.iconPaths, [dir])
    await assert.rejects(
      icon(window.event(), {
        id: crypto.randomUUID(),
        expectedRevision: snapshot.revision,
      }) as Promise<unknown>,
      /등록되지 않은/
    )
    await assert.rejects(
      icon(window.event(), {
        ...request,
        target: "C:/private.exe",
      }) as Promise<unknown>,
      /실행할 바로가기/
    )
    assert.equal(app.iconPaths.length, 1)
    app.iconEmpty = true
    assert.equal(await new ShortcutIcons().get(item), null)
    app.iconEmpty = false
    app.iconError = true
    assert.equal(await new ShortcutIcons().get(item), null)
  } finally {
    window.close()
    app.paths.userData = previous
    app.iconEmpty = false
    app.iconError = false
    await rm(dir, { recursive: true, force: true })
  }
})

test("웹 아이콘은 사이트의 favicon만 요청하고 중복 요청을 캐시한다", async () => {
  const previous = globalThis.fetch
  let count = 0
  globalThis.fetch = async (input, options) => {
    count++
    assert.equal(String(input), "https://example.com/favicon.ico")
    assert.equal(options?.credentials, "omit")
    assert.equal(options?.redirect, "error")
    return new Response(new Uint8Array([0, 0, 1, 0, 1, 0]))
  }
  try {
    const icons = new ShortcutIcons()
    const item = {
      ...website(),
      target: "https://example.com/private?token=secret",
    }
    const results = await Promise.all([icons.get(item), icons.get(item)])
    assert.match(results[0]!, /^data:image\/x-icon;base64,/)
    assert.equal(results[0], results[1])
    assert.equal(count, 1)
  } finally {
    globalThis.fetch = previous
  }
})

test(
  "별도 아이콘 없는 .lnk는 실제 실행 파일의 아이콘을 읽고 대상 교체 시 캐시를 갱신한다",
  { skip: process.platform !== "win32" },
  async () => {
    const dir = await directory()
    try {
      const link = join(dir, "Fork.lnk"),
        exe = join(dir, "Fork.exe")
      await Promise.all([writeFile(link, "link"), writeFile(exe, "exe")])
      shell.shortcutDetails.set(link, { target: exe, icon: "", iconIndex: 0 })
      app.iconPaths = []
      const icons = new ShortcutIcons()
      const item: Shortcut = { ...website(), kind: "program", target: link }
      assert.match((await icons.get(item))!, /^data:image\/png/)
      assert.deepEqual(app.iconPaths, [exe])
      await icons.get(item)
      assert.equal(app.iconPaths.length, 1)
      await writeFile(exe, "updated executable")
      await icons.get(item)
      assert.deepEqual(app.iconPaths, [exe, exe])
      assert.equal(item.target, link)
    } finally {
      shell.shortcutDetails.clear()
      app.iconResults.clear()
      await rm(dir, { recursive: true, force: true })
    }
  }
)

test(
  ".lnk의 환경 변수 아이콘을 우선하고 오류·빈 이미지이면 실행 대상과 원래 링크로 대체한다",
  { skip: process.platform !== "win32" },
  async () => {
    const dir = await directory()
    const previous = process.env.MY_HUB_ICON_TEST_DIR
    process.env.MY_HUB_ICON_TEST_DIR = dir
    try {
      const link = join(dir, "앱.lnk"),
        exe = join(dir, "app.exe"),
        icon = join(dir, "custom.ico")
      await Promise.all(
        [link, exe, icon].map((path) => writeFile(path, "test"))
      )
      shell.shortcutDetails.set(link, {
        target: exe,
        icon: '"%MY_HUB_ICON_TEST_DIR%/custom.ico"',
      })
      const item: Shortcut = { ...website(), kind: "program", target: link }
      app.iconPaths = []
      await new ShortcutIcons().get(item)
      assert.deepEqual(app.iconPaths, [icon])
      app.iconPaths = []
      app.iconResults.set(icon, "error")
      await new ShortcutIcons().get(item)
      assert.deepEqual(app.iconPaths, [icon, exe])
      app.iconPaths = []
      app.iconResults.set(exe, "empty")
      await new ShortcutIcons().get(item)
      assert.deepEqual(app.iconPaths, [icon, exe, link])
      app.iconPaths = []
      shell.shortcutDetails.clear()
      await new ShortcutIcons().get(item)
      assert.deepEqual(app.iconPaths, [link])
    } finally {
      if (previous === undefined) delete process.env.MY_HUB_ICON_TEST_DIR
      else process.env.MY_HUB_ICON_TEST_DIR = previous
      shell.shortcutDetails.clear()
      app.iconResults.clear()
      await rm(dir, { recursive: true, force: true })
    }
  }
)

test("아이콘이 HTML/SVG/과대 파일이거나 네트워크 실패이면 기본 아이콘으로 돌아간다", async () => {
  const previous = globalThis.fetch
  try {
    for (const body of [
      "<html>로그인</html>",
      "<svg></svg>",
      "x".repeat(256 * 1024 + 1),
    ]) {
      globalThis.fetch = async () => new Response(body)
      assert.equal(await new ShortcutIcons().get(website()), null)
    }
    globalThis.fetch = async () => {
      throw new Error("오프라인")
    }
    assert.equal(await new ShortcutIcons().get(website()), null)
    globalThis.fetch = async () => new Response(null, { status: 404 })
    assert.equal(await new ShortcutIcons().get(website()), null)
  } finally {
    globalThis.fetch = previous
  }
})

test("드롭은 실제 파일을 우선하고 브라우저 URI 목록과 일반 URL 텍스트를 해석한다", () => {
  const file = new File(["test"], "앱.exe")
  const transfer = (files: File[], uri = "", text = "") => ({
    files: files as unknown as FileList,
    getData: (type: string) => (type === "text/uri-list" ? uri : text),
  })
  assert.deepEqual(readShortcutDrop(transfer([file], "javascript:alert(1)")), {
    file,
  })
  assert.deepEqual(
    readShortcutDrop(transfer([], "# 북마크\r\nhttps://example.com/docs\r\n")),
    { url: "https://example.com/docs" }
  )
  assert.deepEqual(
    readShortcutDrop(transfer([], "", " https://example.com ")),
    { url: "https://example.com/" }
  )
  assert.throws(() => readShortcutDrop(transfer([file, file])), /한 번에 하나/)
  assert.throws(
    () =>
      readShortcutDrop(
        transfer([], "https://one.example\nhttps://two.example")
      ),
    /한 번에 하나/
  )
  assert.throws(
    () => readShortcutDrop(transfer([], "", "file:///C:/app.exe")),
    /http 또는 https/
  )
  assert.throws(() => readShortcutDrop(transfer([], "", "일반 텍스트")), /주소/)
  assert.throws(() => readShortcutDrop(transfer([])), /끌어 놓아/)
})

test("드롭 대상의 종류·이름을 판별하고 검증하지만 저장하거나 실행하지 않는다", async () => {
  const dir = await directory()
  const previous = app.paths.userData
  app.paths.userData = dir
  const window = new BrowserWindow()
  const pathCount = shell.openedPaths.length,
    urlCount = shell.openedUrls.length
  try {
    const exe = join(dir, "한글 앱.exe"),
      link = join(dir, "기존 바로가기.lnk"),
      text = join(dir, "노트.md")
    await Promise.all([exe, link, text].map((path) => writeFile(path, "test")))
    const before = await readdir(dir)
    const program = await inspectShortcutDrop({ kind: "path", target: exe })
    assert.equal(program.kind, "program")
    assert.equal(program.name, "한글 앱")
    assert.equal(
      (await inspectShortcutDrop({ kind: "path", target: link })).target,
      link
    )
    assert.equal(
      (await inspectShortcutDrop({ kind: "path", target: dir })).kind,
      "folder"
    )
    assert.equal(
      (
        await inspectShortcutDrop({
          kind: "website",
          target: "https://example.com",
        })
      ).name,
      "example.com"
    )
    await assert.rejects(
      inspectShortcutDrop({ kind: "path", target: text }),
      /실행 파일/
    )
    await assert.rejects(
      inspectShortcutDrop({ kind: "path", target: "relative.exe" }),
      /실제 파일/
    )
    await assert.rejects(
      inspectShortcutDrop({ kind: "website", target: "javascript:alert(1)" }),
      /http 또는 https/
    )
    registerShortcuts(window as never)
    const inspect = handlers.get("shortcuts:inspect-drop")!
    assert.equal(
      (
        (await inspect(window.event(), {
          kind: "path",
          target: dir,
        })) as Shortcut
      ).kind,
      "folder"
    )
    assert.deepEqual(await readdir(dir), before)
    assert.equal(shell.openedPaths.length, pathCount)
    assert.equal(shell.openedUrls.length, urlCount)
  } finally {
    window.close()
    app.paths.userData = previous
    await rm(dir, { recursive: true, force: true })
  }
})
