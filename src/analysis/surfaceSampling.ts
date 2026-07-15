import type { ParsedSurface, Point2 } from '../scene/pascal/types'

const EDGE_EPSILON = 1e-7

export interface FloorAnalysisGrid {
  surfaceId: string
  positions: Float32Array
  indices: Uint32Array
  solarExposure: Float32Array
  vertexCount: number
}

function pointOnSegment(point: Point2, start: Point2, end: Point2): boolean {
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  const cross = (point[0] - start[0]) * dz - (point[1] - start[1]) * dx
  if (Math.abs(cross) > EDGE_EPSILON) return false
  const dot = (point[0] - start[0]) * dx + (point[1] - start[1]) * dz
  return dot >= -EDGE_EPSILON && dot <= dx * dx + dz * dz + EDGE_EPSILON
}

function pointInLoop(point: Point2, loop: Point2[], includeBoundary: boolean): boolean {
  let inside = false
  for (let index = 0, previous = loop.length - 1; index < loop.length; previous = index, index += 1) {
    const currentPoint = loop[index]
    const previousPoint = loop[previous]
    if (!currentPoint || !previousPoint) continue
    if (pointOnSegment(point, previousPoint, currentPoint)) return includeBoundary
    const intersects = (currentPoint[1] > point[1]) !== (previousPoint[1] > point[1])
      && point[0] < (previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1])
        / (previousPoint[1] - currentPoint[1]) + currentPoint[0]
    if (intersects) inside = !inside
  }
  return inside
}

function insideSurface(point: Point2, surface: ParsedSurface): boolean {
  if (!pointInLoop(point, surface.polygon, true)) return false
  return !surface.holes.some((hole) => pointInLoop(point, hole, true))
}

function cellInsideSurface(x0: number, x1: number, z0: number, z1: number, surface: ParsedSurface): boolean {
  const centerX = (x0 + x1) / 2
  const centerZ = (z0 + z1) / 2
  return [
    [x0, z0], [x1, z0], [x0, z1], [x1, z1],
    [centerX, centerZ], [centerX, z0], [centerX, z1], [x0, centerZ], [x1, centerZ],
  ].every((point) => insideSurface(point as Point2, surface))
}

export function buildFloorAnalysisGrid(surface: ParsedSurface, targetSpacing = 0.35): FloorAnalysisGrid | null {
  if (surface.polygon.length < 3) return null
  const spacing = Math.max(0.25, Math.min(0.4, targetSpacing))
  const xs = surface.polygon.map((point) => point[0])
  const zs = surface.polygon.map((point) => point[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const width = maxX - minX
  const depth = maxZ - minZ
  if (width <= EDGE_EPSILON || depth <= EDGE_EPSILON) return null
  const columnCount = Math.max(1, Math.ceil(width / spacing))
  const rowCount = Math.max(1, Math.ceil(depth / spacing))
  const stepX = width / columnCount
  const stepZ = depth / rowCount
  const positions: number[] = []
  const indices: number[] = []
  const vertexByGridPoint = new Map<string, number>()
  const y = surface.elevation + surface.thickness + 0.004

  const vertexIndex = (column: number, row: number): number => {
    const key = `${column}:${row}`
    const existing = vertexByGridPoint.get(key)
    if (existing !== undefined) return existing
    const index = positions.length / 3
    positions.push(minX + column * stepX, y, minZ + row * stepZ)
    vertexByGridPoint.set(key, index)
    return index
  }

  for (let column = 0; column < columnCount; column += 1) {
    const x0 = minX + column * stepX
    const x1 = minX + (column + 1) * stepX
    for (let row = 0; row < rowCount; row += 1) {
      const z0 = minZ + row * stepZ
      const z1 = minZ + (row + 1) * stepZ
      if (!cellInsideSurface(x0, x1, z0, z1, surface)) continue
      const bottomLeft = vertexIndex(column, row)
      const bottomRight = vertexIndex(column + 1, row)
      const topLeft = vertexIndex(column, row + 1)
      const topRight = vertexIndex(column + 1, row + 1)
      indices.push(bottomLeft, topLeft, bottomRight, bottomRight, topLeft, topRight)
    }
  }

  const vertexCount = positions.length / 3
  if (vertexCount === 0 || indices.length === 0) return null
  return {
    surfaceId: surface.id,
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    solarExposure: new Float32Array(vertexCount),
    vertexCount,
  }
}

export function buildFloorAnalysisGrids(surfaces: ParsedSurface[], spacing = 0.35): FloorAnalysisGrid[] {
  return surfaces
    .map((surface) => buildFloorAnalysisGrid(surface, spacing))
    .filter((grid): grid is FloorAnalysisGrid => grid !== null)
}
