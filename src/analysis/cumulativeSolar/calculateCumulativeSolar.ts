import { DateTime } from 'luxon'
import * as THREE from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { calculateSolarState } from '../../solar'
import type { AnalyticalOpening, Vector3Tuple } from '../../scene/pascal/types'
import type {
  CumulativeAnalysisResult,
  CumulativeGridInput,
  CumulativeGridResult,
  CumulativeWorkerRequest,
} from './cumulativeSolarTypes'

type BvhGeometry = THREE.BufferGeometry & {
  computeBoundsTree: typeof computeBoundsTree
  disposeBoundsTree: typeof disposeBoundsTree
}

const dot = (left: Vector3Tuple, right: Vector3Tuple) =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2]

interface OpeningIntersection {
  opening: AnalyticalOpening
  distance: number
}

function openingDistance(origin: Vector3Tuple, direction: Vector3Tuple, opening: AnalyticalOpening): number | null {
  if (!opening.enabled || !Number.isFinite(opening.shgc) || opening.shgc <= 0) return null
  const denominator = dot(direction, opening.outwardNormalWorld)
  if (Math.abs(denominator) <= 1e-6) return null
  const relativeCenter: Vector3Tuple = [
    opening.centerWorld[0] - origin[0],
    opening.centerWorld[1] - origin[1],
    opening.centerWorld[2] - origin[2],
  ]
  const distance = dot(relativeCenter, opening.outwardNormalWorld) / denominator
  if (distance <= 0.01) return null
  const relativeHit: Vector3Tuple = [
    origin[0] + direction[0] * distance - opening.centerWorld[0],
    origin[1] + direction[1] * distance - opening.centerWorld[1],
    origin[2] + direction[2] * distance - opening.centerWorld[2],
  ]
  const tangent: Vector3Tuple = [opening.outwardNormalWorld[2], 0, -opening.outwardNormalWorld[0]]
  return Math.abs(dot(relativeHit, tangent)) <= opening.width / 2 - 0.01
    && Math.abs(relativeHit[1]) <= opening.height / 2 - 0.01
    ? distance
    : null
}

function nearestOpening(origin: Vector3Tuple, direction: Vector3Tuple, openings: AnalyticalOpening[]): OpeningIntersection | null {
  let nearest: OpeningIntersection | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const opening of openings) {
    const distance = openingDistance(origin, direction, opening)
    if (distance !== null && distance < nearestDistance) {
      nearest = { opening, distance }
      nearestDistance = distance
    }
  }
  return nearest
}

function triangleAreaWeights(grid: CumulativeGridInput): Float32Array {
  const weights = new Float32Array(grid.positions.length / 3)
  for (let offset = 0; offset < grid.indices.length; offset += 3) {
    const a = grid.indices[offset]
    const b = grid.indices[offset + 1]
    const c = grid.indices[offset + 2]
    if (a === undefined || b === undefined || c === undefined) continue
    const ax = grid.positions[a * 3] ?? 0
    const az = grid.positions[a * 3 + 2] ?? 0
    const bx = grid.positions[b * 3] ?? 0
    const bz = grid.positions[b * 3 + 2] ?? 0
    const cx = grid.positions[c * 3] ?? 0
    const cz = grid.positions[c * 3 + 2] ?? 0
    const area = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) / 2
    weights[a] = (weights[a] ?? 0) + area / 3
    weights[b] = (weights[b] ?? 0) + area / 3
    weights[c] = (weights[c] ?? 0) + area / 3
  }
  return weights
}

const yieldToWorker = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export async function calculateCumulativeSolar(
  request: CumulativeWorkerRequest,
  onProgress: (processedHours: number) => void,
  isCancelled: () => boolean,
): Promise<CumulativeAnalysisResult | null> {
  const geometry = new THREE.BufferGeometry() as BvhGeometry
  geometry.setAttribute('position', new THREE.BufferAttribute(request.triangles, 3))
  geometry.computeBoundsTree = computeBoundsTree
  geometry.disposeBoundsTree = disposeBoundsTree
  geometry.computeBoundsTree({ maxLeafTris: 20 })
  const occluder = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
  occluder.raycast = acceleratedRaycast
  const raycaster = new THREE.Raycaster()
  ;(raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true
  const directionVector = new THREE.Vector3()
  const originVector = new THREE.Vector3()
  const gridResults: CumulativeGridResult[] = request.grids.map((grid) => ({
    surfaceId: grid.surfaceId,
    levelId: grid.levelId,
    energyKWhM2: new Float32Array(grid.positions.length / 3),
    directSunHours: new Float32Array(grid.positions.length / 3),
  }))
  const openingsByLevel = new Map<string, AnalyticalOpening[]>()
  for (const opening of request.openings) {
    const levelOpenings = openingsByLevel.get(opening.levelId) ?? []
    levelOpenings.push(opening)
    openingsByLevel.set(opening.levelId, levelOpenings)
  }
  let validWeatherHours = 0
  let processedSolarHours = 0
  let invalidValueWarningIssued = false

  for (let hourIndex = 0; hourIndex < request.hours.length; hourIndex += 1) {
    if (hourIndex % 12 === 0) {
      await yieldToWorker()
      if (isCancelled()) {
        geometry.disposeBoundsTree()
        geometry.dispose()
        return null
      }
    }
    const hour = request.hours[hourIndex]
    const dni = hour?.dniWm2
    if (Number.isFinite(dni)) validWeatherHours += 1
    if (hour && Number.isFinite(dni) && (dni as number) >= 20) {
      const local = DateTime.fromISO(hour.utcTime, { zone: 'utc' }).setZone(request.solarInput.timeZone)
      const solar = calculateSolarState({
        ...request.solarInput,
        localDate: local.toISODate() ?? '2025-01-01',
        localTimeMinutes: local.hour * 60 + local.minute,
      })
      if (solar.isAboveHorizon && solar.worldDirection[1] > 0) {
        processedSolarHours += 1
        const sunDirection = solar.worldDirection
        directionVector.set(...sunDirection).normalize()
        for (let gridIndex = 0; gridIndex < request.grids.length; gridIndex += 1) {
          const grid = request.grids[gridIndex]
          const result = gridResults[gridIndex]
          if (!grid || !result) continue
          const levelOpenings = openingsByLevel.get(grid.levelId) ?? []
          for (let vertex = 0; vertex < result.energyKWhM2.length; vertex += 1) {
            const positionOffset = vertex * 3
            const origin: Vector3Tuple = [
              grid.positions[positionOffset] ?? 0,
              (grid.positions[positionOffset + 1] ?? 0) + 0.004,
              grid.positions[positionOffset + 2] ?? 0,
            ]
            const openingHit = nearestOpening(origin, sunDirection, levelOpenings)
            if (!openingHit) continue
            originVector.set(...origin)
            raycaster.set(originVector, directionVector)
            raycaster.near = 0.01
            raycaster.far = 100_000
            const firstOpaqueHit = raycaster.intersectObject(occluder, false)[0]
            // The analytical opening is not part of the opaque BVH. Any opaque
            // hit, before or after the opening plane, blocks this sun ray.
            if (firstOpaqueHit) continue
            const irradiance = (dni as number) * openingHit.opening.shgc * Math.max(0, sunDirection[1])
            if (!Number.isFinite(irradiance)) {
              if (!invalidValueWarningIssued) {
                invalidValueWarningIssued = true
                console.warn('累计太阳分析遇到无效数值，已按 0 处理。')
              }
              continue
            }
            if (irradiance <= 0) continue
            result.energyKWhM2[vertex] = (result.energyKWhM2[vertex] ?? 0) + irradiance / 1000
            if (irradiance >= 20) result.directSunHours[vertex] = (result.directSunHours[vertex] ?? 0) + 1
          }
        }
      }
    }
    if ((hourIndex + 1) % 24 === 0 || hourIndex === request.hours.length - 1) onProgress(hourIndex + 1)
  }

  let actualMaximumKWhM2 = 0
  let affectedAreaM2 = 0
  let maximumDirectSunHours = 0
  let directSunHoursTotal = 0
  let directSunVertexCount = 0
  request.grids.forEach((grid, gridIndex) => {
    const result = gridResults[gridIndex]
    if (!result) return
    const areaWeights = triangleAreaWeights(grid)
    for (let index = 0; index < result.energyKWhM2.length; index += 1) {
      const energy = result.energyKWhM2[index] ?? 0
      const hours = result.directSunHours[index] ?? 0
      actualMaximumKWhM2 = Math.max(actualMaximumKWhM2, energy)
      maximumDirectSunHours = Math.max(maximumDirectSunHours, hours)
      if (energy > 0) affectedAreaM2 += areaWeights[index] ?? 0
      if (hours > 0) {
        directSunHoursTotal += hours
        directSunVertexCount += 1
      }
    }
  })
  geometry.disposeBoundsTree()
  geometry.dispose()
  return {
    requestId: request.requestId,
    rangeKey: request.rangeKey,
    rangeLabel: request.rangeLabel,
    totalHours: request.hours.length,
    validWeatherHours,
    processedSolarHours,
    actualMaximumKWhM2,
    affectedAreaM2,
    maximumDirectSunHours,
    averageDirectSunHours: directSunVertexCount > 0 ? directSunHoursTotal / directSunVertexCount : 0,
    grids: gridResults,
  }
}
