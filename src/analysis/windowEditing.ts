import type { AnalyticalOpening, ParsedOpening, ParsedPascalScene, ParsedWall } from '../scene/pascal/types'
import { pointAndTangentAlongWall, wallPathLength } from '../scene/pascal/wallGeometry'

const MIN_SIZE = 0.05

export interface WindowEditPatch {
  width?: number
  height?: number
  sillHeight?: number
  offsetAlongWall?: number
  enabled?: boolean
  shgc?: number
  visibleTransmittance?: number
}

export interface EditableWindowContext {
  analytical: AnalyticalOpening
  opening: ParsedOpening
  wall: ParsedWall
  levelName: string
  wallLength: number
  wallHeight: number
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

export function findEditableWindow(scene: ParsedPascalScene | null, id: string | null): EditableWindowContext | null {
  if (!scene || !id) return null
  const analytical = scene.analyticalOpenings.find((opening) => opening.id === id)
  if (!analytical) return null
  const level = scene.levels.find((candidate) => candidate.id === analytical.levelId)
  const wall = level?.walls.find((candidate) => candidate.id === analytical.wallId)
  const opening = wall?.openings.find((candidate) => candidate.id === id)
  if (!level || !wall || !opening) return null
  return {
    analytical,
    opening,
    wall,
    levelName: level.name,
    wallLength: wallPathLength(wall),
    wallHeight: wall.height,
  }
}

function updatedAnalytical(
  source: AnalyticalOpening,
  opening: ParsedOpening,
  wall: ParsedWall,
  levelElevation: number,
): AnalyticalOpening {
  const previousLocation = pointAndTangentAlongWall(wall, source.offsetAlongWall)
  const nextLocation = pointAndTangentAlongWall(wall, opening.offsetAlongWall)
  const previousBaseNormal: [number, number, number] = [-previousLocation.tangent[1], 0, previousLocation.tangent[0]]
  const sideSign = previousBaseNormal[0] * source.outwardNormalWorld[0] + previousBaseNormal[2] * source.outwardNormalWorld[2] < 0 ? -1 : 1
  const outwardNormalWorld: [number, number, number] = [
    -nextLocation.tangent[1] * sideSign,
    0,
    nextLocation.tangent[0] * sideSign,
  ]
  const grossArea = opening.width * opening.height
  return {
    ...source,
    centerWorld: [nextLocation.point[0], levelElevation + opening.centerHeight, nextLocation.point[1]],
    outwardNormalWorld,
    width: opening.width,
    height: opening.height,
    grossArea,
    glazedArea: grossArea * opening.glazingRatio,
    sillHeight: opening.centerHeight - opening.height / 2,
    offsetAlongWall: opening.offsetAlongWall,
    enabled: opening.enabled,
    shgc: opening.shgc,
    visibleTransmittance: opening.visibleTransmittance,
  }
}

export function updateSceneWindow(
  scene: ParsedPascalScene,
  id: string,
  patch: WindowEditPatch,
): ParsedPascalScene {
  const context = findEditableWindow(scene, id)
  if (!context) return scene
  const requestedWidth = Number.isFinite(patch.width) ? patch.width as number : context.opening.width
  const width = clamp(requestedWidth, MIN_SIZE, context.wallLength)
  const requestedHeight = Number.isFinite(patch.height) ? patch.height as number : context.opening.height
  const height = clamp(requestedHeight, MIN_SIZE, context.wall.height)
  const requestedOffset = Number.isFinite(patch.offsetAlongWall) ? patch.offsetAlongWall as number : context.opening.offsetAlongWall
  const offsetAlongWall = clamp(requestedOffset, width / 2, context.wallLength - width / 2)
  const currentSill = context.opening.centerHeight - context.opening.height / 2
  const requestedSill = Number.isFinite(patch.sillHeight) ? patch.sillHeight as number : currentSill
  const sillHeight = clamp(requestedSill, 0, context.wall.height - height)
  const opening: ParsedOpening = {
    ...context.opening,
    width,
    height,
    centerHeight: sillHeight + height / 2,
    offsetAlongWall,
    enabled: patch.enabled ?? context.opening.enabled,
    shgc: clamp(Number.isFinite(patch.shgc) ? patch.shgc as number : context.opening.shgc, 0, 1),
    visibleTransmittance: clamp(
      Number.isFinite(patch.visibleTransmittance) ? patch.visibleTransmittance as number : context.opening.visibleTransmittance,
      0,
      1,
    ),
  }

  let nextWall: ParsedWall | null = null
  let levelElevation = 0
  const levels = scene.levels.map((level) => {
    if (level.id !== context.analytical.levelId) return level
    levelElevation = level.elevation
    return {
      ...level,
      walls: level.walls.map((wall) => {
        if (wall.id !== context.wall.id) return wall
        nextWall = { ...wall, openings: wall.openings.map((candidate) => candidate.id === id ? opening : candidate) }
        return nextWall
      }),
    }
  })
  if (!nextWall) return scene
  const analyticalOpenings = scene.analyticalOpenings.map((candidate) => (
    candidate.id === id ? updatedAnalytical(candidate, opening, nextWall as ParsedWall, levelElevation) : candidate
  ))
  return { ...scene, levels, analyticalOpenings }
}

export function restoreSceneWindow(
  scene: ParsedPascalScene,
  originalScene: ParsedPascalScene,
  id: string,
): ParsedPascalScene {
  const original = findEditableWindow(originalScene, id)
  if (!original) return scene
  return updateSceneWindow(scene, id, {
    width: original.opening.width,
    height: original.opening.height,
    sillHeight: original.opening.centerHeight - original.opening.height / 2,
    offsetAlongWall: original.opening.offsetAlongWall,
    enabled: original.opening.enabled,
    shgc: original.opening.shgc,
    visibleTransmittance: original.opening.visibleTransmittance,
  })
}
