import type { Vector3Tuple } from './types'

const DEG_TO_RAD = Math.PI / 180

export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

/**
 * SunCalc v2 already returns compass azimuth degrees (north=0, east=90).
 * Normalizing at this domain boundary makes that external convention explicit.
 */
export function sunCalcAzimuthToCompassDeg(azimuthDeg: number): number {
  return normalizeDegrees(azimuthDeg)
}

/**
 * World convention: +Y up, +Z scene north, +X scene east.
 * northOffsetDeg rotates clockwise from scene +Z to true north. The building
 * remains fixed; the true solar bearing is rotated into scene coordinates.
 */
export function solarToWorldDirection(
  altitudeDeg: number,
  azimuthDeg: number,
  northOffsetDeg: number,
): Vector3Tuple {
  const altitudeRad = altitudeDeg * DEG_TO_RAD
  const sceneBearingRad = normalizeDegrees(azimuthDeg + northOffsetDeg) * DEG_TO_RAD
  const horizontal = Math.cos(altitudeRad)
  const direction: Vector3Tuple = [
    horizontal * Math.sin(sceneBearingRad),
    Math.sin(altitudeRad),
    horizontal * Math.cos(sceneBearingRad),
  ]

  const length = Math.hypot(...direction)
  return direction.map((component) => component / length) as Vector3Tuple
}
