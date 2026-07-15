import { DateTime } from 'luxon'
import * as THREE from 'three'
import type { WeatherDataset } from '../../weather/types'
import type {
  CumulativeHourRecord,
  CumulativeRangeSelection,
  CumulativeWorkerRequest,
  CumulativeWorkerResponse,
} from './cumulativeSolarTypes'

function ancestorData(object: THREE.Object3D, key: string): unknown {
  let current: THREE.Object3D | null = object
  while (current) {
    if (current.userData[key] !== undefined) return current.userData[key]
    current = current.parent
  }
  return undefined
}

function appendTriangle(target: number[], first: THREE.Vector3, second: THREE.Vector3, third: THREE.Vector3): void {
  target.push(first.x, first.y, first.z, second.x, second.y, second.z, third.x, third.y, third.z)
}

export function extractSolarOccluderTriangles(worldScene: THREE.Scene): Float32Array {
  worldScene.updateMatrixWorld(true)
  const triangles: number[] = []
  const first = new THREE.Vector3()
  const second = new THREE.Vector3()
  const third = new THREE.Vector3()
  worldScene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || ancestorData(object, 'solarOccluder') !== true) return
    const position = object.geometry.getAttribute('position')
    if (!position) return
    const index = object.geometry.getIndex()
    const triangleCount = index ? index.count / 3 : position.count / 3
    const instanceCount = object instanceof THREE.InstancedMesh ? object.count : 1
    const instanceMatrix = new THREE.Matrix4()
    const worldMatrix = new THREE.Matrix4()
    for (let instance = 0; instance < instanceCount; instance += 1) {
      if (object instanceof THREE.InstancedMesh) object.getMatrixAt(instance, instanceMatrix)
      else instanceMatrix.identity()
      worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix)
      for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const a = index?.getX(triangle * 3) ?? triangle * 3
        const b = index?.getX(triangle * 3 + 1) ?? triangle * 3 + 1
        const c = index?.getX(triangle * 3 + 2) ?? triangle * 3 + 2
        first.fromBufferAttribute(position, a).applyMatrix4(worldMatrix)
        second.fromBufferAttribute(position, b).applyMatrix4(worldMatrix)
        third.fromBufferAttribute(position, c).applyMatrix4(worldMatrix)
        appendTriangle(triangles, first, second, third)
      }
    }
  })
  return new Float32Array(triangles)
}

function localDate(record: { utcTime: string }, timeZone: string): DateTime {
  return DateTime.fromISO(record.utcTime, { zone: 'utc' }).setZone(timeZone)
}

export function rangeKey(selection: CumulativeRangeSelection, currentDate: string): string {
  if (selection.kind === 'day') return `day:${currentDate}`
  if (selection.kind === 'month') return `month:${currentDate.slice(0, 7)}`
  if (selection.kind === 'custom') return `custom:${selection.startDate}:${selection.endDate}`
  return selection.kind
}

export function rangeLabel(selection: CumulativeRangeSelection, currentDate: string): string {
  if (selection.kind === 'day') return `${currentDate}（一天）`
  if (selection.kind === 'month') return `${currentDate.slice(0, 7)}（一个月）`
  if (selection.kind === 'summer') return '2025-06-01 至 2025-08-31（夏季）'
  if (selection.kind === 'winter') return '2025-01-01 至 2025-02-28，加 2025-12-01 至 2025-12-31（冬季）'
  if (selection.kind === 'year') return '2025 全年'
  return `${selection.startDate} 至 ${selection.endDate}（自定义）`
}

export function selectCumulativeHours(
  dataset: WeatherDataset,
  selection: CumulativeRangeSelection,
  currentDate: string,
): CumulativeHourRecord[] {
  const monthKey = currentDate.slice(0, 7)
  return dataset.records.filter((record) => {
    const local = localDate(record, dataset.metadata.displayTimeZone)
    if (local.year !== 2025) return false
    const date = local.toISODate() ?? ''
    if (selection.kind === 'day') return date === currentDate
    if (selection.kind === 'month') return date.startsWith(monthKey)
    if (selection.kind === 'summer') return date >= '2025-06-01' && date <= '2025-08-31'
    if (selection.kind === 'winter') return date <= '2025-02-28' || date >= '2025-12-01'
    if (selection.kind === 'year') return true
    return date >= selection.startDate && date <= selection.endDate
  }).map(({ utcTime, dniWm2 }) => ({ utcTime, dniWm2 }))
}

export interface CumulativeWorkerController {
  cancel: () => void
  dispose: () => void
}

export function startCumulativeWorker(
  request: CumulativeWorkerRequest,
  onMessage: (message: CumulativeWorkerResponse) => void,
): CumulativeWorkerController {
  const worker = new Worker(new URL('./cumulativeSolarWorker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<CumulativeWorkerResponse>) => onMessage(event.data)
  worker.onerror = (event) => onMessage({ type: 'error', requestId: request.requestId, message: event.message || '累计分析 Worker 运行失败。' })
  const transferables: Transferable[] = [request.triangles.buffer]
  for (const grid of request.grids) transferables.push(grid.positions.buffer, grid.indices.buffer)
  worker.postMessage(request, transferables)
  return {
    cancel: () => worker.postMessage({ type: 'cancel', requestId: request.requestId }),
    dispose: () => worker.terminate(),
  }
}
