import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CumulativeSolarMesh } from '../../analysis/cumulativeSolar/CumulativeSolarMesh'
import {
  extractSolarOccluderTriangles,
  startCumulativeWorker,
  type CumulativeWorkerController,
} from '../../analysis/cumulativeSolar/cumulativeSolarClient'
import type {
  CumulativeAnalysisResult,
  CumulativeDisplayResult,
  CumulativeProgress,
  CumulativeRunCommand,
  CumulativeWorkerRequest,
} from '../../analysis/cumulativeSolar/cumulativeSolarTypes'
import { CurrentSunPreviewMesh } from '../../analysis/currentSunPreview/CurrentSunPreviewMesh'
import { buildFloorAnalysisGrids } from '../../analysis/surfaceSampling'
import {
  calculateWindowCurrentSolar,
  type SolarRaycast,
  type WindowCurrentSolarResult,
} from '../../analysis/windowCurrentSolar'
import type { SolarState } from '../../solar'
import type { AnalyticalOpening, ParsedPascalScene, Vector3Tuple } from './types'

export type AnalysisDisplayMode = 'normal' | 'current-sun-preview' | 'cumulative-solar-energy'

type LevelFloorAnalysisGrid = ReturnType<typeof buildFloorAnalysisGrids>[number] & { levelId: string }

interface SolarAnalysisLayerProps {
  parsedScene: ParsedPascalScene
  selectedOpening: AnalyticalOpening | null
  solarState: SolarState | null
  dniWm2: number | null | undefined
  displayMode: AnalysisDisplayMode
  cumulativeRunCommand: CumulativeRunCommand | null
  cumulativeCancelRequestId: number | null
  cumulativeResult: CumulativeDisplayResult | null
  onWindowSolarChange: (result: WindowCurrentSolarResult | null) => void
  onCumulativeProgress: (progress: CumulativeProgress) => void
  onCumulativeResult: (result: CumulativeAnalysisResult) => void
  onCumulativeError: (message: string | null) => void
  onCumulativeRunningChange: (running: boolean) => void
}

function ancestorData(object: THREE.Object3D, key: string): unknown {
  let current: THREE.Object3D | null = object
  while (current) {
    if (current.userData[key] !== undefined) return current.userData[key]
    current = current.parent
  }
  return undefined
}

function makeSolarRaycast(worldScene: THREE.Scene): SolarRaycast {
  worldScene.updateMatrixWorld(true)
  const raycaster = new THREE.Raycaster()
  ;(raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true
  raycaster.near = 0.001
  raycaster.far = 10_000
  const geometryOccluders: THREE.Object3D[] = []
  const treeBoxes: THREE.Box3[] = []
  worldScene.traverse((object) => {
    if (object.userData.solarOccluder === true && object.userData.obstructionKind === '树木') {
      treeBoxes.push(new THREE.Box3().setFromObject(object))
      return
    }
    if (object instanceof THREE.Mesh
      && ancestorData(object, 'solarOccluder') === true
      && ancestorData(object, 'obstructionKind') !== '树木') {
      geometryOccluders.push(object)
    }
  })
  return (origin, direction, skipSurfaceId) => {
    const originVector = new THREE.Vector3(...origin)
    raycaster.set(originVector, new THREE.Vector3(...direction).normalize())
    const intersection = raycaster.intersectObjects(geometryOccluders, false).find((hit) => (
      !skipSurfaceId || ancestorData(hit.object, 'surfaceId') !== skipSurfaceId
    ))
    let treeDistance = Number.POSITIVE_INFINITY
    const treeHit = new THREE.Vector3()
    for (const box of treeBoxes) {
      const hit = raycaster.ray.intersectBox(box, treeHit)
      if (hit) treeDistance = Math.min(treeDistance, hit.distanceTo(originVector))
    }
    const geometryDistance = intersection?.distance ?? Number.POSITIVE_INFINITY
    const blockedByTree = treeDistance < geometryDistance
    return {
      blocked: blockedByTree || Boolean(intersection),
      obstructionKind: blockedByTree
        ? '树木'
        : intersection ? String(ancestorData(intersection.object, 'obstructionKind') ?? '场景物体') : null,
    }
  }
}

export function SolarAnalysisLayer({
  parsedScene,
  selectedOpening,
  solarState,
  dniWm2,
  displayMode,
  cumulativeRunCommand,
  cumulativeCancelRequestId,
  cumulativeResult,
  onWindowSolarChange,
  onCumulativeProgress,
  onCumulativeResult,
  onCumulativeError,
  onCumulativeRunningChange,
}: SolarAnalysisLayerProps) {
  const worldScene = useThree((state) => state.scene)
  const workerController = useRef<CumulativeWorkerController | null>(null)
  const cumulativeGrids = useMemo<LevelFloorAnalysisGrid[]>(
    () => parsedScene.levels.flatMap((level) => buildFloorAnalysisGrids(level.slabs, 0.35).map((grid) => ({
      ...grid,
      levelId: level.id,
    }))),
    [parsedScene.levels],
  )
  const cumulativeOpenings = useMemo(
    () => parsedScene.analyticalOpenings.filter((opening) => opening.enabled),
    [parsedScene.analyticalOpenings],
  )
  const sunDirection = solarState?.worldDirection as Vector3Tuple | undefined

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!selectedOpening || !sunDirection) {
        onWindowSolarChange(null)
        return
      }
      onWindowSolarChange(calculateWindowCurrentSolar(
        selectedOpening,
        sunDirection,
        dniWm2,
        makeSolarRaycast(worldScene),
      ))
    }, 160)
    return () => window.clearTimeout(timer)
  }, [dniWm2, onWindowSolarChange, selectedOpening, sunDirection, worldScene])

  useEffect(() => {
    if (!cumulativeRunCommand) return
    workerController.current?.dispose()
    onCumulativeError(null)
    onCumulativeRunningChange(true)
    const request: CumulativeWorkerRequest = {
      type: 'start',
      requestId: cumulativeRunCommand.requestId,
      triangles: extractSolarOccluderTriangles(worldScene),
      grids: cumulativeGrids.map((grid) => ({
        surfaceId: grid.surfaceId,
        levelId: grid.levelId,
        positions: grid.positions.slice(),
        indices: grid.indices.slice(),
      })),
      openings: cumulativeOpenings,
      hours: cumulativeRunCommand.hours,
      solarInput: cumulativeRunCommand.solarInput,
      rangeKey: cumulativeRunCommand.rangeKey,
      rangeLabel: cumulativeRunCommand.rangeLabel,
    }
    workerController.current = startCumulativeWorker(request, (message) => {
      if (message.requestId !== cumulativeRunCommand.requestId) return
      if (message.type === 'progress') {
        onCumulativeProgress({
          processedHours: message.processedHours,
          totalHours: message.totalHours,
          progressPct: message.progressPct,
        })
      } else if (message.type === 'result') {
        onCumulativeRunningChange(false)
        onCumulativeResult(message.result)
        workerController.current?.dispose()
        workerController.current = null
      } else if (message.type === 'cancelled') {
        onCumulativeRunningChange(false)
        workerController.current?.dispose()
        workerController.current = null
      } else if (message.type === 'error') {
        onCumulativeRunningChange(false)
        onCumulativeError(message.message)
        workerController.current?.dispose()
        workerController.current = null
      }
    })
    return () => {
      workerController.current?.dispose()
      workerController.current = null
    }
  }, [
    cumulativeGrids,
    cumulativeOpenings,
    cumulativeRunCommand,
    onCumulativeError,
    onCumulativeProgress,
    onCumulativeResult,
    onCumulativeRunningChange,
    worldScene,
  ])

  useEffect(() => {
    if (cumulativeCancelRequestId !== null && cumulativeCancelRequestId === cumulativeRunCommand?.requestId) {
      workerController.current?.cancel()
    }
  }, [cumulativeCancelRequestId, cumulativeRunCommand?.requestId])

  if (displayMode === 'current-sun-preview') {
    return <>{cumulativeGrids.map((grid) => (
      <CurrentSunPreviewMesh
        key={grid.surfaceId}
        grid={grid}
        dniWm2={dniWm2}
        sunAboveHorizon={Boolean(solarState?.isAboveHorizon)}
      />
    ))}</>
  }
  if (displayMode === 'cumulative-solar-energy' && cumulativeResult && cumulativeResult.lockedScaleMaxKWhM2 > 0) {
    return <>{cumulativeGrids.map((grid) => {
      const result = cumulativeResult.grids.find((candidate) => candidate.surfaceId === grid.surfaceId)
      return result ? (
        <CumulativeSolarMesh
          key={grid.surfaceId}
          grid={grid}
          result={result}
          lockedScaleMaxKWhM2={cumulativeResult.lockedScaleMaxKWhM2}
        />
      ) : null
    })}</>
  }
  return null
}
