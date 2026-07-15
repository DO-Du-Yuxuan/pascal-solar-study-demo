import type { AnalyticalOpening, Vector3Tuple } from '../../scene/pascal/types'

export type CumulativeRangeKind = 'day' | 'month' | 'summer' | 'winter' | 'year' | 'custom'

export interface CumulativeRangeSelection {
  kind: CumulativeRangeKind
  startDate: string
  endDate: string
}

export interface CumulativeHourRecord {
  utcTime: string
  dniWm2: number | null
}

export interface CumulativeGridInput {
  surfaceId: string
  levelId: string
  positions: Float32Array
  indices: Uint32Array
}

export interface CumulativeWorkerRequest {
  type: 'start'
  requestId: number
  triangles: Float32Array
  grids: CumulativeGridInput[]
  openings: AnalyticalOpening[]
  hours: CumulativeHourRecord[]
  solarInput: {
    latitude: number
    longitude: number
    timeZone: string
    northOffsetDeg: number
  }
  rangeKey: string
  rangeLabel: string
}

export interface CumulativeCancelRequest {
  type: 'cancel'
  requestId: number
}

export interface CumulativeGridResult {
  surfaceId: string
  levelId: string
  energyKWhM2: Float32Array
  directSunHours: Float32Array
}

export interface CumulativeAnalysisResult {
  requestId: number
  rangeKey: string
  rangeLabel: string
  totalHours: number
  validWeatherHours: number
  processedSolarHours: number
  actualMaximumKWhM2: number
  affectedAreaM2: number
  maximumDirectSunHours: number
  averageDirectSunHours: number
  grids: CumulativeGridResult[]
}

export type CumulativeWorkerResponse =
  | { type: 'progress'; requestId: number; processedHours: number; totalHours: number; progressPct: number }
  | { type: 'result'; requestId: number; result: CumulativeAnalysisResult }
  | { type: 'cancelled'; requestId: number }
  | { type: 'error'; requestId: number; message: string }

export interface CumulativeRunCommand {
  requestId: number
  rangeKey: string
  rangeLabel: string
  hours: CumulativeHourRecord[]
  solarInput: CumulativeWorkerRequest['solarInput']
}

export interface CumulativeProgress {
  processedHours: number
  totalHours: number
  progressPct: number
}

export interface CumulativeDisplayResult extends CumulativeAnalysisResult {
  lockedScaleMaxKWhM2: number
  stale: boolean
}

export const FLOOR_NORMAL: Vector3Tuple = [0, 1, 0]
