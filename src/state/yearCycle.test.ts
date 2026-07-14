import { describe, expect, it } from 'vitest'
import { advanceYearMinuteCursor, fromYearMinuteCursor, toYearMinuteCursor } from './yearCycle'

describe('year cycle playback', () => {
  it('advances through time and into the next local date', () => {
    const start = toYearMinuteCursor('2026-06-21', 18 * 60)
    const advanced = advanceYearMinuteCursor(start, 0.5, 2026, true)
    expect(fromYearMinuteCursor(2026, advanced.cursor)).toEqual({
      localDate: '2026-06-22',
      localTimeMinutes: 6 * 60,
    })
  })

  it('loops from the end of the year to January 1', () => {
    const start = toYearMinuteCursor('2026-12-31', 18 * 60)
    const advanced = advanceYearMinuteCursor(start, 0.5, 2026, true)
    expect(fromYearMinuteCursor(2026, advanced.cursor)).toEqual({
      localDate: '2026-01-01',
      localTimeMinutes: 6 * 60,
    })
  })
})
