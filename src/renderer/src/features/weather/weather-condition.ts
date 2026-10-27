// Open-Meteo의 WMO weather_code. 알 수 없는 코드를 맑음으로 표시하지 않는다.
export function weatherCondition(code: number): {
  label: string
  icon: "clear" | "cloud" | "fog" | "rain" | "snow" | "storm" | "unknown"
} {
  if (code === 0) return { label: "맑음", icon: "clear" }
  if ([1, 2].includes(code)) return { label: "구름 조금", icon: "cloud" }
  if (code === 3) return { label: "흐림", icon: "cloud" }
  if ([45, 48].includes(code)) return { label: "안개", icon: "fog" }
  if ([51, 53, 55, 56, 57].includes(code))
    return { label: "이슬비", icon: "rain" }
  if ([61, 63, 65, 66, 67].includes(code)) return { label: "비", icon: "rain" }
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { label: "눈", icon: "snow" }
  if ([80, 81, 82].includes(code)) return { label: "소나기", icon: "rain" }
  if ([95, 96, 99].includes(code)) return { label: "뇌우", icon: "storm" }
  return { label: "날씨 정보", icon: "unknown" }
}
