import { test } from "node:test"
import assert from "node:assert/strict"
import {
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  rm,
  mkdir,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createPlateEditor } from "platejs/react"
import { MarkdownPlugin } from "@platejs/markdown"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import { notePlugins } from "../src/renderer/src/features/notes/model/editor-plugins"
import { assertSupportedMarkdown } from "../src/renderer/src/features/notes/lib/markdown"
import {
  readMarkdown,
  writeMarkdown,
  renameMarkdown,
} from "../src/main/note-files"
import { registerNotes } from "../src/main/notes"
import { app, BrowserWindow, dialog, handlers, ipcMain } from "./fakes/electron"
import type { NoteFile, NotesAPI } from "../src/shared/notes"
import { normalizeNoteName } from "../src/shared/notes"
import { NoteLibrary } from "../src/main/note-library"
import { NoteStore } from "../src/renderer/src/features/notes/model/note-store"

function semantics(markdown: string) {
  return JSON.parse(
    JSON.stringify(
      unified().use(remarkParse).use(remarkGfm).parse(markdown),
      (key, value) => (key === "position" ? undefined : value)
    )
  )
}

test("Markdown 노드와 한글이 에디터 왕복 변환 후에도 유지된다", () => {
  const source =
    '# 한글 메모\n\n## 소제목\n\n### 작은 제목\n\n**굵게** 그리고 *기울임*, ~~취소~~, `code`\n\n- 첫 항목\n  - 하위 항목\n- 다음 항목\n\n1. 하나\n2. 둘\n\n- [ ] 할 일\n- [x] 완료\n\n> 인용문\n\n[링크](https://example.com)\n\n```ts\nconst value = "한글"\n```\n\n---\n'
  assertSupportedMarkdown(source)
  const editor = createPlateEditor({ plugins: notePlugins })
  const api = editor.getApi(MarkdownPlugin).markdown
  const value = api.deserialize(source)
  const result = api.serialize({ value })
  assert.deepEqual(semantics(result), semantics(source))
  assert.doesNotMatch(result, /<\/?(?:p|span|div)\b/)
})

test("미지원 표·이미지·HTML은 변환 전에 거부한다", () => {
  for (const source of [
    "![이미지](photo.png)",
    "<script>alert(1)</script>",
    "| A | B |\n| - | - |\n| 1 | 2 |",
  ]) {
    assert.throws(
      () => assertSupportedMarkdown(source),
      /아직 편집할 수 없습니다/
    )
  }
})

test("빈 문서와 Markdown 제어 문자도 저장 후 다시 편집할 수 있다", () => {
  const editor = createPlateEditor({ plugins: notePlugins })
  const api = editor.getApi(MarkdownPlugin).markdown
  for (const source of ["", "일반 한글 문장", "본문에 \\*별표\\*와 \\# 기호"]) {
    assert.deepEqual(
      semantics(api.serialize({ value: api.deserialize(source) })),
      semantics(source)
    )
  }
})

test("Markdown 입력 단축키가 실제 블록/서식으로 변환된다", () => {
  const editor = createPlateEditor({ plugins: notePlugins })
  editor.tf.select({ path: [0, 0], offset: 0 })
  editor.tf.insertText("#")
  editor.tf.insertText(" ")
  editor.tf.insertText("한글 제목")
  assert.equal(editor.children[0].type, "h1")
  assert.match(
    editor.getApi(MarkdownPlugin).markdown.serialize(),
    /^# 한글 제목/
  )
})

test("UTF-8 파일 저장/재열기와 외부 변경 충돌 시 원본 보존", async () => {
  const dir = await mkdtemp(join(tmpdir(), "my-hub-note-test-"))
  const path = join(dir, "한글 메모.md")
  try {
    await writeMarkdown(path, "# 안녕하세요\n\n- 메모\n")
    assert.equal(await readMarkdown(path), "# 안녕하세요\n\n- 메모\n")
    await writeMarkdown(path, "수정한 메모\n", "# 안녕하세요\n\n- 메모\n")
    await writeFile(path, "외부 수정\n", "utf8")
    await assert.rejects(
      () => writeMarkdown(path, "덮어쓰기\n", "수정한 메모\n"),
      /다른 프로그램/
    )
    assert.equal(await readFile(path, "utf8"), "외부 수정\n")
    assert.deepEqual(await readdir(dir), ["한글 메모.md"])
    await writeFile(path, Buffer.from([0xff, 0xfe, 0x80]))
    await assert.rejects(() => readMarkdown(path))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("IPC의 열기/저장 취소와 파일 ID·발신자 검증", async () => {
  const window = new BrowserWindow()
  registerNotes(window as never)
  const invoke = async (channel: string, request?: unknown) =>
    handlers.get(channel)!(window.event(), request)
  const dir = await mkdtemp(join(tmpdir(), "my-hub-note-ipc-"))
  const path = join(dir, "memo.md")
  try {
    dialog.openResult = { canceled: true, filePaths: [] }
    assert.equal(await invoke("notes:open"), null)
    dialog.saveResult = { canceled: true, filePath: undefined }
    assert.equal(
      await invoke("notes:save", {
        id: null,
        saveAs: true,
        name: "회의 기록.md",
        markdown: "새 메모",
      }),
      null
    )
    assert.equal(dialog.saveDefaultPath, "회의 기록.md")
    assert.deepEqual(await readdir(dir), [])
    await assert.rejects(
      () => invoke("notes:save", { id: "임의 ID", markdown: "변경" }),
      /다시 열거나/
    )
    await assert.rejects(
      async () => handlers.get("notes:open")!({ sender: {}, senderFrame: {} }),
      /허용되지 않은/
    )
    dialog.saveResult = { canceled: false, filePath: path }
    const file = (await invoke("notes:save", {
      id: null,
      saveAs: true,
      markdown: "# 메모\n",
    })) as NoteFile
    assert.equal(await readMarkdown(path), "# 메모\n")
    await invoke("notes:save", { id: file.id, markdown: "# 수정\n" })
    dialog.openResult = { canceled: false, filePaths: [path] }
    const reopened = (await invoke("notes:open")) as NoteFile
    assert.equal(reopened.markdown, "# 수정\n")
    assert.equal(reopened.path, path)
    dialog.saveResult = { canceled: false, filePath: join(dir, "잘못된.txt") }
    await assert.rejects(
      () =>
        invoke("notes:save", { id: null, saveAs: true, markdown: "새 메모" }),
      /확장자/
    )
  } finally {
    window.close()
    await rm(dir, { recursive: true, force: true })
  }
})

test("변경된 메모의 닫기: 취소/저장 취소 시 유지, 저장 성공 시 종료", async () => {
  const window = new BrowserWindow()
  registerNotes(window as never)
  ipcMain.emit("notes:dirty", window.event(), true)
  dialog.response = 2
  window.close()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(window.closed, false)
  dialog.response = 0
  window.close()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(window.sent, ["notes:save-before-close"])
  ipcMain.emit("notes:complete-close", window.event(), false)
  assert.equal(window.closed, false)
  window.close()
  await new Promise((resolve) => setImmediate(resolve))
  ipcMain.emit("notes:complete-close", window.event(), true)
  assert.equal(window.closed, true)
  assert.equal(handlers.size, 0)
})

test("제목은 .md 파일명으로 정규화하고 경로/예약어/빈 제목은 거부한다", () => {
  assert.equal(normalizeNoteName("회의 기록"), "회의 기록.md")
  assert.equal(normalizeNoteName(" 회의 기록.MD "), "회의 기록.md")
  for (const invalid of [
    "",
    " ",
    ".md",
    "../메모",
    "폴더\\메모",
    "CON",
    "NUL.txt",
    "이름.",
    "메모\n제목",
  ]) {
    assert.throws(() => normalizeNoteName(invalid), /사용할 수 없는/)
  }
})

test("파일명 변경은 내용을 유지하고 동명 파일을 덮어쓰지 않는다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "my-hub-rename-test-"))
  const original = join(dir, "기존 메모.md")
  try {
    await writeMarkdown(original, "# 기존 내용\n")
    const renamed = await renameMarkdown(original, "회의 기록")
    assert.equal(renamed, join(dir, "회의 기록.md"))
    assert.equal(await readMarkdown(renamed), "# 기존 내용\n")
    await assert.rejects(() => readFile(original))
    await writeMarkdown(original, "# 다른 메모\n")
    await assert.rejects(
      () => renameMarkdown(renamed, "기존 메모"),
      /이미 있습니다/
    )
    assert.equal(await readMarkdown(renamed), "# 기존 내용\n")
    assert.equal(await readMarkdown(original), "# 다른 메모\n")
    await assert.rejects(() => renameMarkdown(renamed, "../잘못된 경로"))
    const caseChanged = await renameMarkdown(renamed, "회의 기록.MD")
    assert.equal(await readMarkdown(caseChanged), "# 기존 내용\n")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("IPC 파일명 변경 후 같은 ID로 본문 저장을 이어간다", async () => {
  const window = new BrowserWindow()
  registerNotes(window as never)
  const invoke = async (channel: string, request?: unknown) =>
    handlers.get(channel)!(window.event(), request)
  const dir = await mkdtemp(join(tmpdir(), "my-hub-rename-ipc-"))
  try {
    const path = join(dir, "원본.md")
    dialog.saveResult = { canceled: false, filePath: path }
    const file = (await invoke("notes:save", {
      id: null,
      saveAs: true,
      name: "원본.md",
      markdown: "원본",
    })) as NoteFile
    const renamed = (await invoke("notes:rename", {
      id: file.id,
      name: "변경한 제목",
    })) as NoteFile
    assert.equal(renamed.name, "변경한 제목.md")
    assert.equal(renamed.id, file.id)
    await invoke("notes:save", { id: file.id, markdown: "수정한 본문" })
    assert.equal(await readMarkdown(renamed.path), "수정한 본문")
    await assert.rejects(() => readFile(path))
    await assert.rejects(
      () => invoke("notes:rename", { id: "잘못된 ID", name: "메모" }),
      /다시 열어/
    )
  } finally {
    window.close()
    await rm(dir, { recursive: true, force: true })
  }
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "my-hub-library-test-"))
  app.paths = {
    documents: join(root, "Documents"),
    userData: join(root, "AppData"),
  }
  await mkdir(app.paths.documents)
  const window = new BrowserWindow()
  registerNotes(window as never)
  async function invoke<T>(channel: string, request?: unknown): Promise<T> {
    return (await handlers.get(channel)!(window.event(), request)) as T
  }
  const api: NotesAPI = {
    library: () => invoke("notes:library"),
    chooseDirectory: () => invoke("notes:choose-directory"),
    openFromLibrary: (name) => invoke("notes:open-library", name),
    open: () => invoke("notes:open"),
    save: (request) => invoke("notes:save", request),
    rename: (request) => invoke("notes:rename", request),
    setFavorite: (request) => invoke("notes:set-favorite", request),
    confirmReplace: () => invoke("notes:confirm-replace"),
    setDirty: (dirty) => {
      ipcMain.emit("notes:dirty", window.event(), dirty)
    },
    onSaveBeforeClose: () => () => {},
    completeClose: (saved) => {
      ipcMain.emit("notes:complete-close", window.event(), saved)
    },
  }
  return {
    root,
    api,
    cleanup: async () => {
      ipcMain.emit("notes:dirty", window.event(), false)
      window.close()
      await rm(root, { recursive: true, force: true })
    },
  }
}

const pause = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(predicate: () => boolean) {
  const deadline = Date.now() + 2500
  while (!predicate()) {
    assert.ok(
      Date.now() < deadline,
      "기대하는 메모 상태로 전환되지 않았습니다."
    )
    await pause(5)
  }
}
function memoryDraft(initial: unknown = null) {
  let value = initial
  return {
    read: () => value,
    write: (draft: unknown) => {
      value = draft
    },
  }
}

test("낙서장 저장은 기존 메모를 보존하고 메모 저장 경로로 파일과 목록을 갱신한다", async () => {
  const f = await fixture()
  const store = new NoteStore(f.api, memoryDraft(), 60_000)
  const stop = store.start()
  try {
    await until(() => store.getSnapshot().ready)
    store.change("기존 메모의 미저장 내용")
    const originalKey = store.getSnapshot().note.key
    const first = await store.saveText("# 낙서장\n\n첫 내용")
    assert.equal(first?.saved, true)
    assert.notEqual(first?.key, originalKey)
    const firstFile = store.getSnapshot().note.file!
    assert.equal(await readMarkdown(firstFile.path), "# 낙서장\n\n첫 내용")
    const entries = store.getSnapshot().library!.notes
    assert.equal(entries.length, 2)
    const original = entries.find((entry) => entry.path !== firstFile.path)!
    assert.equal(await readMarkdown(original.path), "기존 메모의 미저장 내용")

    const second = await store.saveText("# 낙서장\n\n수정 내용", first)
    assert.equal(second?.saved, true)
    assert.equal(second?.key, first?.key)
    assert.equal(store.getSnapshot().library!.notes.length, 2)
    assert.equal(await readMarkdown(firstFile.path), "# 낙서장\n\n수정 내용")

    store.change("메모 화면에서 별도로 수정한 내용")
    const third = await store.saveText("낙서장의 다음 내용", second)
    assert.equal(third?.saved, true)
    assert.notEqual(third?.key, second?.key)
    assert.equal(
      await readMarkdown(firstFile.path),
      "메모 화면에서 별도로 수정한 내용"
    )
    assert.equal(store.getSnapshot().library!.notes.length, 3)
    assert.equal(
      await readMarkdown(store.getSnapshot().note.file!.path),
      "낙서장의 다음 내용"
    )
  } finally {
    stop()
    await f.cleanup()
  }
})

test("낙서장 전달 전 저장 실패는 기존 메모를 유지하고 새 메모 저장 실패도 재시도할 수 있다", async () => {
  const f = await fixture()
  let fail = true
  const store = new NoteStore(
    {
      ...f.api,
      save: (request) => {
        if (fail) return Promise.reject(new Error("저장 실패"))
        return f.api.save(request)
      },
    },
    memoryDraft(),
    60_000
  )
  const stop = store.start()
  try {
    await until(() => store.getSnapshot().ready)
    store.change("보존해야 할 메모")
    const key = store.getSnapshot().note.key
    assert.equal(await store.saveText("낙서장"), undefined)
    assert.equal(store.getSnapshot().note.key, key)
    assert.equal(store.getSnapshot().note.markdown, "보존해야 할 메모")
    fail = false
    assert.equal(await store.save(), true)
    fail = true
    const failed = await store.saveText("낙서장")
    assert.equal(failed?.saved, false)
    assert.equal(store.getSnapshot().note.markdown, "낙서장")
    fail = false
    const retried = await store.saveText("낙서장", failed)
    assert.equal(retried?.saved, true)
    assert.equal(retried?.key, failed?.key)
    assert.equal(store.getSnapshot().library!.notes.length, 2)
  } finally {
    stop()
    await f.cleanup()
  }
})

test("기본 폴더 생성, 저장 목록, 중복 이름 보존과 폴더 설정 유지", async () => {
  const f = await fixture()
  try {
    const initial = await f.api.library()
    assert.equal(
      initial.directory,
      join(app.paths.documents, "My Hub", "Notes")
    )
    assert.deepEqual(initial.notes, [])
    dialog.openResult = { canceled: true, filePaths: [] }
    await f.api.open()
    assert.equal(dialog.openDefaultPath, initial.directory)
    const first = await f.api.save({
      id: null,
      name: "같은 제목",
      markdown: "첫 메모",
    })
    const second = await f.api.save({
      id: null,
      name: "같은 제목",
      markdown: "둘째 메모",
    })
    assert.equal(first!.name, "같은 제목.md")
    assert.equal(second!.name, "같은 제목 (2).md")
    assert.equal(await readMarkdown(first!.path), "첫 메모")
    const favoriteLibrary = await f.api.setFavorite({
      path: first!.path,
      favorite: true,
    })
    assert.equal(
      favoriteLibrary.notes.find((note) => note.path === first!.path)?.favorite,
      true
    )
    assert.equal(
      (await new NoteLibrary(app.paths).snapshot()).notes.find(
        (note) => note.path === first!.path
      )?.favorite,
      true
    )
    await writeFile(join(initial.directory, "무시.txt"), "text")
    await mkdir(join(initial.directory, "폴더.md"))
    assert.equal((await f.api.library()).notes.length, 2)
    await assert.rejects(() => f.api.openFromLibrary("../무시.md"))
    dialog.openResult = { canceled: true, filePaths: [] }
    assert.equal(await f.api.chooseDirectory(), null)
    assert.equal((await f.api.library()).directory, initial.directory)
    const selected = join(f.root, "선택한 폴더")
    await mkdir(selected)
    dialog.openResult = { canceled: false, filePaths: [selected] }
    assert.equal((await f.api.chooseDirectory())!.directory, selected)
    dialog.openResult = { canceled: true, filePaths: [] }
    await f.api.open()
    assert.equal(dialog.openDefaultPath, selected)
    assert.equal(
      (await new NoteLibrary(app.paths).snapshot()).directory,
      selected
    )
    assert.equal(await readMarkdown(first!.path), "첫 메모")
    const third = await f.api.save({
      id: null,
      name: "새 위치",
      markdown: "메모",
    })
    assert.equal(third!.path, join(selected, "새 위치.md"))
  } finally {
    await f.cleanup()
  }
})

test("동시에 만드는 같은 제목과 사라진 지정 폴더에서도 기존 메모를 보호한다", async () => {
  const f = await fixture()
  try {
    const library = new NoteLibrary(app.paths)
    const created = await Promise.all([
      library.create("하나", "중복"),
      library.create("둘", "중복"),
    ])
    assert.equal(new Set(created.map((file) => file.path)).size, 2)
    assert.deepEqual(
      new Set(
        await Promise.all(created.map((file) => readMarkdown(file.path)))
      ),
      new Set(["하나", "둘"])
    )
    const selected = join(f.root, "임시 폴더")
    await mkdir(selected)
    await library.setDirectory(selected)
    await rm(selected, { recursive: true, force: true })
    await assert.rejects(
      () => new NoteLibrary(app.paths).snapshot(),
      /접근할 수 없습니다/
    )
  } finally {
    await f.cleanup()
  }
})

test("자동 저장은 빈 문서를 만들지 않고 연속 입력을 한 번에 저장한다", async () => {
  const f = await fixture()
  let saves = 0
  const store = new NoteStore(
    {
      ...f.api,
      save: (request) => {
        saves++
        return f.api.save(request)
      },
    },
    memoryDraft(),
    15
  )
  const stop = store.start()
  try {
    await until(() => store.getSnapshot().ready)
    await pause()
    assert.equal(saves, 0)
    store.change("첫 입력")
    store.change("두 번째 입력")
    store.change("완성한 한글 메모")
    await until(
      () => store.getSnapshot().note.savedMarkdown === "완성한 한글 메모"
    )
    assert.equal(saves, 1)
    assert.equal(
      await readMarkdown(store.getSnapshot().note.file!.path),
      "완성한 한글 메모"
    )
    await until(() => store.getSnapshot().library!.notes.length === 1)
  } finally {
    stop()
    await f.cleanup()
  }
})

test("저장이 느려도 입력을 막지 않고 최신 내용까지 순서대로 저장한다", async () => {
  const f = await fixture()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const snapshots: string[] = []
  const store = new NoteStore(
    {
      ...f.api,
      save: async (request) => {
        snapshots.push(request.markdown)
        if (snapshots.length === 1) await gate
        return f.api.save(request)
      },
    },
    memoryDraft(),
    15
  )
  const stop = store.start()
  try {
    await until(() => store.getSnapshot().ready)
    store.change("저장 중인 내용")
    await until(() => store.getSnapshot().saving)
    assert.equal(store.getSnapshot().busy, false)
    store.change("저장 도중 추가한 내용")
    release()
    await until(
      () => store.getSnapshot().note.savedMarkdown === "저장 도중 추가한 내용"
    )
    assert.deepEqual(snapshots, ["저장 중인 내용", "저장 도중 추가한 내용"])
    assert.equal(
      await readMarkdown(store.getSnapshot().note.file!.path),
      "저장 도중 추가한 내용"
    )
    assert.equal((await f.api.library()).notes.length, 1)
  } finally {
    release()
    stop()
    await f.cleanup()
  }
})

test("새 메모/목록 전환 전에 미저장 내용을 저장하고 다음 문서에 섞지 않는다", async () => {
  const f = await fixture()
  const store = new NoteStore(f.api, memoryDraft(), 15)
  const stop = store.start()
  try {
    await until(() => store.getSnapshot().ready)
    store.change("첫 메모의 내용")
    await store.newNote()
    assert.equal(store.getSnapshot().note.markdown, "")
    assert.equal((await f.api.library()).notes.length, 1)
    const first = (await f.api.library()).notes[0]
    store.change("두 번째 메모의 내용")
    await store.openNote(first.name)
    assert.equal(store.getSnapshot().note.markdown, "첫 메모의 내용")
    const files = (await f.api.library()).notes
    assert.equal(files.length, 2)
    assert.deepEqual(
      new Set(await Promise.all(files.map((file) => readMarkdown(file.path)))),
      new Set(["첫 메모의 내용", "두 번째 메모의 내용"])
    )
    await pause()
    assert.equal((await f.api.library()).notes.length, 2)
  } finally {
    stop()
    await f.cleanup()
  }
})

test("외부 변경 충돌 시 자동 저장을 중지하고 다른 이름으로 저장하면 복구된다", async () => {
  const f = await fixture()
  let saves = 0
  const store = new NoteStore(
    {
      ...f.api,
      save: (request) => {
        saves++
        return f.api.save(request)
      },
    },
    memoryDraft(),
    15
  )
  const stop = store.start()
  try {
    await until(() => store.getSnapshot().ready)
    store.change("원본 내용")
    await until(() => store.getSnapshot().note.savedMarkdown === "원본 내용")
    const original = store.getSnapshot().note.file!.path
    await writeFile(original, "외부 프로그램의 변경")
    store.change("내가 편집한 내용")
    await until(() => store.getSnapshot().autosavePaused)
    const attempts = saves
    store.change("이어 편집한 내용")
    await pause()
    assert.equal(saves, attempts)
    assert.equal(await readMarkdown(original), "외부 프로그램의 변경")
    dialog.saveResult = {
      canceled: false,
      filePath: join(f.root, "별도 저장.md"),
    }
    await store.save(true)
    assert.equal(store.getSnapshot().autosavePaused, false)
    assert.equal(
      await readMarkdown(store.getSnapshot().note.file!.path),
      "이어 편집한 내용"
    )
    assert.equal(await readMarkdown(original), "외부 프로그램의 변경")
  } finally {
    stop()
    await f.cleanup()
  }
})

test("다시 시작하면 저장된 메모의 디스크 최신본을 이어 열고 중복 파일을 만들지 않는다", async () => {
  const f = await fixture()
  const storage = memoryDraft()
  const first = new NoteStore(f.api, storage, 15)
  const stopFirst = first.start()
  let stopSecond = () => {}
  try {
    await until(() => first.getSnapshot().ready)
    first.change("저장한 내용")
    await until(() => first.getSnapshot().note.savedMarkdown === "저장한 내용")
    const path = first.getSnapshot().note.file!.path
    stopFirst()
    await writeFile(path, "외부에서 갱신한 최신본")
    const second = new NoteStore(f.api, storage, 15)
    stopSecond = second.start()
    await until(() => second.getSnapshot().ready)
    assert.equal(second.getSnapshot().note.markdown, "외부에서 갱신한 최신본")
    assert.equal(second.getSnapshot().note.file!.path, path)
    await pause()
    assert.equal((await f.api.library()).notes.length, 1)
  } finally {
    stopFirst()
    stopSecond()
    await f.cleanup()
  }
})

test("미저장 초안과 디스크가 충돌하면 원본을 보존하고 별도 메모로 복원한다", async () => {
  const f = await fixture()
  let stop = () => {}
  try {
    const file = await f.api.save({
      id: null,
      name: "원본",
      markdown: "디스크 최신본",
    })
    const store = new NoteStore(
      f.api,
      memoryDraft({
        filePath: file!.path,
        name: file!.name,
        markdown: "미저장 초안",
        savedMarkdown: "과거 내용",
      }),
      15
    )
    stop = store.start()
    await until(() => store.getSnapshot().ready)
    await until(() => store.getSnapshot().note.savedMarkdown === "미저장 초안")
    assert.equal(store.getSnapshot().note.name, "원본 (복원).md")
    assert.equal(await readMarkdown(file!.path), "디스크 최신본")
    assert.equal(
      await readMarkdown(store.getSnapshot().note.file!.path),
      "미저장 초안"
    )
    assert.equal((await f.api.library()).notes.length, 2)
  } finally {
    stop()
    await f.cleanup()
  }
})

test("폴더 변경은 열린 파일을 이동하지 않고 다음 새 메모의 위치만 바꾼다", async () => {
  const f = await fixture()
  const store = new NoteStore(f.api, memoryDraft(), 15)
  const stop = store.start()
  try {
    await until(() => store.getSnapshot().ready)
    store.change("이전 폴더의 메모")
    await store.save()
    const original = store.getSnapshot().note.file!.path
    const selected = join(f.root, "새 폴더")
    await mkdir(selected)
    dialog.openResult = { canceled: false, filePaths: [selected] }
    await store.chooseDirectory()
    assert.equal(store.getSnapshot().note.file!.path, original)
    assert.equal(store.getSnapshot().library!.directory, selected)
    await store.newNote()
    store.change("새 위치의 메모")
    await store.save()
    assert.equal(
      store.getSnapshot().note.file!.path,
      join(selected, "제목 없는 메모.md")
    )
    assert.equal(await readMarkdown(original), "이전 폴더의 메모")
  } finally {
    stop()
    await f.cleanup()
  }
})
