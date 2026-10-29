import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, writeFile, readFile, rm, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { InboxRepository } from "../src/main/inbox-repository"
import { registerInbox } from "../src/main/inbox"
import { InboxStore } from "../src/renderer/src/features/inbox/model/inbox-store"
import { inboxTextDraft, type InboxRendererAPI } from "../src/shared/inbox"
import { BrowserWindow, handlers, shell, dialog } from "./fakes/electron"

test("인박스는 원문·출처·시각·처리 여부를 저장하고 재시작 후 복원한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-inbox-"))
  try {
    const repository = new InboxRepository(directory)
    const path = join(directory, "검토 자료.pdf")
    await writeFile(path, "original")
    let snapshot = await repository.capture({
      expectedRevision: "missing",
      drafts: [
        inboxTextDraft("아이디어\n두 번째 줄", "회의 중"),
        inboxTextDraft("https://example.com"),
        { kind: "file", content: path, source: "파일 드롭" },
      ],
    })
    assert.equal(snapshot.items.length, 3)
    assert.equal(snapshot.items[0].source, "회의 중")
    assert.equal(snapshot.items[1].kind, "link")
    assert.equal(snapshot.items[1].content, "https://example.com/")
    assert.ok(Number.isFinite(Date.parse(snapshot.items[0].createdAt)))
    const item = snapshot.items[0]
    snapshot = await repository.process({
      id: item.id,
      processed: true,
      destination: { kind: "todo", title: "아이디어 검토" },
      expectedRevision: snapshot.revision,
    })
    assert.equal(snapshot.items[0].destination?.kind, "todo")
    assert.ok(snapshot.items[0].processedAt)
    assert.equal(snapshot.items[0].content, item.content)
    assert.deepEqual(
      (await new InboxRepository(directory).load()).items,
      snapshot.items
    )
    snapshot = await repository.process({
      id: item.id,
      processed: false,
      expectedRevision: snapshot.revision,
    })
    assert.equal(snapshot.items[0].processedAt, null)
    assert.equal(snapshot.items[0].destination, null)
    snapshot = await repository.remove({
      id: snapshot.items[2].id,
      expectedRevision: snapshot.revision,
    })
    assert.equal(snapshot.items.length, 2)
    assert.equal(await readFile(path, "utf8"), "original")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("인박스는 잘못된 배치·프로토콜·상대 경로·누락 파일·오래된 revision을 저장하지 않는다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-inbox-"))
  try {
    const repository = new InboxRepository(directory)
    for (const invalid of [
      { kind: "link", content: "javascript:alert(1)", source: "드롭" },
      { kind: "file", content: "relative.pdf", source: "드롭" },
      { kind: "file", content: join(directory, "missing.pdf"), source: "드롭" },
      { kind: "text", content: "", source: "직접 입력" },
    ]) {
      await assert.rejects(
        repository.capture({
          expectedRevision: "missing",
          drafts: [inboxTextDraft("보존할 생각"), invalid as never],
        })
      )
      assert.equal((await repository.load()).items.length, 0)
    }
    const snapshot = await repository.capture({
      expectedRevision: "missing",
      drafts: [inboxTextDraft("보존할 생각")],
    })
    await assert.rejects(
      repository.capture({
        expectedRevision: "missing",
        drafts: [inboxTextDraft("덮어쓰기")],
      }),
      /변경/
    )
    assert.deepEqual((await repository.load()).items, snapshot.items)
    assert.deepEqual(await readdir(directory), ["inbox.json"])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("인박스 동시 쓰기를 직렬 처리하고 손상 파일을 보존한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-inbox-"))
  try {
    const repository = new InboxRepository(directory)
    const results = await Promise.allSettled(
      ["첫 항목", "두 번째 항목"].map((content) =>
        repository.capture({
          expectedRevision: "missing",
          drafts: [inboxTextDraft(content)],
        })
      )
    )
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1
    )
    assert.equal((await repository.load()).items.length, 1)
    await writeFile(join(directory, "inbox.json"), "broken")
    await assert.rejects(repository.load(), /원본 파일을 보존/)
    assert.equal(
      await readFile(join(directory, "inbox.json"), "utf8"),
      "broken"
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("인박스 IPC는 등록된 창과 프레임만 허용하며 명시한 원본만 연다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-hub-inbox-"))
  const window = new BrowserWindow()
  try {
    const repository = new InboxRepository(directory)
    registerInbox(window as never, repository)
    const capture = handlers.get("inbox:capture")!
    assert.throws(() => capture({ sender: {} }, {}), /허용되지 않은/)
    assert.throws(
      () => capture({ sender: window.webContents, senderFrame: {} }, {}),
      /허용되지 않은/
    )
    const snapshot = await repository.capture({
      expectedRevision: "missing",
      drafts: [inboxTextDraft("https://example.com"), inboxTextDraft("생각")],
    })
    const before = shell.openedUrls.length
    assert.equal(shell.openedUrls.length, before)
    await handlers.get("inbox:open")!(window.event(), {
      id: snapshot.items[0].id,
      expectedRevision: snapshot.revision,
    })
    assert.equal(shell.openedUrls.at(-1), "https://example.com/")
    await assert.rejects(
      Promise.resolve(
        handlers.get("inbox:open")!(window.event(), {
          id: snapshot.items[1].id,
          expectedRevision: snapshot.revision,
        })
      ),
      /원본을 열 수 없/
    )
    dialog.openResult = { canceled: true, filePaths: [] }
    assert.equal(
      await handlers.get("inbox:choose-files")!(
        window.event(),
        snapshot.revision
      ),
      null
    )
  } finally {
    window.close()
    await rm(directory, { recursive: true, force: true })
  }
  assert.equal(handlers.has("inbox:capture"), false)
})

test("인박스 store는 실패한 쓰기와 중복 수집에서 기존 항목을 유지한다", async () => {
  let resolve!: (
    value: Awaited<ReturnType<InboxRendererAPI["capture"]>>
  ) => void
  let calls = 0
  const initial = { items: [], revision: "r1", path: "inbox.json" }
  const api: InboxRendererAPI = {
    load: async () => initial,
    capture: async () => {
      calls++
      return new Promise((done) => {
        resolve = done
      })
    },
    process: async () => {
      throw new Error("저장 실패")
    },
    remove: async () => initial,
    open: async () => {},
    chooseFiles: async () => null,
    captureFiles: async () => initial,
  }
  const store = new InboxStore(api)
  await store.initialize()
  const pending = store.captureText("빠른 생각", "직접 입력")
  assert.equal(await store.captureText("빠른 생각", "직접 입력"), false)
  assert.equal(calls, 1)
  resolve(initial)
  assert.equal(await pending, true)
  assert.equal(await store.process(crypto.randomUUID(), true), false)
  assert.equal(store.getSnapshot().error, "저장 실패")
  assert.deepEqual(store.getSnapshot().snapshot, initial)
})
