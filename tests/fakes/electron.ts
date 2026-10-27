import { EventEmitter } from "node:events"

// OS 창 없이 IPC와 닫기 이벤트 흐름만 검증하는 테스트용 Electron 경계다.
export const handlers = new Map<string, (...args: unknown[]) => unknown>()
export const ipcMain = Object.assign(new EventEmitter(), {
  handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
    handlers.set(channel, handler),
  removeHandler: (channel: string) => handlers.delete(channel),
})
export const dialog = {
  saveDefaultPath: "",
  openResult: { canceled: true, filePaths: [] as string[] },
  saveResult: { canceled: true, filePath: undefined as string | undefined },
  response: 2,
  showOpenDialog: async () => dialog.openResult,
  showSaveDialog: async (
    _window: unknown,
    options: { defaultPath: string }
  ) => {
    dialog.saveDefaultPath = options.defaultPath
    return dialog.saveResult
  },
  showMessageBox: async () => ({ response: dialog.response }),
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
