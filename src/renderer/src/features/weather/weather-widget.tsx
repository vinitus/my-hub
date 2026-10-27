import { useState } from "react"
import {
  CloudIcon,
  CloudFogIcon,
  CloudLightningIcon,
  CloudRainIcon,
  CloudSnowIcon,
  MapPinIcon,
  MoonIcon,
  RefreshCwIcon,
  SearchIcon,
  SunIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import type { WeatherLocation } from "../../../../shared/weather"
import { useWeather, weatherError } from "./use-weather"
import { weatherCondition } from "./weather-condition"

const icons = {
  clear: SunIcon,
  cloud: CloudIcon,
  fog: CloudFogIcon,
  rain: CloudRainIcon,
  snow: CloudSnowIcon,
  storm: CloudLightningIcon,
  unknown: CloudIcon,
}
function regionLabel(location: WeatherLocation) {
  return [...new Set([location.region, location.country].filter(Boolean))].join(
    " · "
  )
}

export function WeatherWidget() {
  const state = useWeather()
  const [editing, setEditing] = useState(false)
  const { location, reading, loading } = state
  const condition = weatherCondition(reading?.code ?? -1)
  const Icon =
    condition.icon === "clear" && !reading?.isDay
      ? MoonIcon
      : icons[condition.icon]
  let observed = ""
  if (reading) {
    try {
      observed = new Date(reading.observedAt).toLocaleTimeString("ko-KR", {
        timeZone: reading.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    } catch {
      observed = "최근"
    }
  }
  return (
    <>
      <section
        aria-label="날씨"
        className="rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3"
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded text-left text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            title={
              location
                ? `${location.name} · ${regionLabel(location)} (지역 변경)`
                : "날씨 지역 선택"
            }
          >
            <MapPinIcon className="size-3 shrink-0" />
            <span className="truncate">
              {location?.name ?? "날씨 지역 선택"}
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="날씨 새로고침"
            disabled={!location || loading || state.busy}
            onClick={() => void state.refresh()}
          >
            <RefreshCwIcon className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
        {reading ? (
          <div
            className="mt-2 flex items-center justify-between gap-3"
            title={`체감 ${Math.round(reading.feelsLike)}°C · ${observed} 기준`}
          >
            <div className="flex items-center gap-2.5">
              <Icon
                className="size-7 text-sidebar-foreground/70"
                aria-hidden="true"
              />
              <span className="text-2xl font-medium tracking-tight tabular-nums">
                {Math.round(reading.temperature)}
                <span className="text-sm">°C</span>
              </span>
            </div>
            <div className="text-right text-xs">
              <p>{condition.label}</p>
              <p className="mt-1 text-muted-foreground">
                {Math.round(reading.minimum)}° / {Math.round(reading.maximum)}°
              </p>
            </div>
          </div>
        ) : (
          <p
            role="status"
            className="mt-2 text-xs leading-5 text-muted-foreground"
          >
            {loading
              ? "날씨를 불러오는 중…"
              : location
                ? "날씨를 불러오지 못했습니다."
                : "지역을 선택하면 날씨가 표시됩니다."}
          </p>
        )}
        {state.error && (
          <p
            role="status"
            className="mt-2 text-[11px] leading-4 text-muted-foreground"
          >
            {reading ? "갱신 실패 · 이전 정보를 표시합니다." : state.error}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>{reading ? `${observed} 기준` : "현재 날씨"}</span>
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
          >
            Open-Meteo
          </a>
        </div>
      </section>
      {editing && (
        <WeatherLocationSheet
          onSearch={state.search}
          onChoose={state.choose}
          busy={state.busy}
          error={state.error}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}

function WeatherLocationSheet({
  onSearch,
  onChoose,
  busy,
  error,
  onClose,
}: {
  onSearch: (query: string) => Promise<WeatherLocation[]>
  onChoose: (location: WeatherLocation) => Promise<boolean>
  busy: boolean
  error: string
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<WeatherLocation[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchError, setSearchError] = useState("")
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <SheetContent className="w-full sm:max-w-md" showCloseButton={!busy}>
        <SheetHeader>
          <SheetTitle>날씨 지역 선택</SheetTitle>
          <SheetDescription>
            국내 시·도, 시·군·구, 읍·면·동을 한글로 검색하세요. 동은 행정동
            기준입니다. 해외 도시는 영문으로 검색할 수 있습니다.
          </SheetDescription>
          <a
            href="https://www.data.go.kr/data/15084084/openapi.do"
            target="_blank"
            rel="noreferrer"
            className="w-fit text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          >
            국내 지역 자료: 기상청
          </a>
        </SheetHeader>
        <form
          className="flex gap-2 px-4"
          onSubmit={async (event) => {
            event.preventDefault()
            if (searching || busy || query.trim().length < 2) return
            setSearching(true)
            setSearchError("")
            setResults([])
            try {
              setResults(await onSearch(query.trim()))
              setSearched(true)
            } catch (cause) {
              setSearchError(weatherError(cause))
            } finally {
              setSearching(false)
            }
          }}
        >
          <Input
            autoFocus
            aria-label="날씨 지역 검색"
            placeholder="서울, 강남구 역삼동, 제주 애월읍…"
            maxLength={80}
            value={query}
            disabled={searching || busy}
            onChange={(event) => {
              setQuery(event.target.value)
              setResults([])
              setSearched(false)
              setSearchError("")
            }}
          />
          <Button
            type="submit"
            size="icon"
            aria-label="지역 검색"
            disabled={searching || busy || query.trim().length < 2}
          >
            <SearchIcon />
          </Button>
        </form>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {(searchError || error) && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {searchError || error}
            </p>
          )}
          {searching && (
            <p role="status" className="py-4 text-sm text-muted-foreground">
              지역을 검색하는 중…
            </p>
          )}
          {!searching && searched && !results.length && !searchError && (
            <p role="status" className="py-4 text-sm text-muted-foreground">
              검색 결과가 없습니다. 국내는 시·군·구나 읍·면·행정동 이름으로,
              해외는 영문 도시 이름으로 검색해 주세요.
            </p>
          )}
          <ul className="grid gap-2">
            {results.map((location) => (
              <li key={location.id}>
                <button
                  type="button"
                  disabled={busy}
                  className="w-full rounded-lg border p-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  onClick={async () => {
                    if (await onChoose(location)) onClose()
                  }}
                >
                  <span className="block text-sm font-medium">
                    {location.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {regionLabel(location)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {busy && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              지역을 저장하고 날씨를 불러오는 중…
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
