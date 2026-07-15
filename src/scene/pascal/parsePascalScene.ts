import type {
  AnalyticalOpening,
  ImportReport,
  ParsedLevel,
  ParsedOpening,
  ParsedPascalScene,
  ParsedRoof,
  ParsedRoofSegment,
  ParsedSurface,
  ParsedTree,
  ParsedWall,
  Point2,
  Vector3Tuple,
} from './types'
import { pointAndTangentAlongWall, wallPathLength } from './wallGeometry'

type JsonRecord = Record<string, unknown>

const DEFAULT_LEVEL_HEIGHT = 2.5
const DEFAULT_WALL_THICKNESS = 0.1
const DEFAULT_SURFACE_THICKNESS = 0.12
const IGNORED_TYPES = new Set([
  'fence', 'stair', 'stair-segment', 'item', 'shelf',
  'guide', 'spawn', 'flower', 'grass', 'building', 'site', 'layout', 'root',
])
const ROOF_TYPES = new Set(['gable', 'hip', 'shed', 'flat', 'gambrel', 'mansard', 'dutch'])

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nodeData(node: JsonRecord): JsonRecord {
  const nested = ['data', 'properties', 'attributes']
    .map((key) => node[key])
    .filter(isRecord)
  return Object.assign({}, ...nested, node) as JsonRecord
}

function numberValue(value: unknown, fallback = Number.NaN): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = numberValue(value)
  return parsed > 0 ? parsed : fallback
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1) return true
  if (value === 'false' || value === 0) return false
  return fallback
}

function point2(value: unknown): Point2 | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = numberValue(value[0])
    const z = numberValue(value[value.length >= 3 ? 2 : 1])
    return Number.isFinite(x) && Number.isFinite(z) ? [x, z] : null
  }
  if (isRecord(value)) {
    const x = numberValue(value.x ?? value[0])
    const z = numberValue(value.z ?? value.y ?? value[1])
    return Number.isFinite(x) && Number.isFinite(z) ? [x, z] : null
  }
  return null
}

function vector3(value: unknown, fallback: Vector3Tuple): Vector3Tuple {
  if (Array.isArray(value)) {
    if (value.length >= 3) {
      return [numberValue(value[0], fallback[0]), numberValue(value[1], fallback[1]), numberValue(value[2], fallback[2])]
    }
    if (value.length >= 2) return [numberValue(value[0], fallback[0]), fallback[1], numberValue(value[1], fallback[2])]
  }
  if (isRecord(value)) {
    return [
      numberValue(value.x, fallback[0]),
      numberValue(value.y, fallback[1]),
      numberValue(value.z, fallback[2]),
    ]
  }
  const scalar = numberValue(value)
  return Number.isFinite(scalar) ? [scalar, scalar, scalar] : fallback
}

function points(value: unknown): Point2[] {
  if (!Array.isArray(value)) return []
  return value.map(point2).filter((point): point is Point2 => point !== null)
}

function cleanLoop(input: Point2[]): Point2[] {
  const output: Point2[] = []
  for (const point of input) {
    const previous = output.at(-1)
    if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 1e-5) output.push(point)
  }
  if (output.length > 2) {
    const first = output[0]
    const last = output.at(-1)
    if (first && last && Math.hypot(first[0] - last[0], first[1] - last[1]) <= 1e-5) output.pop()
  }
  return output.length >= 3 ? output : []
}

function polygonFromNode(node: JsonRecord): Point2[] {
  const value = node.polygon ?? node.points ?? node.vertices ?? node.outline ?? node.path
  if (isRecord(value)) return cleanLoop(points(value.points ?? value.vertices ?? value.outer ?? value.coordinates))
  return cleanLoop(points(value))
}

function holesFromNode(node: JsonRecord): Point2[][] {
  const polygon = node.polygon
  const value = node.holes ?? (isRecord(polygon) ? polygon.holes : undefined)
  if (!Array.isArray(value)) return []
  return value
    .map((hole) => isRecord(hole) ? cleanLoop(points(hole.points ?? hole.vertices ?? hole.polygon)) : cleanLoop(points(hole)))
    .filter((hole) => hole.length >= 3)
}

function nodeType(node: JsonRecord): string {
  return stringValue(node.type, 'unknown').toLowerCase()
}

function nodeId(node: JsonRecord, fallback: string): string {
  return stringValue(node.id, fallback)
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string' || typeof item === 'number') return [String(item)]
    if (isRecord(item)) return [stringValue(item.id)].filter(Boolean)
    return []
  })
}

function normalizeRotation(value: unknown): Vector3Tuple {
  const scalar = numberValue(value)
  const rotation = Number.isFinite(scalar) ? [0, scalar, 0] as Vector3Tuple : vector3(value, [0, 0, 0])
  return rotation.map((angle) => Math.abs(angle) > Math.PI * 2 + 0.001 ? angle * Math.PI / 180 : angle) as Vector3Tuple
}

function colorValue(value: unknown, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) return `#${Math.max(0, Math.min(0xffffff, value)).toString(16).padStart(6, '0')}`
  if (typeof value === 'string' && value.trim()) return value
  return fallback
}

function createReport(nodes: JsonRecord[]): ImportReport {
  const countsByType: Record<string, number> = {}
  for (const node of nodes) {
    const type = nodeType(node)
    countsByType[type] = (countsByType[type] ?? 0) + 1
  }
  return { totalNodes: nodes.length, countsByType, rendered: 0, approximate: 0, ignored: 0, unsupported: 0, failed: 0, warnings: [] }
}

function parseOpening(id: string, node: JsonRecord, kind: 'door' | 'window'): ParsedOpening | null {
  const position = node.position
  const positionOffset = Array.isArray(position) ? numberValue(position[0]) : isRecord(position) ? numberValue(position.x) : Number.NaN
  const positionHeight = Array.isArray(position) ? numberValue(position[1]) : isRecord(position) ? numberValue(position.y) : Number.NaN
  const size = node.size
  const sizeWidth = Array.isArray(size) ? numberValue(size[0]) : isRecord(size) ? numberValue(size.x ?? size.width) : numberValue(size)
  const sizeHeight = Array.isArray(size) ? numberValue(size[1]) : isRecord(size) ? numberValue(size.y ?? size.height) : numberValue(size)
  const offsetAlongWall = numberValue(node.offsetAlongWall, positionOffset)
  const centerHeight = numberValue(node.centerHeight, positionHeight)
  const width = positiveNumber(node.width ?? sizeWidth, Number.NaN)
  const height = positiveNumber(node.height ?? sizeHeight, Number.NaN)
  if (![offsetAlongWall, centerHeight, width, height].every(Number.isFinite)) return null
  const glazingRatio = kind === 'window'
    ? windowGlazingRatio(node, width, height)
    : doorGlazingRatio(node, width, height) ?? 0
  return {
    id,
    name: stringValue(node.name, kind === 'window' ? `窗户 ${id}` : `门 ${id}`),
    kind,
    offsetAlongWall,
    centerHeight,
    width,
    height,
    frameThickness: Math.max(0.02, numberValue(node.frameThickness, 0.05)),
    frameDepth: positiveNumber(node.frameDepth, 0.07),
    glazingRatio,
    glassHeightRatio: kind === 'door' ? doorGlassHeightRatio(node) : 1,
    enabled: true,
    shgc: 0.4,
    visibleTransmittance: 0.6,
  }
}

function parseWall(id: string, node: JsonRecord): ParsedWall | null {
  const start = point2(node.start ?? node.startPoint ?? node.a)
  const end = point2(node.end ?? node.endPoint ?? node.b)
  if (!start || !end || Math.hypot(end[0] - start[0], end[1] - start[1]) <= 1e-5) return null
  return {
    id,
    start,
    end,
    height: positiveNumber(node.height, DEFAULT_LEVEL_HEIGHT),
    thickness: positiveNumber(node.thickness, DEFAULT_WALL_THICKNESS),
    curveOffset: numberValue(node.curveOffset, 0),
    openings: [],
  }
}

function parseSurface(id: string, node: JsonRecord, levelElevation: number): ParsedSurface | null {
  const polygon = polygonFromNode(node)
  if (polygon.length < 3) return null
  const position = vector3(node.position, [0, 0, 0])
  const explicitElevation = numberValue(node.elevation, Number.NaN)
  const ownHeight = numberValue(node.height, Number.NaN)
  const offset = Number.isFinite(explicitElevation)
    ? explicitElevation
    : Number.isFinite(position[1]) && position[1] !== 0
      ? position[1]
      : Number.isFinite(ownHeight) ? ownHeight : 0
  return {
    id,
    polygon,
    holes: holesFromNode(node),
    elevation: levelElevation + offset,
    thickness: positiveNumber(node.thickness ?? node.depth, DEFAULT_SURFACE_THICKNESS),
  }
}

function parseTree(id: string, node: JsonRecord): ParsedTree {
  const height = positiveNumber(node.height, 6)
  const size = vector3(node.size, [1, 1, 1]).map((value) => value > 0 ? value : 1) as Vector3Tuple
  return {
    id,
    preset: stringValue(node.preset, 'Oak Medium'),
    size,
    seed: Math.round(numberValue(node.seed, 1)),
    treeType: stringValue(node.treeType, 'deciduous').toLowerCase(),
    height,
    foliageDensity: Math.max(0, numberValue(node.foliageDensity, 1)),
    trunkThickness: positiveNumber(node.trunkThickness, Math.max(0.08, height * 0.045)),
    leafless: booleanValue(node.leafless),
    leafColor: colorValue(node.leafColor, '#6f914d'),
    branchColor: colorValue(node.branchColor, '#7a5940'),
    position: vector3(node.position, [0, 0, 0]),
    rotation: normalizeRotation(node.rotation),
  }
}

function rotationY(value: unknown): number {
  return normalizeRotation(value)[1]
}

function parseRoofSegment(id: string, node: JsonRecord): ParsedRoofSegment {
  const requestedType = stringValue(node.roofType ?? node.kind ?? node.shape, 'gable').toLowerCase()
  const roofType = ROOF_TYPES.has(requestedType) ? requestedType as ParsedRoofSegment['roofType'] : 'gable'
  return {
    id,
    roofType,
    position: vector3(node.position, [0, 0, 0]),
    rotationY: rotationY(node.rotation),
    width: positiveNumber(node.width, 8),
    depth: positiveNumber(node.depth, 6),
    pitchDeg: Math.max(0, Math.min(85, numberValue(node.pitch, 40))),
    wallHeight: Math.max(0, numberValue(node.wallHeight, 0.5)),
    overhang: Math.max(0, numberValue(node.overhang, 0.3)),
    deckThickness: positiveNumber(node.deckThickness, 0.1),
    approximate: !ROOF_TYPES.has(requestedType) || ['gambrel', 'mansard', 'dutch'].includes(roofType),
  }
}

function ratios(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => numberValue(item)).filter((item) => Number.isFinite(item) && item > 0)
}

function windowGlazingRatio(node: JsonRecord, width: number, height: number): number {
  if (stringValue(node.openingKind).toLowerCase() === 'opening') return 1
  const frame = Math.max(0, numberValue(node.frameThickness, 0.05))
  const divider = Math.max(0, numberValue(node.dividerThickness ?? node.mullionThickness, 0.03))
  const columns = Math.max(1, ratios(node.columnRatios).length)
  const rows = Math.max(1, ratios(node.rowRatios).length)
  const clearWidth = Math.max(0, width - frame * 2 - divider * (columns - 1))
  const clearHeight = Math.max(0, height - frame * 2 - divider * (rows - 1))
  return Math.max(0, Math.min(1, clearWidth * clearHeight / (width * height)))
}

function doorGlazingRatio(node: JsonRecord, width: number, height: number): number | null {
  if (!Array.isArray(node.segments)) return null
  const segments = node.segments.filter(isRecord)
  const weights = segments.map((segment) => positiveNumber(segment.heightRatio, 1))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const glass = segments.reduce((sum, segment, index) => (
    stringValue(segment.type).toLowerCase() === 'glass' ? sum + (weights[index] ?? 0) : sum
  ), 0)
  if (glass <= 0 || total <= 0) return null
  const frame = Math.max(0, numberValue(node.frameThickness, 0.05))
  const clearFrameRatio = Math.max(0, width - frame * 2) * Math.max(0, height - frame * 2) / (width * height)
  return Math.max(0, Math.min(1, glass / total * clearFrameRatio))
}

function doorGlassHeightRatio(node: JsonRecord): number {
  if (!Array.isArray(node.segments)) return 0
  const segments = node.segments.filter(isRecord)
  const total = segments.reduce((sum, segment) => sum + positiveNumber(segment.heightRatio, 1), 0)
  const glass = segments.reduce((sum, segment) => (
    stringValue(segment.type).toLowerCase() === 'glass' ? sum + positiveNumber(segment.heightRatio, 1) : sum
  ), 0)
  return total > 0 ? Math.max(0, Math.min(1, glass / total)) : 0
}

export function orientAnalyticalOpening(opening: AnalyticalOpening, northOffsetDeg: number): AnalyticalOpening {
  const sceneBearing = Math.atan2(opening.outwardNormalWorld[0], opening.outwardNormalWorld[2]) * 180 / Math.PI
  return { ...opening, orientationDeg: ((sceneBearing - northOffsetDeg) % 360 + 360) % 360 }
}

export function parsePascalScene(value: unknown): ParsedPascalScene {
  if (!isRecord(value) || !isRecord(value.nodes)) throw new Error('JSON 顶层必须包含 nodes 对象。')

  const entries = Object.entries(value.nodes)
    .filter((entry): entry is [string, JsonRecord] => isRecord(entry[1]))
    .map(([key, raw]) => [key, nodeData(raw)] as const)
  const nodes = entries.map(([, node]) => node)
  const report = createReport(nodes)
  const byId = new Map(entries.map(([key, node]) => [nodeId(node, key), node]))

  const parentByChild = new Map<string, string>()
  for (const [id, node] of byId) {
    for (const child of ids(node.children)) parentByChild.set(child, id)
    const parentId = stringValue(node.parentId)
    if (parentId) parentByChild.set(id, parentId)
  }
  for (const rootId of ids(value.rootNodeIds)) {
    if (byId.has(rootId)) parentByChild.delete(rootId)
  }

  const visibilityCache = new Map<string, boolean>()
  const isVisible = (id: string): boolean => {
    const cached = visibilityCache.get(id)
    if (cached !== undefined) return cached
    const visited = new Set<string>()
    let current = id
    while (current && !visited.has(current)) {
      visited.add(current)
      if (byId.get(current)?.visible === false) {
        visibilityCache.set(id, false)
        return false
      }
      current = parentByChild.get(current) ?? ''
    }
    visibilityCache.set(id, true)
    return true
  }

  const levelNodes = [...byId.entries()]
    .filter(([, node]) => nodeType(node) === 'level')
    .map(([id, node], order) => ({ id, node, order, index: numberValue(node.level ?? node.index, order) }))
    .sort((a, b) => a.index - b.index || a.order - b.order)

  const levelById = new Map<string, number>()
  levelNodes.forEach((level, index) => levelById.set(level.id, index))

  const findLevelIndex = (id: string, node: JsonRecord): number => {
    const direct = node.levelId ?? node.level
    if (typeof direct === 'string' && levelById.has(direct)) return levelById.get(direct) ?? 0
    const directNumber = numberValue(direct)
    if (Number.isFinite(directNumber)) {
      const exact = levelNodes.findIndex((level) => level.index === directNumber)
      if (exact >= 0) return exact
    }
    let parent = stringValue(node.parentId, parentByChild.get(id) ?? '')
    const visited = new Set<string>()
    while (parent && !visited.has(parent)) {
      visited.add(parent)
      const known = levelById.get(parent)
      if (known !== undefined) return known
      parent = parentByChild.get(parent) ?? stringValue(byId.get(parent)?.parentId)
    }
    return 0
  }

  if (levelNodes.length === 0) {
    levelNodes.push({ id: '__implicit-level__', node: { type: 'level', name: '默认楼层', level: 0 }, order: 0, index: 0 })
    levelById.set('__implicit-level__', 0)
    report.warnings.push('未找到 level 节点；可渲染建筑节点已放入默认楼层。')
  }

  const levelHeights = levelNodes.map((level) => {
    const candidates = [...byId.entries()]
      .filter(([id, node]) => findLevelIndex(id, node) === levelById.get(level.id))
      .filter(([, node]) => nodeType(node) === 'wall' || nodeType(node) === 'ceiling')
      .map(([, node]) => numberValue(node.height))
      .filter((height) => Number.isFinite(height) && height > 0)
    return candidates.length ? Math.max(...candidates) : DEFAULT_LEVEL_HEIGHT
  })

  let accumulatedElevation = 0
  const levels: ParsedLevel[] = levelNodes.map((level, index) => {
    const parsed: ParsedLevel = {
      id: level.id,
      name: stringValue(level.node.name, `楼层 ${index + 1}`),
      index: level.index,
      elevation: accumulatedElevation,
      height: levelHeights[index] ?? DEFAULT_LEVEL_HEIGHT,
      walls: [],
      slabs: [],
      ceilings: [],
    }
    accumulatedElevation += parsed.height
    return parsed
  })

  const wallsById = new Map<string, ParsedWall>()
  const wallLevelById = new Map<string, ParsedLevel>()
  const pendingOpenings: { id: string; node: JsonRecord; kind: 'door' | 'window' }[] = []

  for (const [id, node] of byId) {
    const type = nodeType(node)
    const level = levels[Math.min(levels.length - 1, Math.max(0, findLevelIndex(id, node)))]
    if (!level) continue
    if (type === 'level') {
      report.rendered += 1
    } else if (type === 'wall') {
      const wall = parseWall(id, node)
      if (!wall) {
        report.failed += 1
        report.warnings.push(`墙体 ${id} 缺少有效 start/end，未渲染。`)
      } else {
        level.walls.push(wall)
        wallsById.set(id, wall)
        wallLevelById.set(id, level)
        report.rendered += 1
        if (Math.abs(wall.curveOffset) > 1e-5) report.approximate += 1
      }
    } else if (type === 'slab' || type === 'ceiling') {
      const surface = parseSurface(id, node, level.elevation)
      if (!surface) {
        report.failed += 1
        report.warnings.push(`${type} ${id} 的 polygon 无效，未渲染。`)
      } else {
        if (type === 'slab') level.slabs.push(surface)
        else level.ceilings.push(surface)
        report.rendered += 1
      }
    } else if (type === 'door' || type === 'window') {
      if (isVisible(id)) pendingOpenings.push({ id, node, kind: type })
      else report.ignored += 1
    } else if (type === 'roof' || type === 'roof-segment') {
      // Parsed after hierarchy and visibility have been resolved.
    } else if (type === 'trees:tree') {
      report.rendered += 1
    } else if (IGNORED_TYPES.has(type)) {
      report.ignored += 1
    } else {
      report.unsupported += 1
    }
  }

  const analyticalOpenings: AnalyticalOpening[] = []
  for (const openingEntry of pendingOpenings) {
    const opening = parseOpening(openingEntry.id, openingEntry.node, openingEntry.kind)
    const wallId = stringValue(openingEntry.node.wallId)
      || stringValue(openingEntry.node.parentId)
      || parentByChild.get(openingEntry.id)
      || ''
    const wall = wallsById.get(wallId)
    if (!opening || !wall) {
      report.failed += 1
      report.warnings.push(`${openingEntry.kind} ${openingEntry.id} 缺少有效尺寸、位置或 wallId，未生成洞口。`)
      continue
    }
    const wallLength = wallPathLength(wall)
    const originalStart = opening.offsetAlongWall - opening.width / 2
    const originalEnd = opening.offsetAlongWall + opening.width / 2
    const clampedStart = Math.max(0, originalStart)
    const clampedEnd = Math.min(wallLength, originalEnd)
    if (clampedEnd - clampedStart <= 1e-5) {
      report.failed += 1
      report.warnings.push(`${openingEntry.kind} ${opening.id} 完全位于墙体 ${wall.id} 之外，未生成洞口。`)
      continue
    }
    if (clampedStart !== originalStart || clampedEnd !== originalEnd) {
      report.warnings.push(`${openingEntry.kind} ${opening.id} 超出墙长，已 clamp 到墙体 ${wall.id}。`)
    }
    const verticalStart = Math.max(0, opening.centerHeight - opening.height / 2)
    const verticalEnd = Math.min(wall.height, opening.centerHeight + opening.height / 2)
    if (verticalEnd - verticalStart <= 1e-5) {
      report.failed += 1
      report.warnings.push(`${openingEntry.kind} ${opening.id} 完全位于墙体 ${wall.id} 高度之外，未生成洞口。`)
      continue
    }
    if (verticalStart !== opening.centerHeight - opening.height / 2 || verticalEnd !== opening.centerHeight + opening.height / 2) {
      report.warnings.push(`${openingEntry.kind} ${opening.id} 超出墙高，已 clamp 到墙体 ${wall.id}。`)
    }
    wall.openings.push({
      ...opening,
      offsetAlongWall: (clampedStart + clampedEnd) / 2,
      centerHeight: (verticalStart + verticalEnd) / 2,
      width: clampedEnd - clampedStart,
      height: verticalEnd - verticalStart,
    })
    const level = wallLevelById.get(wall.id)
    if (level) {
      const clampedOpening = wall.openings.at(-1)
      if (clampedOpening) {
        const location = pointAndTangentAlongWall(wall, clampedOpening.offsetAlongWall)
        const side = stringValue(openingEntry.node.side, 'front').toLowerCase()
        const sideSign = side === 'back' ? -1 : 1
        const rawNormal: Vector3Tuple = [
          -location.tangent[1] * sideSign,
          0,
          location.tangent[0] * sideSign,
        ]
        const outwardNormalWorld = rawNormal.map((component) => Math.abs(component) < 1e-12 ? 0 : component) as Vector3Tuple
        const glazingRatio = openingEntry.kind === 'window'
          ? windowGlazingRatio(openingEntry.node, clampedOpening.width, clampedOpening.height)
          : doorGlazingRatio(openingEntry.node, clampedOpening.width, clampedOpening.height)
        if (glazingRatio !== null) {
          const kind = openingEntry.kind === 'window' ? 'window' : 'glazed-door'
          const grossArea = clampedOpening.width * clampedOpening.height
          analyticalOpenings.push({
            id: openingEntry.id,
            name: stringValue(openingEntry.node.name, kind === 'window' ? `窗户 ${openingEntry.id}` : `玻璃门 ${openingEntry.id}`),
            kind,
            levelId: level.id,
            wallId: wall.id,
            centerWorld: [location.point[0], level.elevation + clampedOpening.centerHeight, location.point[1]],
            outwardNormalWorld,
            width: clampedOpening.width,
            height: clampedOpening.height,
            grossArea,
            glazingRatio,
            glazedArea: grossArea * glazingRatio,
            sillHeight: Math.max(0, clampedOpening.centerHeight - clampedOpening.height / 2),
            offsetAlongWall: clampedOpening.offsetAlongWall,
            enabled: clampedOpening.enabled,
            revealDepth: wall.thickness,
            orientationDeg: 0,
            shgc: clampedOpening.shgc,
            visibleTransmittance: clampedOpening.visibleTransmittance,
            uValue: 1.8,
          })
        }
      }
    }
    report.rendered += 1
  }
  for (const wall of wallsById.values()) wall.openings.sort((a, b) => a.offsetAlongWall - b.offsetAlongWall)

  const trees = [...byId.entries()]
    .filter(([, node]) => nodeType(node) === 'trees:tree')
    .map(([id, node]) => parseTree(id, node))

  const roofNodes = [...byId.entries()].filter(([, node]) => nodeType(node) === 'roof')
  const roofSegments = [...byId.entries()].filter(([, node]) => nodeType(node) === 'roof-segment')
  const attachedSegments = new Set<string>()
  const roofs: ParsedRoof[] = []
  for (const [roofId, roofNode] of roofNodes) {
    if (!isVisible(roofId)) {
      report.ignored += 1
      continue
    }
    const childIds = new Set(ids(roofNode.children))
    const segmentEntries = roofSegments.filter(([segmentId, segmentNode]) => (
      childIds.has(segmentId) || parentByChild.get(segmentId) === roofId || stringValue(segmentNode.parentId) === roofId
    ))
    const visibleSegments = segmentEntries.filter(([segmentId]) => isVisible(segmentId))
    for (const [segmentId] of segmentEntries) attachedSegments.add(segmentId)
    report.ignored += segmentEntries.length - visibleSegments.length
    const parsedSegments = visibleSegments.map(([segmentId, segmentNode]) => parseRoofSegment(segmentId, segmentNode))
    const level = levels[Math.min(levels.length - 1, Math.max(0, findLevelIndex(roofId, roofNode)))]
    if (!level || parsedSegments.length === 0) {
      report.failed += 1
      report.warnings.push(`屋顶 ${roofId} 没有可见的有效 roof-segment，未生成几何。`)
      continue
    }
    const position = vector3(roofNode.position, [0, 0, 0])
    position[1] += level.elevation
    roofs.push({
      id: roofId,
      levelId: level.id,
      position,
      rotationY: rotationY(roofNode.rotation),
      segments: parsedSegments,
    })
    report.rendered += 1 + parsedSegments.length
    const approximateSegments = parsedSegments.filter((segment) => segment.approximate)
    report.approximate += approximateSegments.length
    if (approximateSegments.length) {
      report.warnings.push(`屋顶 ${roofId} 的 ${approximateSegments.map((segment) => segment.roofType).join('、')} 类型使用简化遮阳几何。`)
    }
    if (parsedSegments.length > 1) {
      report.approximate += 1
      report.warnings.push(`屋顶 ${roofId} 包含多个 segment；复杂交接处未做布尔裁切。`)
    }
  }

  for (const [segmentId, segmentNode] of roofSegments) {
    if (attachedSegments.has(segmentId)) continue
    if (!isVisible(segmentId)) {
      report.ignored += 1
      continue
    }
    const segment = parseRoofSegment(segmentId, segmentNode)
    const level = levels[Math.min(levels.length - 1, Math.max(0, findLevelIndex(segmentId, segmentNode)))]
    if (!level) continue
    segment.position[1] += level.elevation
    roofs.push({ id: `__orphan-roof-${segmentId}`, levelId: level.id, position: [0, 0, 0], rotationY: 0, segments: [segment] })
    report.rendered += 1
    report.approximate += 1
    report.warnings.push(`roof-segment ${segmentId} 未关联 roof，已按独立屋顶渲染。`)
  }

  // Keep malformed non-object entries visible in the report rather than silently dropping them.
  const malformedCount = Object.keys(value.nodes).length - entries.length
  if (malformedCount > 0) {
    report.totalNodes += malformedCount
    report.failed += malformedCount
    report.countsByType.unknown = (report.countsByType.unknown ?? 0) + malformedCount
    report.warnings.push(`${malformedCount} 个节点不是对象，无法解析。`)
  }

  return { levels, trees, roofs, analyticalOpenings, report }
}
