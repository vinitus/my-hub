import { app, dialog, ipcMain, shell, type BrowserWindow } from "electron"
import { basename, extname } from "node:path"
import { ShortcutKindSchema } from "../shared/shortcuts"
import { ShortcutRepository } from "./shortcut-repository"
import { validateShortcut, inspectShortcutDrop } from "./shortcut-target"
import { randomUUID } from "node:crypto"
import { ShortcutIcons } from "./shortcut-icons"

export function registerShortcuts(window: BrowserWindow) {
  const repository = new ShortcutRepository(app.getPath("userData"))
  const icons = new ShortcutIcons()
  const channels: string[] = []
  function handle(channel: string, action: (request: unknown) => unknown) {
    channels.push(channel)
    ipcMain.handle(channel, (event, request) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw new Error("허용되지 않은 요청입니다.")
      return action(request)
    })
  }
  handle("shortcuts:load", () => repository.load())
  handle("shortcuts:icon", async (request) =>
    icons.get(await repository.resolve(request))
  )
  handle("shortcuts:inspect-drop", inspectShortcutDrop)
  handle("shortcuts:save", (request) =>
    repository.save(request as Parameters<typeof repository.save>[0])
  )
  handle("shortcuts:remove", (request) =>
    repository.remove(request as Parameters<typeof repository.remove>[0])
  )
  handle("shortcuts:choose", async (request) => {
    const kind = ShortcutKindSchema.parse(request)
    if (kind === "website") throw new Error("웹사이트는 주소를 입력해 주세요.")
    const result = await dialog.showOpenDialog(window, {
      title: kind === "folder" ? "바로가기 폴더 선택" : "프로그램 선택",
      properties:
        kind === "folder"
          ? ["openDirectory"]
          : ["openFile", "noResolveAliases"],
      ...(kind === "program"
        ? {
            filters: [
              {
                name: "프로그램 및 바로가기",
                extensions:
                  process.platform === "darwin" ? ["app"] : ["exe", "lnk"],
              },
            ],
          }
        : {}),
    })
    if (result.canceled || !result.filePaths[0]) return null
    const target = result.filePaths[0]
    const name =
      kind === "program" ? basename(target, extname(target)) : basename(target)
    return validateShortcut({
      id: randomUUID(),
      kind,
      name: name.slice(0, 80) || "폴더",
      target,
    }).then((item) => ({ target: item.target, name: item.name }))
  })
  let launching = false
  handle("shortcuts:launch", async (request) => {
    if (launching)
      throw new Error(
        "다른 바로가기를 여는 중입니다. 잠시 후 다시 시도해 주세요."
      )
    launching = true
    try {
      const item = await repository.resolve(request)
      if (item.kind === "website") await shell.openExternal(item.target)
      else {
        const error = await shell.openPath(item.target)
        if (error) throw new Error(`대상을 열지 못했습니다: ${error}`)
      }
    } finally {
      launching = false
    }
  })
  window.on("closed", () => {
    for (const channel of channels) ipcMain.removeHandler(channel)
  })
}
