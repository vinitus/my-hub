import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useReducer,
} from "react"
import type {
  WeatherAPI,
  WeatherLocation,
  WeatherReading,
} from "../../../../../shared/weather"

type State = {
  location: WeatherLocation | null
  reading: WeatherReading | null
  loading: boolean
  busy: boolean
  error: string
}
export function weatherError(error: unknown) {
  return error instanceof Error
    ? error.message.replace(
        /^Error invoking remote method '[^']+': Error: /,
        ""
      )
    : "날씨를 불러오지 못했습니다."
}
function requireAPI(api: WeatherAPI | undefined) {
  if (
    !api ||
    [api.location, api.current, api.search, api.setLocation].some(
      (fn) => typeof fn !== "function"
    )
  )
    throw new Error(
      "날씨 연결을 위해 Electron을 닫고 pnpm dev를 다시 실행해 주세요."
    )
  return api
}

export function useWeather(api = window.api?.weather) {
  const [state, update] = useReducer(
    (previous: State, patch: Partial<State>) => ({ ...previous, ...patch }),
    {
      location: null,
      reading: null,
      loading: true,
      busy: false,
      error: "",
    }
  )
  const generation = useRef(0)
  const saving = useRef(false)
  const fetchWeather = useCallback(
    async (location: WeatherLocation, request: number, force = false) => {
      update({ loading: true, error: "" })
      try {
        const reading = await requireAPI(api).current(location, force)
        if (request === generation.current)
          update({ reading, loading: false, error: "" })
      } catch (error) {
        // 같은 지역의 이전 값은 유지하되, 늦게 온 다른 지역 응답은 무시한다.
        if (request === generation.current)
          update({ loading: false, error: weatherError(error) })
      }
    },
    [api]
  )

  useEffect(() => {
    const request = ++generation.current
    async function initialize() {
      try {
        const location = await requireAPI(api).location()
        if (request !== generation.current) return
        update({ location, loading: !!location, error: "" })
        if (location) await fetchWeather(location, request)
      } catch (error) {
        if (request === generation.current)
          update({ loading: false, error: weatherError(error) })
      }
    }
    void initialize()
    return () => {
      generation.current += 1
    }
  }, [api, fetchWeather])

  const refresh = (force = true) => {
    if (!state.location || state.loading || saving.current) return
    return fetchWeather(state.location, ++generation.current, force)
  }
  const autoRefresh = useEffectEvent((resume = false) => {
    if (
      !document.hidden &&
      (!resume ||
        !state.reading ||
        Date.now() - state.reading.fetchedAt >= 15 * 60 * 1000)
    )
      void refresh(false)
  })
  useEffect(() => {
    const timer = window.setInterval(() => autoRefresh(), 15 * 60 * 1000)
    const online = () => autoRefresh()
    const resume = () => autoRefresh(true)
    window.addEventListener("online", online)
    window.addEventListener("focus", resume)
    document.addEventListener("visibilitychange", resume)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("online", online)
      window.removeEventListener("focus", resume)
      document.removeEventListener("visibilitychange", resume)
    }
  }, [])

  const choose = async (location: WeatherLocation) => {
    if (saving.current) return false
    saving.current = true
    const request = ++generation.current
    update({ busy: true, loading: false, error: "" })
    try {
      const saved = await requireAPI(api).setLocation(location)
      if (request !== generation.current) return false
      update({ location: saved, reading: null })
      await fetchWeather(saved, request)
      return request === generation.current
    } catch (error) {
      if (request === generation.current) update({ error: weatherError(error) })
      return false
    } finally {
      saving.current = false
      if (request === generation.current) update({ busy: false })
    }
  }
  const search = async (query: string) => requireAPI(api).search(query)
  return { ...state, refresh, choose, search }
}
