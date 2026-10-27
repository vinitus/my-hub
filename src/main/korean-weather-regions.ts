import data from "./data/korean-weather-regions.json"
import type { WeatherLocation } from "../shared/weather"

const provinceAliases: Record<string, readonly string[]> = {
  서울특별시: ["서울", "서울시"],
  부산광역시: ["부산", "부산시"],
  대구광역시: ["대구", "대구시"],
  인천광역시: ["인천", "인천시"],
  광주광역시: ["광주"],
  대전광역시: ["대전", "대전시"],
  울산광역시: ["울산", "울산시"],
  세종특별자치시: ["세종", "세종시"],
  경기도: ["경기"],
  강원특별자치도: ["강원", "강원도"],
  충청북도: ["충북"],
  충청남도: ["충남"],
  전북특별자치도: ["전북", "전라북도"],
  전라남도: ["전남"],
  경상북도: ["경북"],
  경상남도: ["경남"],
  제주특별자치도: ["제주", "제주도"],
  전남광주통합특별시: ["전남광주"],
}
// 옛 광주 명칭을 통합 시도 전체에 적용하면 고흥·강진까지 검색된다.
const formerGwangjuCodes = new Set([
  "1221000000",
  "1224000000",
  "1227000000",
  "1230000000",
  "1233000000",
])
const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s·,._-]+/g, "")
const entries = data.regions.map((row) => {
  const legacyAliases =
    row.province === "전남광주통합특별시"
      ? formerGwangjuCodes.has(row.code.slice(0, 5) + "00000")
        ? ["광주", "광주시", "광주광역시"]
        : ["전남", "전라남도"]
      : []
  const provinces = [
    row.province,
    ...(provinceAliases[row.province] ?? []),
    ...legacyAliases,
  ].map(normalize)
  const district = normalize(row.district)
  const districts = district
    ? [
        ...new Set([
          district,
          district.replace(/[시군구]$/, ""),
          district.replace(/시(?=.+구$)/, "").replace(/[시군구]$/, ""),
        ]),
      ]
    : []
  const parents = district
    ? [
        ...districts,
        ...provinces.flatMap((province) =>
          districts.map((name) => province + name)
        ),
      ]
    : provinces
  const locality = normalize(row.locality)
  // '역삼동'으로도 역삼1동·역삼2동을 찾되, 결과에는 원본 행정동명을 표시한다.
  const localities = locality
    ? [...new Set([locality, locality.replace(/\d+(?=동$)/, "")])]
    : []
  const fields = [
    ...parents,
    ...localities,
    ...localities.flatMap((name) =>
      [...provinces, ...districts, ...parents].map((parent) => parent + name)
    ),
  ]
  return {
    location: {
      id: Number(row.code),
      name: row.locality || row.district || row.province,
      region: row.locality
        ? [row.province, row.district].filter(Boolean).join(" ")
        : row.district
          ? row.province
          : "",
      country: "대한민국",
      latitude: row.latitude,
      longitude: row.longitude,
    } satisfies WeatherLocation,
    fields,
    level: locality ? 2 : district ? 1 : 0,
    label: `${row.province} ${row.district} ${row.locality}`,
  }
})

// 국내 검색은 네트워크와 무관하게 끝낸다. 동명 지역은 도/광역시와 함께 반환한다.
export function searchKoreanWeatherRegions(query: string): WeatherLocation[] {
  const tokens = query
    .normalize("NFKC")
    .trim()
    .split(/[\s·,._-]+/)
    .map(normalize)
    .filter(Boolean)
  if (!tokens.length) return []
  const joined = tokens.join("")
  return entries
    .filter((entry) =>
      tokens.every((token) =>
        entry.fields.some(
          (field) =>
            field.includes(token) &&
            // 통합 명칭의 일부인 '광주'/'전남'은 위에서 구분한 옛 명칭으로만 찾는다.
            (!field.startsWith("전남광주") || token.startsWith("전남광주"))
        )
      )
    )
    .map((entry) => ({
      ...entry,
      score: entry.fields.includes(joined)
        ? 0
        : entry.fields.some((field) => field.startsWith(joined))
          ? 1
          : 2,
    }))
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.level - b.level ||
        a.label.localeCompare(b.label, "ko")
    )
    .slice(0, 20)
    .map((entry) => entry.location)
}
