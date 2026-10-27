import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { WeatherService } from "../src/main/weather-service"
import { registerWeather } from "../src/main/weather"
import { weatherCondition } from "../src/renderer/src/features/weather/weather-condition"
import { searchKoreanWeatherRegions } from "../src/main/korean-weather-regions"
import regions from "../src/main/data/korean-weather-regions.json"
import type { WeatherLocation, WeatherReading } from "../src/shared/weather"
import { app, BrowserWindow, handlers } from "./fakes/electron"

const seoul: WeatherLocation = {
  id: 1835848,
  name: "서울",
  region: "서울",
  country: "대한민국",
  latitude: 37.566,
  longitude: 126.978,
}
const busan: WeatherLocation = {
  ...seoul,
  id: 1838524,
  name: "부산",
  latitude: 35.18,
  longitude: 129.07,
}
const reading: WeatherReading = {
  temperature: 16.1,
  feelsLike: 14.8,
  code: 0,
  isDay: true,
  minimum: 9.2,
  maximum: 19.1,
  observedAt: 1793055600000,
  fetchedAt: 1793056500000,
  timeZone: "Asia/Seoul",
}
const apiResponse = {
  timezone: "Asia/Seoul",
  current: {
    time: reading.observedAt / 1000,
    temperature_2m: 16.1,
    apparent_temperature: 14.8,
    weather_code: 0,
    is_day: 1,
  },
  daily: { temperature_2m_min: [9.2], temperature_2m_max: [19.1] },
}
async function directory() {
  return mkdtemp(join(tmpdir(), "my-hub-weather-test-"))
}

test("지역 설정만 저장하고 재실행 후 복원하며 잘못된 좌표는 기존 설정을 보존한다", async () => {
  const dir = await directory()
  try {
    const service = new WeatherService(dir)
    assert.equal(await service.location(), null)
    await service.setLocation(seoul)
    assert.deepEqual(await new WeatherService(dir).location(), seoul)
    const before = await readFile(join(dir, "weather-settings.json"), "utf8")
    await assert.rejects(
      service.setLocation({ ...seoul, latitude: 91 }),
      /지역을 확인/
    )
    assert.equal(
      await readFile(join(dir, "weather-settings.json"), "utf8"),
      before
    )
    assert.deepEqual(await readdir(dir), ["weather-settings.json"])
    await writeFile(join(dir, "weather-settings.json"), "{broken")
    await assert.rejects(service.location(), /다시 선택/)
    assert.equal(
      await readFile(join(dir, "weather-settings.json"), "utf8"),
      "{broken"
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("해외 영문 검색은 기존 API에서 한국어 결과를 받고 빈 결과와 잘못된 입력을 처리한다", async () => {
  const previous = globalThis.fetch
  const dir = await directory()
  const paris = {
    ...seoul,
    id: 2988507,
    name: "파리",
    region: "일드프랑스",
    country: "프랑스",
    latitude: 48.8534,
    longitude: 2.3488,
  }
  try {
    const service = new WeatherService(dir)
    globalThis.fetch = async (input) => {
      const url = new URL(String(input))
      assert.equal(url.origin, "https://geocoding-api.open-meteo.com")
      assert.equal(url.searchParams.get("name"), "Paris")
      assert.equal(url.searchParams.get("language"), "ko")
      return Response.json({
        results: [
          {
            id: paris.id,
            name: paris.name,
            latitude: paris.latitude,
            longitude: paris.longitude,
            country: paris.country,
            admin1: paris.region,
          },
        ],
      })
    }
    assert.deepEqual(await service.search(" Paris "), [paris])
    await assert.rejects(service.search("서"), /2~80/)
    globalThis.fetch = async () => Response.json({})
    assert.deepEqual(await service.search("NoSuchCity"), [])
  } finally {
    globalThis.fetch = previous
    await rm(dir, { recursive: true, force: true })
  }
})

test("현재 날씨는 섭씨·도시 시간대·하루 예보로 조회하고 동일 좌표 요청을 캐시한다", async () => {
  const previous = globalThis.fetch
  const dir = await directory()
  let count = 0
  try {
    globalThis.fetch = async (input) => {
      count++
      const url = new URL(String(input))
      assert.equal(url.origin, "https://api.open-meteo.com")
      assert.equal(url.searchParams.get("latitude"), String(seoul.latitude))
      assert.equal(url.searchParams.get("temperature_unit"), "celsius")
      assert.equal(url.searchParams.get("timezone"), "auto")
      assert.equal(url.searchParams.get("forecast_days"), "1")
      assert.equal(url.searchParams.get("timeformat"), "unixtime")
      return Response.json(apiResponse)
    }
    const service = new WeatherService(dir)
    const [first, second] = await Promise.all([
      service.current(seoul),
      service.current(seoul),
    ])
    assert.equal(count, 1)
    assert.deepEqual(first, second)
    assert.equal(first.observedAt, reading.observedAt)
    assert.equal(first.minimum, reading.minimum)
    assert.equal(first.isDay, true)
    await assert.rejects(
      service.current({ ...seoul, longitude: 181 }),
      /지역을 확인/
    )
    assert.equal(count, 1)
  } finally {
    globalThis.fetch = previous
    await rm(dir, { recursive: true, force: true })
  }
})

test("요청 실패는 캐시하지 않고 재시도하며 불완전한 날씨를 정상 값으로 표시하지 않는다", async () => {
  const previous = globalThis.fetch
  const dir = await directory()
  try {
    const service = new WeatherService(dir)
    globalThis.fetch = async () => new Response(null, { status: 429 })
    await assert.rejects(service.current(seoul), /잠시 후/)
    globalThis.fetch = async () =>
      Response.json({ current: { temperature_2m: null } })
    await assert.rejects(service.current(seoul), /올바르지 않습니다/)
    globalThis.fetch = async () => {
      throw new Error("offline")
    }
    await assert.rejects(service.current(seoul), /인터넷 연결/)
    globalThis.fetch = async () => Response.json(apiResponse)
    assert.equal((await service.current(seoul)).temperature, 16.1)
  } finally {
    globalThis.fetch = previous
    await rm(dir, { recursive: true, force: true })
  }
})

test("수동 갱신은 캐시를 건너뛰고 마지막 지역 한 개만 캐시한다", async () => {
  const previous = globalThis.fetch
  const dir = await directory()
  let count = 0
  try {
    globalThis.fetch = async () =>
      Response.json({
        ...apiResponse,
        current: { ...apiResponse.current, temperature_2m: ++count },
      })
    const service = new WeatherService(dir)
    assert.equal((await service.current(seoul)).temperature, 1)
    assert.equal((await service.current(seoul)).temperature, 1)
    assert.equal((await service.current(seoul, true)).temperature, 2)
    assert.equal((await service.current(seoul)).temperature, 2)
    await service.current(busan)
    assert.equal((await service.current(seoul)).temperature, 4)
  } finally {
    globalThis.fetch = previous
    await rm(dir, { recursive: true, force: true })
  }
})

test("이전 요청의 늦은 실패가 새 갱신의 캐시를 지우지 않는다", async () => {
  const previous = globalThis.fetch
  const dir = await directory()
  let rejectFirst!: (error: Error) => void
  let count = 0
  try {
    globalThis.fetch = async () => {
      count++
      if (count === 1)
        return new Promise<Response>((_, reject) => {
          rejectFirst = reject
        })
      return Response.json(apiResponse)
    }
    const service = new WeatherService(dir)
    const first = assert.rejects(service.current(seoul), /인터넷 연결/)
    await service.current(seoul, true)
    rejectFirst(new Error("offline"))
    await first
    await service.current(seoul)
    assert.equal(count, 2)
  } finally {
    globalThis.fetch = previous
    await rm(dir, { recursive: true, force: true })
  }
})

test("날씨 IPC는 다른 창과 하위 프레임 요청을 거부하고 닫을 때 정리한다", async () => {
  const dir = await directory(),
    previous = app.paths.userData
  const window = new BrowserWindow()
  app.paths.userData = dir
  try {
    registerWeather(window as never)
    for (const channel of ["location", "set-location", "search", "current"]) {
      const handler = handlers.get(`weather:${channel}`)!
      assert.throws(() => handler({ sender: {} }, seoul), /허용되지 않은/)
      assert.throws(
        () => handler({ sender: window.webContents, senderFrame: {} }, seoul),
        /허용되지 않은/
      )
    }
    await handlers.get("weather:set-location")!(window.event(), seoul)
    assert.deepEqual(
      await handlers.get("weather:location")!(window.event()),
      seoul
    )
  } finally {
    window.close()
    app.paths.userData = previous
    await rm(dir, { recursive: true, force: true })
  }
  assert.equal(handlers.has("weather:current"), false)
})

test("비·눈·뇌우와 알 수 없는 날씨를 구분한다", () => {
  assert.equal(weatherCondition(61).label, "비")
  assert.equal(weatherCondition(85).icon, "snow")
  assert.equal(weatherCondition(99).icon, "storm")
  assert.equal(weatherCondition(123).icon, "unknown")
})

test("날씨 IPC는 새로고침 옵션을 전달하고 잘못된 옵션을 거부한다", async () => {
  const dir = await directory()
  const previousPath = app.paths.userData
  const previousFetch = globalThis.fetch
  const window = new BrowserWindow()
  let count = 0
  app.paths.userData = dir
  try {
    globalThis.fetch = async () => {
      count++
      return Response.json(apiResponse)
    }
    registerWeather(window as never)
    const current = handlers.get("weather:current")!
    await current(window.event(), { location: seoul })
    await current(window.event(), { location: seoul, force: false })
    assert.equal(count, 1)
    await current(window.event(), { location: seoul, force: true })
    assert.equal(count, 2)
    assert.throws(() =>
      current(window.event(), { location: seoul, force: "true" })
    )
    assert.equal(count, 2)
  } finally {
    window.close()
    app.paths.userData = previousPath
    globalThis.fetch = previousFetch
    await rm(dir, { recursive: true, force: true })
  }
})

test("국내 검색은 인터넷 없이 두 글자 한글과 정식 명칭·띄어쓰기·복합 지역명을 처리한다", async () => {
  const previous = globalThis.fetch
  const dir = await directory()
  globalThis.fetch = async () => {
    throw new Error("국내 검색에서는 호출하면 안 됨")
  }
  try {
    const service = new WeatherService(dir)
    assert.equal((await service.search("서울"))[0].name, "서울특별시")
    assert.equal((await service.search("서울시"))[0].name, "서울특별시")
    assert.equal((await service.search("서울특별시"))[0].name, "서울특별시")
    for (const query of ["서울 강남구", "서울강남구", " 서울   강남 "]) {
      const result = await service.search(query)
      assert.equal(result[0].name, "강남구")
      assert.equal(result[0].region, "서울특별시")
    }
    assert.equal((await service.search("부산 해운대"))[0].name, "해운대구")
    assert.equal((await service.search("경기 성남 분당"))[0].region, "경기도")
    assert.equal((await service.search("세종"))[0].name, "세종특별자치시")
    assert.equal(
      (await service.search("강원도 춘천"))[0].region,
      "강원특별자치도"
    )
    assert.equal(
      (await service.search("전라북도 전주"))[0].region,
      "전북특별자치도"
    )
    assert.deepEqual(await service.search("없는지역"), [])
  } finally {
    globalThis.fetch = previous
    await rm(dir, { recursive: true, force: true })
  }
})

test("동명 구·군은 시도 정보를 유지하고 빈 쿼리는 모든 지역을 반환하지 않는다", () => {
  const gangseo = searchKoreanWeatherRegions("강서구")
  assert.ok(gangseo.some((item) => item.region === "서울특별시"))
  assert.ok(gangseo.some((item) => item.region === "부산광역시"))
  const busanGangseo = searchKoreanWeatherRegions("부산 강서구")
  assert.equal(busanGangseo[0].name, "강서구")
  assert.ok(busanGangseo.every((item) => item.region.startsWith("부산광역시")))
  const goseong = searchKoreanWeatherRegions("고성군")
  assert.ok(goseong.some((item) => item.region === "강원특별자치도"))
  assert.ok(goseong.some((item) => item.region === "경상남도"))
  assert.deepEqual(searchKoreanWeatherRegions("  "), [])
})

test("옛 광주 명칭은 해당 5개 구에만 연결하고 전남 전체로 확장하지 않는다", () => {
  const result = searchKoreanWeatherRegions("광주광역시")
  assert.equal(result.length, 20)
  assert.deepEqual(
    new Set(result.slice(0, 5).map((item) => item.name)),
    new Set(["동구", "서구", "남구", "북구", "광산구"])
  )
  assert.equal(searchKoreanWeatherRegions("광주 남구")[0].name, "남구")
  const ambiguous = searchKoreanWeatherRegions("광주")
  assert.equal(ambiguous.length, 20)
  assert.ok(
    ambiguous.some((item) => item.name === "광주시" && item.region === "경기도")
  )
  assert.equal(searchKoreanWeatherRegions("전남 고흥")[0].name, "고흥군")
  assert.deepEqual(searchKoreanWeatherRegions("전남 광산구"), [])
  const locality = searchKoreanWeatherRegions("광주광역시 충장동")
  assert.equal(locality.length, 1)
  assert.equal(locality[0].region, "전남광주통합특별시 동구")
  assert.deepEqual(searchKoreanWeatherRegions("전남 충장동"), [])
})

test("읍면동은 상위 시군구와 함께 검색하며 선택한 지역의 원본 좌표를 반환한다", async () => {
  const previous = globalThis.fetch
  const dir = await directory()
  globalThis.fetch = async () => {
    throw new Error("Local search must remain offline")
  }
  try {
    const service = new WeatherService(dir)
    for (const query of ["역삼1동", "서울 강남구 역삼1동", "서울강남역삼1동"]) {
      const result = await service.search(query)
      assert.equal(result.length, 1)
      assert.deepEqual(result[0], {
        id: 1168064000,
        name: "역삼1동",
        region: "서울특별시 강남구",
        country: "대한민국",
        latitude: 37.4925833,
        longitude: 127.0351444,
      })
      await service.setLocation(result[0])
      assert.deepEqual(await new WeatherService(dir).location(), result[0])
    }
    const yeoksam = await service.search("강남구 역삼동")
    assert.deepEqual(
      new Set(yeoksam.map((item) => item.name)),
      new Set(["역삼1동", "역삼2동"])
    )
    const aewol = (await service.search("제주 애월읍"))[0]
    assert.equal(aewol.name, "애월읍")
    assert.equal(aewol.region, "제주특별자치도 제주시")
    assert.equal((await service.search("경기 양평 청운면"))[0].name, "청운면")
  } finally {
    globalThis.fetch = previous
    await rm(dir, { recursive: true, force: true })
  }
})

test("동명이 여러 곳이면 시도·시군구로 구분하고 넓은 검색은 대표 지역부터 표시한다", () => {
  const central = searchKoreanWeatherRegions("중앙동")
  assert.ok(new Set(central.map((item) => item.region)).size > 1)
  const specific = searchKoreanWeatherRegions("서울 관악 중앙동")
  assert.equal(specific.length, 1)
  assert.equal(specific[0].region, "서울특별시 관악구")
  assert.equal(searchKoreanWeatherRegions("서울")[0].name, "서울특별시")
  assert.equal(searchKoreanWeatherRegions("강남구")[0].name, "강남구")
  assert.equal(searchKoreanWeatherRegions("서울").length, 20)
})

test("국내 데이터는 원본 코드가 중복되지 않고 유효한 대표 위경도와 출처를 포함한다", () => {
  assert.ok(regions.regions.length >= 250)
  assert.ok(regions.regions.filter((item) => item.locality).length > 3000)
  assert.equal(
    new Set(regions.regions.map((item) => item.code)).size,
    regions.regions.length
  )
  assert.match(regions.source.page, /^https:\/\/www\.data\.go\.kr\//)
  assert.match(regions.source.sha256, /^[a-f0-9]{64}$/)
  for (const item of regions.regions) {
    assert.equal(typeof item.locality, "string")
    assert.match(item.code, /^\d{10}$/)
    assert.ok(item.latitude >= 33 && item.latitude <= 39.5)
    assert.ok(item.longitude >= 124 && item.longitude <= 132)
  }
})
