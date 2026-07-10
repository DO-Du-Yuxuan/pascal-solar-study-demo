import { useEffect } from 'react'
import {
  dateFromDayOfYear,
  daysInYear,
  getDayOfYear,
  getYear,
} from '../solar'
import { useSimulationStore } from './simulationStore'

export function usePlaybackController(): void {
  useEffect(() => {
    let animationFrame = 0
    let previousTime = performance.now()
    let minuteCursor = useSimulationStore.getState().localTimeMinutes
    let dayCursor = getDayOfYear(useSimulationStore.getState().localDate)

    const animate = (now: number) => {
      const deltaSeconds = Math.min((now - previousTime) / 1000, 0.25)
      previousTime = now
      const state = useSimulationStore.getState()

      if (state.dayPlaying) {
        if (Math.abs(state.localTimeMinutes - Math.floor(minuteCursor)) > 1) {
          minuteCursor = state.localTimeMinutes
        }
        minuteCursor += state.daySpeed * deltaSeconds
        if (minuteCursor >= 1440) {
          if (state.dayLoop) minuteCursor %= 1440
          else {
            minuteCursor = 1439
            state.setDayPlaying(false)
          }
        }
        const nextMinute = Math.floor(minuteCursor)
        if (nextMinute !== state.localTimeMinutes) state.setLocalTimeMinutes(nextMinute)
      } else {
        minuteCursor = state.localTimeMinutes
      }

      if (state.yearPlaying) {
        const currentOrdinal = getDayOfYear(state.localDate)
        if (Math.abs(currentOrdinal - Math.floor(dayCursor)) > 1) dayCursor = currentOrdinal
        const year = getYear(state.localDate)
        const maximum = daysInYear(year)
        dayCursor += state.yearSpeed * deltaSeconds
        if (dayCursor > maximum) {
          if (state.yearLoop) dayCursor = 1 + ((dayCursor - 1) % maximum)
          else {
            dayCursor = maximum
            state.setYearPlaying(false)
          }
        }
        const nextOrdinal = Math.floor(dayCursor)
        if (nextOrdinal !== currentOrdinal) {
          state.setLocalDate(dateFromDayOfYear(year, nextOrdinal))
        }
      } else {
        dayCursor = getDayOfYear(state.localDate)
      }

      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [])
}
