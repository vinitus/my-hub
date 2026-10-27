import { EventEmitter } from "node:events"
import { tmpdir } from "node:os"
import { join } from "node:path"

export const app = {
  iconPaths: [] as string[],
  iconEmpty: false,
  iconError: false,
  iconResults: new Map<string, "empty" | "error">(),
  getFileIcon: async (path: string) => {
    app.iconPaths.push(path)
    if (app.iconError || app.iconResults.get(path) === "error")
      throw new Error("아이콘 읽기 실패")
    return {
      isEmpty: () => app.iconEmpty || app.iconResults.get(path) === "empty",
      toDataURL: () => "data:image/png;base64,dGVzdA==",
    }
  },
  paths: {
    documents: join(tmpdir(), "my-hub-test-documents"),
    userData: join(tmpdir(), "my-hub-test-user-data"),
  },
  getPath: (name: "documents" | "userData") => app.paths[name],
}

// OS 창 없이 IPC와 닫기 이벤트 흐름만 검증하는 테스트용 Electron 경계다.
export const handlers = new Map<string, (...args: unknown[]) => unknown>()
export const ipcMain = Object.assign(new EventEmitter(), {
  handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
    handlers.set(channel, handler),
  removeHandler: (channel: string) => handlers.delete(channel),
})
export const dialog = {
  openProperties: [] as string[],
  openDefaultPath: undefined as string | undefined,
  saveDefaultPath: "",
  openResult: { canceled: true, filePaths: [] as string[] },
  saveResult: { canceled: true, filePath: undefined as string | undefined },
  response: 2,
  showOpenDialog: async (
    _window: unknown,
    options: { defaultPath?: string; properties?: string[] }
  ) => {
    dialog.openDefaultPath = options.defaultPath
    dialog.openProperties = options.properties ?? []
    return dialog.openResult
  },
  showSaveDialog: async (
    _window: unknown,
    options: { defaultPath: string }
  ) => {
    dialog.saveDefaultPath = options.defaultPath
    return dialog.saveResult
  },
  showMessageBox: async () => ({ response: dialog.response }),
}
// 실제 프로그램/브라우저를 실행하지 않고 요청과 OS 오류 처리만 검증한다.
export const shell = {
  shortcutDetails: new Map<
    string,
    { target: string; icon?: string; iconIndex?: number }
  >(),
  readShortcutLink: (path: string) => {
    const details = shell.shortcutDetails.get(path)
    if (!details) throw new Error("바로가기를 읽을 수 없습니다.")
    return details
  },
  openedPaths: [] as string[],
  openedUrls: [] as string[],
  pathError: "",
  externalError: null as Error | null,
  openPath: async (path: string) => {
    shell.openedPaths.push(path)
    return shell.pathError
  },
  openExternal: async (url: string) => {
    shell.openedUrls.push(url)
    if (shell.externalError) throw shell.externalError
  },
}
export class BrowserWindow extends EventEmitter {
  closed = false
  sent: string[] = []
  webContents = {
    mainFrame: {},
    send: (channel: string) => this.sent.push(channel),
  }
  event() {
    return { sender: this.webContents, senderFrame: this.webContents.mainFrame }
  }
  close() {
    let prevented = false
    this.emit("close", {
      preventDefault: () => {
        prevented = true
      },
    })
    if (!prevented) {
      this.closed = true
      this.emit("closed")
    }
  }
}
