import type { AnalyticalOpening, Vector3Tuple } from '../scene/pascal/types'

export interface SolarRayHit {
  blocked: boolean
  obstructionKind: string | null
}

export type SolarRaycast = (
  origin: Vector3Tuple,
  direction: Vector3Tuple,
  skipSurfaceId?: string,
) => SolarRayHit

export interface WindowCurrentSolarResult {
  incidentAngleDeg: number
  incidenceCosine: number
  occluded: boolean
  obstructionKind: string | null
  incidentDirectWm2: number
  transmittedDirectWm2: number
}

const dot = (left: Vector3Tuple, right: Vector3Tuple) =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2]

export function calculateWindowCurrentSolar(
  opening: AnalyticalOpening,
  sunDirection: Vector3Tuple,
  dniWm2: number | null | undefined,
  raycast: SolarRaycast,
): WindowCurrentSolarResult {
  const rawCosine = Math.max(-1, Math.min(1, dot(opening.outwardNormalWorld, sunDirection)))
  const incidenceCosine = opening.enabled ? Math.max(0, rawCosine) : 0
  const incidentAngleDeg = Math.acos(rawCosine) * 180 / Math.PI
  const usableDni = Math.max(0, dniWm2 ?? 0)
  const shouldTrace = opening.enabled && sunDirection[1] > 0 && incidenceCosine > 0 && usableDni > 0
  const origin: Vector3Tuple = [
    opening.centerWorld[0] + sunDirection[0] * 0.03,
    opening.centerWorld[1] + sunDirection[1] * 0.03,
    opening.centerWorld[2] + sunDirection[2] * 0.03,
  ]
  const hit = shouldTrace ? raycast(origin, sunDirection) : { blocked: false, obstructionKind: null }
  const incidentDirectWm2 = hit.blocked ? 0 : usableDni * incidenceCosine
  return {
    incidentAngleDeg,
    incidenceCosine,
    occluded: hit.blocked,
    obstructionKind: hit.obstructionKind,
    incidentDirectWm2,
    transmittedDirectWm2: incidentDirectWm2 * opening.shgc,
  }
}
