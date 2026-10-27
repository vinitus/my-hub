import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createPlateEditor } from "platejs/react"
import { MarkdownPlugin } from "@platejs/markdown"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import { notePlugins } from "../src/renderer/src/features/notes/editor-plugins"
import { assertSupportedMarkdown } from "../src/renderer/src/features/notes/markdown"
import {
  readMarkdown,
  writeMarkdown,
  renameMarkdown,
} from "../src/main/note-files"
import { registerNotes } from "../src/main/notes"
import { BrowserWindow, dialog, handlers, ipcMain } from "./fakes/electron"
import type { NoteFile } from "../src/shared/notes"
import { normalizeNoteName } from "../src/shared/notes"

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
      () => invoke("notes:save", { id: null, markdown: "새 메모" }),
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
