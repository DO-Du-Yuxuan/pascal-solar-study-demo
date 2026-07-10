import { describe, expect, it } from 'vitest'
import { calculateSolarState } from './calculateSolarState'
import { calculateSunTimes } from './calculateSunTimes'
import { localDateTimeToInstant } from './localDateTime'
import {
  solarToWorldDirection,
  sunCalcAzimuthToCompassDeg,
} from './solarToWorldDirection'
import type { SolarInput } from './types'

const bellevue: SolarInput = {
  latitude: 47.6101,
  longitude: -122.2015,
  timeZone: 'America/Los_Angeles',
  localDate: '2026-06-21',
  localTimeMinutes: 12 * 60,
  northOffsetDeg: 0,
}

describe('solar coordinate conventions', () => {
  it('normalizes SunCalc v2 azimuth to north=0 and east=90', () => {
    expect(sunCalcAzimuthToCompassDeg(0)).toBe(0)
    expect(sunCalcAzimuthToCompassDeg(90)).toBe(90)
    expect(sunCalcAzimuthToCompassDeg(-90)).toBe(270)
    expect(sunCalcAzimuthToCompassDeg(450)).toBe(90)
  })

  it('maps compass directions when northOffsetDeg is 0', () => {
    expect(solarToWorldDirection(0, 0, 0)).toEqual([0, 0, 1])
    const east = solarToWorldDirection(0, 90, 0)
    expect(east[0]).toBeCloseTo(1, 10)
    expect(east[2]).toBeCloseTo(0, 10)
  })

  it('maps true north to +X when northOffsetDeg is 90', () => {
    const direction = solarToWorldDirection(0, 0, 90)
    expect(direction[0]).toBeCloseTo(1, 10)
    expect(direction[2]).toBeCloseTo(0, 10)
  })

  it('always returns a unit vector', () => {
    const direction = solarToWorldDirection(37.4, 218.3, 31)
    expect(Math.hypot(...direction)).toBeCloseTo(1, 12)
  })
})

describe('solar state', () => {
  it('reports the Sun below the horizon at Bellevue midnight', () => {
    const state = calculateSolarState({ ...bellevue, localTimeMinutes: 0 })
    expect(state.altitudeDeg).toBeLessThan(0)
    expect(state.isAboveHorizon).toBe(false)
  })

  it('places the summer noon Sun higher than the morning Sun', () => {
    const morning = calculateSolarState({ ...bellevue, localTimeMinutes: 7 * 60 })
    const noon = calculateSolarState({ ...bellevue, localTimeMinutes: 13 * 60 })
    expect(noon.altitudeDeg).toBeGreaterThan(morning.altitudeDeg)
    expect(noon.altitudeDeg).toBeGreaterThan(60)
  })

  it('orders sunrise, solar noon, and sunset', () => {
    const times = calculateSunTimes(
      bellevue.latitude,
      bellevue.longitude,
      bellevue.localDate,
      bellevue.timeZone,
    )
    expect(times.sunrise).not.toBeNull()
    expect(times.solarNoon).not.toBeNull()
    expect(times.sunset).not.toBeNull()
    expect(times.sunrise!.getTime()).toBeLessThan(times.solarNoon!.getTime())
    expect(times.solarNoon!.getTime()).toBeLessThan(times.sunset!.getTime())
  })

  it('converts local civil time independently of the test machine time zone', () => {
    const winter = localDateTimeToInstant(
      '2026-01-15',
      12 * 60,
      'America/Los_Angeles',
    )
    const summer = localDateTimeToInstant(
      '2026-07-15',
      12 * 60,
      'America/Los_Angeles',
    )
    expect(winter.toISOString()).toBe('2026-01-15T20:00:00.000Z')
    expect(summer.toISOString()).toBe('2026-07-15T19:00:00.000Z')
  })
})
