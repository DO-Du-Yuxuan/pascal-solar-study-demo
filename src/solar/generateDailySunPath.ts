import { getPosition } from 'suncalc'
import { SUN_PATH_INTERVAL_MINUTES } from './constants'
import { localDateTimeToInstant } from './localDateTime'
import {
  solarToWorldDirection,
  sunCalcAzimuthToCompassDeg,
} from './solarToWorldDirection'
import type { SolarInput, SunPathPoint } from './types'

export function generateDailySunPath(input: SolarInput): SunPathPoint[] {
  const points: SunPathPoint[] = []

  for (let minutes = 0; minutes < 1440; minutes += SUN_PATH_INTERVAL_MINUTES) {
    const instant = localDateTimeToInstant(input.localDate, minutes, input.timeZone)
    const position = getPosition(instant, input.latitude, input.longitude)
    const azimuthDeg = sunCalcAzimuthToCompassDeg(position.azimuth)
    points.push({
      instant,
      altitudeDeg: position.altitude,
      worldDirection: solarToWorldDirection(
        position.altitude,
        azimuthDeg,
        input.northOffsetDeg,
      ),
    })
  }

  return points
}
