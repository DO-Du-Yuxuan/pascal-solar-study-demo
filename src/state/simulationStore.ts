import { create } from 'zustand'
import { DEFAULT_SOLAR_INPUT } from '../solar'

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
  setLatitude: (value: number) => void
  setLongitude: (value: number) => void
  setTimeZone: (value: string) => void
  setLocalDate: (value: string) => void
  setLocalTimeMinutes: (value: number) => void
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
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

export const useSimulationStore = create<SimulationState>((set) => ({
  ...DEFAULT_SOLAR_INPUT,
  dayPlaying: false,
  dayLoop: true,
  daySpeed: 15,
  yearPlaying: false,
  yearLoop: true,
  yearSpeed: 10,
  showAxes: false,
  showGrid: true,
  showSunPath: true,
  setLatitude: (latitude) => set({ latitude: clamp(latitude, -90, 90) }),
  setLongitude: (longitude) => set({ longitude: clamp(longitude, -180, 180) }),
  setTimeZone: (timeZone) => set({ timeZone }),
  setLocalDate: (localDate) => set({ localDate }),
  setLocalTimeMinutes: (localTimeMinutes) =>
    set({ localTimeMinutes: clamp(Math.round(localTimeMinutes), 0, 1439) }),
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
}))
