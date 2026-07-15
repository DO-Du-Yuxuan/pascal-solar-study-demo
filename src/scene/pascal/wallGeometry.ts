import type { ParsedOpening, ParsedWall, Point2 } from './types'

const EPSILON = 1e-5

export interface WallPiece {
  id: string
  wallId: string
  start: Point2
  end: Point2
  bottom: number
  height: number
  thickness: number
}

export function createWallPath(wall: ParsedWall): Point2[] {
  if (Math.abs(wall.curveOffset) <= EPSILON) return [wall.start, wall.end]
  const dx = wall.end[0] - wall.start[0]
  const dz = wall.end[1] - wall.start[1]
  const chordLength = Math.hypot(dx, dz)
  if (chordLength <= EPSILON) return [wall.start, wall.end]
  const midpoint: Point2 = [(wall.start[0] + wall.end[0]) / 2, (wall.start[1] + wall.end[1]) / 2]
  const control: Point2 = [
    midpoint[0] - dz / chordLength * wall.curveOffset,
    midpoint[1] + dx / chordLength * wall.curveOffset,
  ]
  const segmentCount = Math.min(64, Math.max(8, Math.ceil(chordLength / 0.5)))
  return Array.from({ length: segmentCount + 1 }, (_, index) => {
    const t = index / segmentCount
    const inverse = 1 - t
    return [
      inverse * inverse * wall.start[0] + 2 * inverse * t * control[0] + t * t * wall.end[0],
      inverse * inverse * wall.start[1] + 2 * inverse * t * control[1] + t * t * wall.end[1],
    ]
  })
}

export function wallPathLength(wall: ParsedWall): number {
  const path = createWallPath(wall)
  return path.slice(1).reduce((total, point, index) => {
    const previous = path[index]
    return previous ? total + Math.hypot(point[0] - previous[0], point[1] - previous[1]) : total
  }, 0)
}

export function pointAndTangentAlongWall(wall: ParsedWall, distance: number): { point: Point2; tangent: Point2 } {
  const path = createWallPath(wall)
  const totalLength = wallPathLength(wall)
  let remaining = Math.max(0, Math.min(totalLength, distance))
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index]
    const end = path[index + 1]
    if (!start || !end) continue
    const dx = end[0] - start[0]
    const dz = end[1] - start[1]
    const length = Math.hypot(dx, dz)
    if (length <= EPSILON) continue
    if (remaining <= length || index === path.length - 2) {
      const ratio = Math.min(1, remaining / length)
      return {
        point: [start[0] + dx * ratio, start[1] + dz * ratio],
        tangent: [dx / length, dz / length],
      }
    }
    remaining -= length
  }
  return { point: wall.start, tangent: [1, 0] }
}

function solidVerticalRanges(height: number, openings: ParsedOpening[], x: number): [number, number][] {
  const holes = openings
    .filter((opening) => x > opening.offsetAlongWall - opening.width / 2 - EPSILON && x < opening.offsetAlongWall + opening.width / 2 + EPSILON)
    .map((opening) => [
      Math.max(0, opening.centerHeight - opening.height / 2),
      Math.min(height, opening.centerHeight + opening.height / 2),
    ] as [number, number])
    .filter(([bottom, top]) => top - bottom > EPSILON)
    .sort((a, b) => a[0] - b[0])

  const merged: [number, number][] = []
  for (const hole of holes) {
    const previous = merged.at(-1)
    if (previous && hole[0] <= previous[1] + EPSILON) previous[1] = Math.max(previous[1], hole[1])
    else merged.push([...hole])
  }

  const solids: [number, number][] = []
  let cursor = 0
  for (const [bottom, top] of merged) {
    if (bottom - cursor > EPSILON) solids.push([cursor, bottom])
    cursor = Math.max(cursor, top)
  }
  if (height - cursor > EPSILON) solids.push([cursor, height])
  return solids
}

function splitSegment(
  wall: ParsedWall,
  segmentIndex: number,
  start: Point2,
  end: Point2,
  pathStart: number,
  segmentLength: number,
): WallPiece[] {
  const localOpenings = wall.openings.flatMap((opening) => {
    const openingStart = opening.offsetAlongWall - opening.width / 2
    const openingEnd = opening.offsetAlongWall + opening.width / 2
    const overlapStart = Math.max(pathStart, openingStart)
    const overlapEnd = Math.min(pathStart + segmentLength, openingEnd)
    if (overlapEnd - overlapStart <= EPSILON) return []
    return [{
      ...opening,
      offsetAlongWall: (overlapStart + overlapEnd) / 2 - pathStart,
      width: overlapEnd - overlapStart,
    }]
  })

  const cuts = new Set([0, segmentLength])
  for (const opening of localOpenings) {
    cuts.add(Math.max(0, opening.offsetAlongWall - opening.width / 2))
    cuts.add(Math.min(segmentLength, opening.offsetAlongWall + opening.width / 2))
  }
  const sortedCuts = [...cuts].sort((a, b) => a - b)
  const ux = (end[0] - start[0]) / segmentLength
  const uz = (end[1] - start[1]) / segmentLength
  const pieces: WallPiece[] = []
  for (let index = 0; index < sortedCuts.length - 1; index += 1) {
    const from = sortedCuts[index]
    const to = sortedCuts[index + 1]
    if (from === undefined || to === undefined) continue
    if (to - from <= EPSILON) continue
    for (const [bottom, top] of solidVerticalRanges(wall.height, localOpenings, (from + to) / 2)) {
      pieces.push({
        id: `${wall.id}-${segmentIndex}-${index}-${bottom.toFixed(4)}`,
        wallId: wall.id,
        start: [start[0] + ux * from, start[1] + uz * from],
        end: [start[0] + ux * to, start[1] + uz * to],
        bottom,
        height: top - bottom,
        thickness: wall.thickness,
      })
    }
  }
  return pieces
}

export function createWallPieces(wall: ParsedWall): WallPiece[] {
  const activeWall = { ...wall, openings: wall.openings.filter((opening) => opening.enabled) }
  const path = createWallPath(activeWall)
  const pieces: WallPiece[] = []
  let pathStart = 0
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index]
    const end = path[index + 1]
    if (!start || !end) continue
    const length = Math.hypot(end[0] - start[0], end[1] - start[1])
    if (length > EPSILON) pieces.push(...splitSegment(activeWall, index, start, end, pathStart, length))
    pathStart += length
  }
  return pieces
}
