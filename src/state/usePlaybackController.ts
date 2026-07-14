import { useEffect } from 'react'
import {
  getYear,
} from '../solar'
import { useSimulationStore } from './simulationStore'
import { advanceYearMinuteCursor, fromYearMinuteCursor, toYearMinuteCursor } from './yearCycle'

export function usePlaybackController(): void {
  useEffect(() => {
    let animationFrame = 0
    let previousTime = performance.now()
    let minuteCursor = useSimulationStore.getState().localTimeMinutes
    let yearCursor = toYearMinuteCursor(
      useSimulationStore.getState().localDate,
      useSimulationStore.getState().localTimeMinutes,
    )
    let cursorYear = getYear(useSimulationStore.getState().localDate)

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
        const year = getYear(state.localDate)
        const currentCursor = toYearMinuteCursor(state.localDate, state.localTimeMinutes)
        if (year !== cursorYear || Math.abs(currentCursor - Math.floor(yearCursor)) > 2) {
          cursorYear = year
          yearCursor = currentCursor
        }
        const advanced = advanceYearMinuteCursor(yearCursor, state.yearSpeed * deltaSeconds, year, state.yearLoop)
        yearCursor = advanced.cursor
        const next = fromYearMinuteCursor(year, yearCursor)
        if (next.localDate !== state.localDate || next.localTimeMinutes !== state.localTimeMinutes) {
          state.setLocalDateTime(next.localDate, next.localTimeMinutes)
        }
        if (advanced.completed) state.setYearPlaying(false)
      } else {
        cursorYear = getYear(state.localDate)
        yearCursor = toYearMinuteCursor(state.localDate, state.localTimeMinutes)
      }

      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [])
}
