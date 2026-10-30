import { app, BrowserWindow, dialog, ipcMain } from "electron"
import { basename, extname, dirname, join } from "node:path"
import { randomUUID } from "node:crypto"
import { ModeItemKeySchema, modeItemKey } from "../shared/item-mode"
import type { SaveNoteRequest } from "../shared/notes"
import { DEFAULT_NOTE_NAME, normalizeNoteName } from "../shared/notes"
import {
  MAX_NOTE_BYTES,
  readMarkdown,
  writeMarkdown,
  renameMarkdown,
} from "./note-files"
import { NoteLibrary } from "./note-library"
import type { AppSettingsRepository } from "./app-settings"

const filters = [{ name: "Markdown 메모", extensions: ["md"] }]

export function registerNotes(
  window: BrowserWindow,
  mode?: AppSettingsRepository
) {
  const library = new NoteLibrary({
    documents: app.getPath("documents"),
    userData: app.getPath("userData"),
  })
  const files = new Map<string, { path: string; markdown: string }>()
  let dirty = false
  let allowClose = false
  let closePending = false
  let fileOperation = false

  function checkSender(
    event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent
  ) {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    ) {
      throw new Error("허용되지 않은 요청입니다.")
    }
  }

  async function chooseSave(defaultPath: string) {
    const result = await dialog.showSaveDialog(window, {
      title: "메모 저장",
      defaultPath,
      filters,
    })
    return result.canceled ? null : (result.filePath ?? null)
  }

  ipcMain.handle("notes:library", async (event) => {
    checkSender(event)
    return library.snapshot()
  })
  ipcMain.handle("notes:set-favorite", async (event, request: unknown) => {
    checkSender(event)
    if (
      !request ||
      typeof request !== "object" ||
      !("path" in request) ||
      typeof request.path !== "string" ||
      !("favorite" in request) ||
      typeof request.favorite !== "boolean"
    )
      throw new Error("즐겨찾기할 메모를 확인해 주세요.")
    return library.setFavorite(request.path, request.favorite)
  })
  ipcMain.handle("notes:choose-directory", async (event) => {
    checkSender(event)
    if (fileOperation) throw new Error("파일 작업이 진행 중입니다.")
    fileOperation = true
    try {
      const result = await dialog.showOpenDialog(window, {
        title: "메모 저장 폴더 선택",
        properties: ["openDirectory", "createDirectory"],
      })
      if (result.canceled || !result.filePaths[0]) return null
      return await library.setDirectory(result.filePaths[0])
    } finally {
      fileOperation = false
    }
  })
  ipcMain.handle("notes:open-library", async (event, name: string) => {
    checkSender(event)
    const file = await library.open(name)
    const id = randomUUID()
    files.set(id, { path: file.path, markdown: file.markdown })
    return { ...file, id }
  })

  ipcMain.handle("notes:open", async (event) => {
    checkSender(event)
    if (fileOperation) throw new Error("파일 작업이 진행 중입니다.")
    fileOperation = true
    try {
      const result = await dialog.showOpenDialog(window, {
        title: "Markdown 메모 열기",
        defaultPath: await library.directory(),
        filters,
        properties: ["openFile"],
      })
      if (result.canceled || !result.filePaths[0]) return null
      const path = result.filePaths[0]
      if (extname(path).toLowerCase() !== ".md")
        throw new Error(".md 파일을 선택해 주세요.")
      const markdown = await readMarkdown(path)
      const id = randomUUID()
      files.set(id, { path, markdown })
      return { id, path, name: basename(path), markdown }
    } finally {
      fileOperation = false
    }
  })

  ipcMain.handle("notes:save", async (event, request: SaveNoteRequest) => {
    checkSender(event)
    if (
      !request ||
      typeof request.markdown !== "string" ||
      Buffer.byteLength(request.markdown) > MAX_NOTE_BYTES
    ) {
      throw new Error("메모는 5MB 이하의 텍스트여야 합니다.")
    }
    if (fileOperation) throw new Error("파일 작업이 진행 중입니다.")
    fileOperation = true
    try {
      if (request.personalSourceKey !== undefined)
        ModeItemKeySchema.parse(request.personalSourceKey)
      if (
        request.personal !== undefined &&
        typeof request.personal !== "boolean"
      )
        throw new Error("메모의 생성 모드를 확인해 주세요.")
      const existing = request.id ? files.get(request.id) : undefined
      const inherit = async (path: string) => {
        if (!existing)
          await mode?.markCreatedPersonal(
            modeItemKey("note", path),
            request.personal
          )
        if (request.personalSourceKey)
          await mode?.inheritPersonal(
            request.personalSourceKey,
            modeItemKey("note", path)
          )
      }
      if (request.id && !existing)
        throw new Error("파일을 다시 열거나 다른 이름으로 저장해 주세요.")
      if (!existing && !request.saveAs) {
        const file = await library.create(
          request.markdown,
          request.name,
          inherit
        )
        const id = randomUUID()
        files.set(id, { path: file.path, markdown: file.markdown })
        return { ...file, id }
      }
      const path =
        !request.saveAs && existing
          ? existing.path
          : await chooseSave(
              existing?.path ??
                normalizeNoteName(request.name ?? DEFAULT_NOTE_NAME)
            )
      if (!path) return null
      // 대화상자에서 확정한 경로를 임의로 바꾸어 다른 파일을 덮어쓰지 않는다.
      if (extname(path).toLowerCase() !== ".md")
        throw new Error("파일 이름에 .md 확장자를 사용해 주세요.")
      await inherit(path)
      if (existing) await mode?.preserveNotePrivacy(existing.path, path)
      await writeMarkdown(
        path,
        request.markdown,
        existing && path === existing.path ? existing.markdown : undefined
      )
      const id = request.id ?? randomUUID()
      files.set(id, { path, markdown: request.markdown })
      return { id, path, name: basename(path), markdown: request.markdown }
    } finally {
      fileOperation = false
    }
  })

  ipcMain.handle(
    "notes:rename",
    async (event, request: { id: string; name: string }) => {
      checkSender(event)
      if (!request || typeof request.name !== "string")
        throw new Error("파일명을 입력해 주세요.")
      const existing = files.get(request.id)
      if (!existing) throw new Error("파일을 다시 열어 주세요.")
      if (fileOperation) throw new Error("파일 작업이 진행 중입니다.")
      fileOperation = true
      try {
        await mode?.preserveNotePrivacy(
          existing.path,
          join(dirname(existing.path), normalizeNoteName(request.name))
        )
        const path = await renameMarkdown(existing.path, request.name)
        files.set(request.id, { ...existing, path })
        return {
          id: request.id,
          path,
          name: basename(path),
          markdown: existing.markdown,
        }
      } finally {
        fileOperation = false
      }
    }
  )

  ipcMain.handle("notes:confirm-replace", async (event) => {
    checkSender(event)
    const result = await dialog.showMessageBox(window, {
      type: "question",
      message: "현재 메모의 변경 내용을 저장할까요?",
      buttons: ["저장", "저장하지 않음", "취소"],
      defaultId: 0,
      cancelId: 2,
    })
    return ["save", "discard", "cancel"][result.response]
  })

  const onDirty = (event: Electron.IpcMainEvent, value: boolean) => {
    checkSender(event)
    dirty = value === true
  }
  const onCompleteClose = (event: Electron.IpcMainEvent, saved: boolean) => {
    checkSender(event)
    if (!closePending) return
    closePending = false
    if (saved === true) {
      allowClose = true
      window.close()
    }
  }
  ipcMain.on("notes:dirty", onDirty)
  ipcMain.on("notes:complete-close", onCompleteClose)

  window.on("close", (event) => {
    if (allowClose || !dirty) return
    event.preventDefault()
    if (closePending) return
    closePending = true
    void dialog
      .showMessageBox(window, {
        type: "question",
        message: "메모를 저장한 뒤 닫을까요?",
        buttons: ["저장", "저장하지 않고 닫기", "취소"],
        defaultId: 0,
        cancelId: 2,
      })
      .then(({ response }) => {
        if (response === 0) window.webContents.send("notes:save-before-close")
        else {
          closePending = false
          if (response === 1) {
            allowClose = true
            window.close()
          }
        }
      })
      .catch(() => {
        closePending = false
      })
  })

  window.on("closed", () => {
    for (const channel of [
      "notes:open",
      "notes:library",
      "notes:set-favorite",
      "notes:choose-directory",
      "notes:open-library",
      "notes:save",
      "notes:rename",
      "notes:confirm-replace",
    ])
      ipcMain.removeHandler(channel)
    ipcMain.removeListener("notes:dirty", onDirty)
    ipcMain.removeListener("notes:complete-close", onCompleteClose)
  })
}
