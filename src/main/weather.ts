import { app, ipcMain, type BrowserWindow } from "electron"
import { z } from "zod"
import { WeatherLocationSchema } from "../shared/weather"
import { WeatherService } from "./weather-service"

const CurrentRequestSchema = z
  .object({
    location: WeatherLocationSchema,
    force: z.boolean().default(false),
  })
  .strict()

export function registerWeather(window: BrowserWindow) {
  const service = new WeatherService(app.getPath("userData"))
  const handlers = {
    "weather:location": () => service.location(),
    "weather:set-location": (request: unknown) =>
      service.setLocation(request as Parameters<typeof service.setLocation>[0]),
    "weather:search": (request: unknown) => service.search(request as string),
    "weather:current": (request: unknown) => {
      const { location, force } = CurrentRequestSchema.parse(request)
      return service.current(location, force)
    },
  }
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, request) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw new Error("허용되지 않은 요청입니다.")
      return handler(request)
    })
  }
  window.on("closed", () => {
    for (const channel of Object.keys(handlers)) ipcMain.removeHandler(channel)
  })
}
