import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import {
  WeatherLocationSchema,
  type WeatherAPI,
  type WeatherReading,
} from "../shared/weather"
import { searchKoreanWeatherRegions } from "./korean-weather-regions"

const SettingsSchema = z
  .object({ version: z.literal(1), location: WeatherLocationSchema })
  .strict()
const SearchSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number().int().nonnegative(),
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        admin1: z.string().optional(),
        country: z.string().optional(),
      })
    )
    .max(10)
    .optional(),
})
const CurrentSchema = z.object({
  timezone: z.string(),
  current: z.object({
    time: z.number(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    weather_code: z.number().int(),
    is_day: z.union([z.literal(0), z.literal(1)]),
  }),
  daily: z.object({
    temperature_2m_min: z.array(z.number()).min(1),
    temperature_2m_max: z.array(z.number()).min(1),
  }),
})

async function getJSON(url: URL): Promise<unknown> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      credentials: "omit",
    })
    if (response.status === 429)
      throw new Error("날씨 요청이 많습니다. 잠시 후 다시 시도해 주세요.")
    if (!response.ok) throw new Error("날씨 서비스에 연결하지 못했습니다.")
    const raw = await response.text()
    if (raw.length > 256 * 1024) throw new Error("날씨 응답이 너무 큽니다.")
    return JSON.parse(raw)
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("날씨")) throw cause
    throw new Error(
      "날씨를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.",
      { cause }
    )
  }
}

export class WeatherService {
  private readonly directory: string
  private readonly path: string
  private tail: Promise<unknown> = Promise.resolve()
  private cache:
    { key: string; expires: number; value: Promise<WeatherReading> } | undefined
  constructor(directory: string) {
    this.directory = directory
    this.path = join(directory, "weather-settings.json")
  }

  location: WeatherAPI["location"] = async () => {
    let raw: string
    try {
      raw = await readFile(this.path, "utf8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
      throw error
    }
    try {
      return SettingsSchema.parse(JSON.parse(raw)).location
    } catch (cause) {
      throw new Error(
        "저장된 날씨 지역을 읽을 수 없습니다. 지역을 다시 선택해 주세요.",
        { cause }
      )
    }
  }
  setLocation: WeatherAPI["setLocation"] = async (request) => {
    const result = WeatherLocationSchema.safeParse(request)
    if (!result.success) throw new Error("날씨 지역을 확인해 주세요.")
    const location = result.data
    const save = this.tail.then(async () => {
      await mkdir(this.directory, { recursive: true })
      const temporary = join(this.directory, `.weather-${randomUUID()}.tmp`)
      try {
        await writeFile(
          temporary,
          JSON.stringify({ version: 1, location }, null, 2) + "\n",
          { encoding: "utf8", flag: "wx" }
        )
        await rename(temporary, this.path)
      } finally {
        await unlink(temporary).catch(() => {})
      }
      return location
    })
    this.tail = save.then(
      () => undefined,
      () => undefined
    )
    return save
  }
  search: WeatherAPI["search"] = async (query) => {
    const parsed = z.string().trim().min(2).max(80).safeParse(query)
    if (!parsed.success) throw new Error("지역 이름을 2~80자로 입력해 주세요.")
    const local = searchKoreanWeatherRegions(parsed.data)
    if (local.length || /[가-힣]/.test(parsed.data)) return local
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search")
    url.search = new URLSearchParams({
      name: parsed.data,
      count: "5",
      language: "ko",
      format: "json",
    }).toString()
    const result = SearchSchema.safeParse(await getJSON(url))
    if (!result.success) throw new Error("지역 검색 결과를 읽을 수 없습니다.")
    return (result.data.results ?? []).map((item) =>
      WeatherLocationSchema.parse({
        id: item.id,
        name: item.name,
        latitude: item.latitude,
        longitude: item.longitude,
        region: item.admin1 ?? "",
        country: item.country ?? "",
      })
    )
  }
  current: WeatherAPI["current"] = async (request, force = false) => {
    const parsed = WeatherLocationSchema.safeParse(request)
    if (!parsed.success) throw new Error("날씨 지역을 확인해 주세요.")
    const { latitude, longitude } = parsed.data
    const key = `${latitude},${longitude}`
    const cached = this.cache
    if (!force && cached?.key === key && cached.expires > Date.now())
      return cached.value
    const value = this.fetchCurrent(latitude, longitude)
    this.cache = { key, expires: Date.now() + 10 * 60 * 1000, value }
    try {
      return await value
    } catch (error) {
      if (this.cache?.value === value) this.cache = undefined
      throw error
    }
  }
  private async fetchCurrent(
    latitude: number,
    longitude: number
  ): Promise<WeatherReading> {
    const url = new URL("https://api.open-meteo.com/v1/forecast")
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,apparent_temperature,weather_code,is_day",
      daily: "temperature_2m_min,temperature_2m_max",
      forecast_days: "1",
      timezone: "auto",
      timeformat: "unixtime",
      temperature_unit: "celsius",
    }).toString()
    const result = CurrentSchema.safeParse(await getJSON(url))
    if (!result.success)
      throw new Error(
        "날씨 데이터가 올바르지 않습니다. 잠시 후 다시 시도해 주세요."
      )
    const { current, daily, timezone } = result.data
    return {
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      code: current.weather_code,
      isDay: current.is_day === 1,
      minimum: daily.temperature_2m_min[0],
      maximum: daily.temperature_2m_max[0],
      observedAt: current.time * 1000,
      fetchedAt: Date.now(),
      timeZone: timezone,
    }
  }
}
