import { getTimes } from 'suncalc'
import { localDateTimeToInstant } from './localDateTime'
import type { SunTimesResult } from './types'

function validDate(value: Date | null | undefined): Date | null {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value : null
}

export function calculateSunTimes(
  latitude: number,
  longitude: number,
  localDate: string,
  timeZone: string,
): SunTimesResult {
  // Local noon reliably selects the intended civil date across UTC offsets.
  const localNoon = localDateTimeToInstant(localDate, 12 * 60, timeZone)
  const times = getTimes(localNoon, latitude, longitude)

  return {
    sunrise: validDate(times.sunrise),
    solarNoon: validDate(times.solarNoon),
    sunset: validDate(times.sunset),
  }
}
