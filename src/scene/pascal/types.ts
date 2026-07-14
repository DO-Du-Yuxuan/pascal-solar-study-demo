export type Point2 = [number, number]
export type Vector3Tuple = [number, number, number]

export interface ImportReport {
  totalNodes: number
  countsByType: Record<string, number>
  rendered: number
  approximate: number
  ignored: number
  unsupported: number
  failed: number
  warnings: string[]
}

export interface ParsedOpening {
  id: string
  name: string
  kind: 'door' | 'window'
  offsetAlongWall: number
  centerHeight: number
  width: number
  height: number
  frameThickness: number
  frameDepth: number
  glazingRatio: number
  glassHeightRatio: number
}

export type AnalyticalOpeningKind = 'window' | 'glazed-door'

export interface AnalyticalOpening {
  id: string
  name: string
  kind: AnalyticalOpeningKind
  levelId: string
  centerWorld: Vector3Tuple
  outwardNormalWorld: Vector3Tuple
  width: number
  height: number
  grossArea: number
  glazingRatio: number
  glazedArea: number
  sillHeight: number
  revealDepth: number
  orientationDeg: number
  shgc: number
  visibleTransmittance: number
  uValue: number
}

export interface ParsedWall {
  id: string
  start: Point2
  end: Point2
  height: number
  thickness: number
  curveOffset: number
  openings: ParsedOpening[]
}

export interface ParsedSurface {
  id: string
  polygon: Point2[]
  holes: Point2[][]
  elevation: number
  thickness: number
}

export interface ParsedLevel {
  id: string
  name: string
  index: number
  elevation: number
  height: number
  walls: ParsedWall[]
  slabs: ParsedSurface[]
  ceilings: ParsedSurface[]
}

export interface ParsedTree {
  id: string
  preset: string
  size: Vector3Tuple
  seed: number
  treeType: string
  height: number
  foliageDensity: number
  trunkThickness: number
  leafless: boolean
  leafColor: string
  branchColor: string
  position: Vector3Tuple
  rotation: Vector3Tuple
}

export type SupportedRoofType = 'gable' | 'hip' | 'shed' | 'flat' | 'gambrel' | 'mansard' | 'dutch'

export interface ParsedRoofSegment {
  id: string
  roofType: SupportedRoofType
  position: Vector3Tuple
  rotationY: number
  width: number
  depth: number
  pitchDeg: number
  wallHeight: number
  overhang: number
  deckThickness: number
  approximate: boolean
}

export interface ParsedRoof {
  id: string
  levelId: string
  position: Vector3Tuple
  rotationY: number
  segments: ParsedRoofSegment[]
}

export interface ParsedPascalScene {
  levels: ParsedLevel[]
  trees: ParsedTree[]
  roofs: ParsedRoof[]
  analyticalOpenings: AnalyticalOpening[]
  report: ImportReport
}

export interface PascalValidationResult {
  valid: boolean
  scene: ParsedPascalScene | null
  message: string
}
