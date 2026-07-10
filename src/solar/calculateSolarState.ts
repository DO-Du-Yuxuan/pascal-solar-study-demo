import { getPosition } from 'suncalc'
import { LIGHT_DISTANCE } from './constants'
import { calculateSunTimes } from './calculateSunTimes'
import { localDateTimeToInstant } from './localDateTime'
import {
  solarToWorldDirection,
  sunCalcAzimuthToCompassDeg,
} from './solarToWorldDirection'
import type { SolarInput, SolarState, Vector3Tuple } from './types'

export function calculateSolarState(input: SolarInput): SolarState {
  const instant = localDateTimeToInstant(
    input.localDate,
    input.localTimeMinutes,
    input.timeZone,
  )
  const position = getPosition(instant, input.latitude, input.longitude)
  const altitudeDeg = position.altitude
  const azimuthDeg = sunCalcAzimuthToCompassDeg(position.azimuth)
  const worldDirection = solarToWorldDirection(
    altitudeDeg,
    azimuthDeg,
    input.northOffsetDeg,
  )
  // This position is center -> Sun. Photons travel in the opposite direction;
  // Three.js DirectionalLight emits from position toward its target.
  const lightPosition = worldDirection.map(
    (component) => component * LIGHT_DISTANCE,
  ) as Vector3Tuple

  return {
    instant,
    altitudeDeg,
    azimuthDeg,
    worldDirection,
    lightPosition,
    isAboveHorizon: altitudeDeg > 0,
    ...calculateSunTimes(
      input.latitude,
      input.longitude,
      input.localDate,
      input.timeZone,
    ),
  }
}
