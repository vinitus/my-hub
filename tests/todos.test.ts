import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { TodoSchema, type Todo, type TodosAPI } from "../src/shared/todos"
import { TodoRepository } from "../src/main/todo-repository"
import { TodoStore } from "../src/renderer/src/features/todos/model/todo-store"
import { registerTodos } from "../src/main/todos"
import { app, BrowserWindow, handlers } from "./fakes/electron"

const todo = (): Todo => ({
  id: crypto.randomUUID(),
  title: "할일",
  dueDate: "2026-10-30",
  completed: false,
  favorite: false,
})
test("제목·실제 날짜·완료 여부를 검증한다", () => {
  assert.equal(TodoSchema.parse({ ...todo(), title: "  제목  " }).title, "제목")
  const undated = todo()
  delete undated.dueDate
  assert.equal(TodoSchema.parse(undated).dueDate, undefined)
  for (const patch of [
    { title: " " },
    { title: "a".repeat(201) },
    { dueDate: "2026-02-30" },
    { dueDate: "2026-13-01" },
    { dueDate: "" },
    { completed: "false" },
  ])
    assert.equal(TodoSchema.safeParse({ ...todo(), ...patch }).success, false)
})
test("추가·수정·완료·삭제를 저장하고 재시작 시 복원한다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "my-hub-todos-"))
  try {
    const repo = new TodoRepository(dir)
    const item = todo()
    delete item.dueDate
    let snapshot = await repo.load()
    snapshot = await repo.save({
      todo: item,
      expectedRevision: snapshot.revision,
    })
    assert.equal(snapshot.items[0]?.dueDate, undefined)
    snapshot = await repo.save({
      todo: {
        ...item,
        title: "수정",
        dueDate: "2026-11-01",
        completed: true,
        favorite: true,
      },
      expectedRevision: snapshot.revision,
    })
    assert.deepEqual((await new TodoRepository(dir).load()).items, [
      {
        ...item,
        title: "수정",
        dueDate: "2026-11-01",
        completed: true,
        favorite: true,
      },
    ])
    snapshot = await repo.remove({
      id: item.id,
      expectedRevision: snapshot.revision,
    })
    assert.deepEqual(snapshot.items, [])
    assert.deepEqual(await readdir(dir), ["todos.json"])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
test("동시 저장 충돌과 손상된 원본의 덮어쓰기를 방지한다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "my-hub-todos-"))
  try {
    const repo = new TodoRepository(dir)
    const results = await Promise.allSettled([
      repo.save({ todo: todo(), expectedRevision: "missing" }),
      repo.save({ todo: todo(), expectedRevision: "missing" }),
    ])
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1
    )
    await writeFile(join(dir, "todos.json"), "broken")
    await assert.rejects(repo.load(), /원본/)
    await assert.rejects(
      repo.save({ todo: todo(), expectedRevision: "missing" })
    )
    assert.equal(await readFile(join(dir, "todos.json"), "utf8"), "broken")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
test("저장 실패 시 기존 목록을 유지하고 재시도할 수 있다", async () => {
  let fail = true
  const item = todo()
  const api: TodosAPI = {
    load: async () => ({ items: [item], revision: "1", path: "test" }),
    save: async ({ todo }) => {
      if (fail) throw new Error("저장 실패")
      return { items: [todo], revision: "2", path: "test" }
    },
    remove: async () => ({ items: [], revision: "3", path: "test" }),
  }
  const store = new TodoStore(api)
  let updates = 0
  const unsubscribe = store.subscribe(() => updates++)
  await Promise.all([store.initialize(), store.initialize()])
  assert.equal(await store.save({ ...item, completed: true }, "1"), false)
  assert.equal(store.getSnapshot().snapshot?.items[0].completed, false)
  assert.match(store.getSnapshot().error, /저장 실패/)
  fail = false
  assert.equal(await store.save({ ...item, completed: true }, "1"), true)
  assert.equal(store.getSnapshot().snapshot?.items[0].completed, true)
  unsubscribe()
  const before = updates
  await store.remove(item.id, "2")
  assert.equal(updates, before)
})
test("TODO IPC는 등록된 창의 최상위 프레임만 허용하고 종료 시 해제한다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "my-hub-todos-"))
  const previous = app.paths.userData
  app.paths.userData = dir
  const win = new BrowserWindow()
  try {
    registerTodos(win as never)
    const load = handlers.get("todos:load")!
    assert.throws(() => load({ sender: {}, senderFrame: {} }), /허용/)
    assert.throws(
      () => load({ sender: win.webContents, senderFrame: {} }),
      /허용/
    )
    const snapshot = (await load({
      sender: win.webContents,
      senderFrame: win.webContents.mainFrame,
    })) as { items: Todo[] }
    assert.deepEqual(snapshot.items, [])
  } finally {
    win.emit("closed")
    assert.equal(handlers.has("todos:load"), false)
    app.paths.userData = previous
    await rm(dir, { recursive: true, force: true })
  }
})
