import { create } from 'zustand'
import { DEFAULT_SOLAR_INPUT } from '../solar'
import type { WeatherMode } from '../weather/types'

interface SimulationState {
  latitude: number
  longitude: number
  timeZone: string
  localDate: string
  localTimeMinutes: number
  northOffsetDeg: number
  dayPlaying: boolean
  dayLoop: boolean
  daySpeed: number
  yearPlaying: boolean
  yearLoop: boolean
  yearSpeed: number
  showAxes: boolean
  showGrid: boolean
  showSunPath: boolean
  weatherMode: WeatherMode
  setLatitude: (value: number) => void
  setLongitude: (value: number) => void
  setTimeZone: (value: string) => void
  setLocalDate: (value: string) => void
  setLocalTimeMinutes: (value: number) => void
  setLocalDateTime: (localDate: string, localTimeMinutes: number) => void
  setNorthOffsetDeg: (value: number) => void
  setDayPlaying: (value: boolean) => void
  setDayLoop: (value: boolean) => void
  setDaySpeed: (value: number) => void
  setYearPlaying: (value: boolean) => void
  setYearLoop: (value: boolean) => void
  setYearSpeed: (value: number) => void
  setShowAxes: (value: boolean) => void
  setShowGrid: (value: boolean) => void
  setShowSunPath: (value: boolean) => void
  setWeatherMode: (value: WeatherMode) => void
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

function force2025(localDate: string): string {
  const candidate = `2025-${localDate.slice(5)}`
  return Number.isNaN(Date.parse(`${candidate}T00:00:00Z`)) ? '2025-02-28' : candidate
}

export const useSimulationStore = create<SimulationState>((set) => ({
  ...DEFAULT_SOLAR_INPUT,
  // 2025-06-09 has the strongest daily DNI total in the bundled NASA POWER data
  // with negligible precipitation, so it is a useful clear-weather default.
  localDate: '2025-06-09',
  dayPlaying: false,
  dayLoop: true,
  daySpeed: 15,
  yearPlaying: false,
  yearLoop: true,
  yearSpeed: 0.5,
  showAxes: false,
  showGrid: true,
  showSunPath: true,
  weatherMode: 'nasa-power-2025',
  setLatitude: (latitude) => set({ latitude: clamp(latitude, -90, 90) }),
  setLongitude: (longitude) => set({ longitude: clamp(longitude, -180, 180) }),
  setTimeZone: (timeZone) => set({ timeZone }),
  setLocalDate: (localDate) => set((state) => ({ localDate: state.weatherMode === 'nasa-power-2025' ? force2025(localDate) : localDate })),
  setLocalTimeMinutes: (localTimeMinutes) =>
    set({ localTimeMinutes: clamp(Math.round(localTimeMinutes), 0, 1439) }),
  setLocalDateTime: (localDate, localTimeMinutes) => set((state) => ({
    localDate: state.weatherMode === 'nasa-power-2025' ? force2025(localDate) : localDate,
    localTimeMinutes: clamp(Math.round(localTimeMinutes), 0, 1439),
  })),
  setNorthOffsetDeg: (northOffsetDeg) =>
    set({ northOffsetDeg: ((northOffsetDeg % 360) + 360) % 360 }),
  setDayPlaying: (dayPlaying) =>
    set(() => dayPlaying ? { dayPlaying, yearPlaying: false } : { dayPlaying }),
  setDayLoop: (dayLoop) => set({ dayLoop }),
  setDaySpeed: (daySpeed) => set({ daySpeed }),
  setYearPlaying: (yearPlaying) =>
    set(() => yearPlaying ? { yearPlaying, dayPlaying: false } : { yearPlaying }),
  setYearLoop: (yearLoop) => set({ yearLoop }),
  setYearSpeed: (yearSpeed) => set({ yearSpeed }),
  setShowAxes: (showAxes) => set({ showAxes }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setShowSunPath: (showSunPath) => set({ showSunPath }),
  setWeatherMode: (weatherMode) => set((state) => ({
    weatherMode,
    localDate: weatherMode === 'nasa-power-2025' ? force2025(state.localDate) : state.localDate,
    latitude: weatherMode === 'nasa-power-2025' ? 47.6101 : state.latitude,
    longitude: weatherMode === 'nasa-power-2025' ? -122.2015 : state.longitude,
    timeZone: weatherMode === 'nasa-power-2025' ? 'America/Los_Angeles' : state.timeZone,
    yearPlaying: false,
  })),
}))
