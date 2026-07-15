import type { AnalyticalOpening, Vector3Tuple } from '../scene/pascal/types'
import type { FloorAnalysisGrid } from './surfaceSampling'
import type { SolarRaycast } from './windowCurrentSolar'

export interface HeatmapLegend {
  minimumWm2: number
  midpointWm2: number
  maximumWm2: number
  peakExposureWm2: number
  sampleCount: number
}

export interface FloorExposureResult {
  values: Float32Array
  invalidValueCount: number
  peakExposureWm2: number
}

const dot = (left: Vector3Tuple, right: Vector3Tuple) =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2]

function rayPassesOpening(
  origin: Vector3Tuple,
  direction: Vector3Tuple,
  opening: AnalyticalOpening,
): boolean {
  if (!opening.enabled) return false
  const denominator = dot(direction, opening.outwardNormalWorld)
  if (denominator <= 1e-6) return false
  const toPlane: Vector3Tuple = [
    opening.centerWorld[0] - origin[0],
    opening.centerWorld[1] - origin[1],
    opening.centerWorld[2] - origin[2],
  ]
  const distance = dot(toPlane, opening.outwardNormalWorld) / denominator
  if (distance <= 0.01) return false
  const hit: Vector3Tuple = [
    origin[0] + direction[0] * distance,
    origin[1] + direction[1] * distance,
    origin[2] + direction[2] * distance,
  ]
  const relative: Vector3Tuple = [
    hit[0] - opening.centerWorld[0],
    hit[1] - opening.centerWorld[1],
    hit[2] - opening.centerWorld[2],
  ]
  const tangent: Vector3Tuple = [opening.outwardNormalWorld[2], 0, -opening.outwardNormalWorld[0]]
  return Math.abs(dot(relative, tangent)) <= opening.width / 2 - 0.01
    && Math.abs(relative[1]) <= opening.height / 2 - 0.01
}

function validDni(dniWm2: number | null | undefined, sunDirection: Vector3Tuple): number {
  if (!Number.isFinite(dniWm2) || !Number.isFinite(sunDirection[1]) || sunDirection[1] <= 0) return 0
  return Math.max(0, dniWm2 as number)
}

export function heatmapScaleMaximum(
  dniWm2: number | null | undefined,
  openings: AnalyticalOpening[],
): number {
  const dni = Number.isFinite(dniWm2) ? Math.max(0, dniWm2 as number) : 0
  const maximumShgc = openings.reduce((maximum, opening) => (
    opening.enabled && Number.isFinite(opening.shgc) ? Math.max(maximum, opening.shgc) : maximum
  ), 0)
  return Math.max(50, dni * maximumShgc)
}

export function calculateFloorSolarExposure(
  grid: FloorAnalysisGrid,
  openings: AnalyticalOpening[],
  sunDirection: Vector3Tuple,
  dniWm2: number | null | undefined,
  raycast: SolarRaycast,
): FloorExposureResult {
  const dni = validDni(dniWm2, sunDirection)
  const floorIncidence = Math.max(0, sunDirection[1])
  const values = new Float32Array(grid.vertexCount)
  let invalidValueCount = 0
  let peakExposureWm2 = 0

  for (let index = 0; index < grid.vertexCount; index += 1) {
    if (dni <= 0 || floorIncidence <= 0) continue
    const offset = index * 3
    const position: Vector3Tuple = [
      grid.positions[offset] ?? 0,
      grid.positions[offset + 1] ?? 0,
      grid.positions[offset + 2] ?? 0,
    ]
    const opening = openings.find((candidate) => rayPassesOpening(position, sunDirection, candidate))
    if (!opening) continue
    const origin: Vector3Tuple = [
      position[0] + sunDirection[0] * 0.02,
      position[1] + sunDirection[1] * 0.02,
      position[2] + sunDirection[2] * 0.02,
    ]
    if (raycast(origin, sunDirection, grid.surfaceId).blocked) continue
    const openingIncidence = Math.max(0, dot(opening.outwardNormalWorld, sunDirection))
    const transmission = opening.shgc * openingIncidence
    const candidateValue = dni * transmission * floorIncidence
    const value = Number.isFinite(candidateValue) ? Math.max(0, candidateValue) : 0
    if (!Number.isFinite(candidateValue)) invalidValueCount += 1
    values[index] = value
    peakExposureWm2 = Math.max(peakExposureWm2, value)
  }
  return { values, invalidValueCount, peakExposureWm2 }
}
