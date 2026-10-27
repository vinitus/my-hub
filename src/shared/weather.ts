import { z } from "zod"

export const WeatherLocationSchema = z
  .object({
    id: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(120),
    region: z.string().max(120),
    country: z.string().max(120),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict()
export type WeatherLocation = z.infer<typeof WeatherLocationSchema>
export type WeatherReading = {
  temperature: number
  feelsLike: number
  code: number
  isDay: boolean
  minimum: number
  maximum: number
  observedAt: number
  fetchedAt: number
  timeZone: string
}
export type WeatherAPI = {
  location: () => Promise<WeatherLocation | null>
  setLocation: (location: WeatherLocation) => Promise<WeatherLocation>
  search: (query: string) => Promise<WeatherLocation[]>
  current: (
    location: WeatherLocation,
    force?: boolean
  ) => Promise<WeatherReading>
}
