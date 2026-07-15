import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { FloorAnalysisGrid } from '../surfaceSampling'
import {
  createCurrentSunPreviewMaterial,
  currentSunPreviewOpacity,
} from './CurrentSunPreviewMaterial'

export function CurrentSunPreviewMesh({
  grid,
  dniWm2,
  sunAboveHorizon,
}: {
  grid: FloorAnalysisGrid
  dniWm2: number | null | undefined
  sunAboveHorizon: boolean
}) {
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(grid.positions, 3))
    result.setIndex(new THREE.BufferAttribute(grid.indices, 1))
    result.computeVertexNormals()
    result.computeBoundingBox()
    result.computeBoundingSphere()
    return result
  }, [grid])
  const material = useMemo(() => createCurrentSunPreviewMaterial(), [])
  const opacity = currentSunPreviewOpacity(dniWm2, sunAboveHorizon)
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])
  return (
    <mesh
      geometry={geometry}
      castShadow={false}
      receiveShadow
      frustumCulled={false}
      renderOrder={9}
    >
      <primitive object={material} attach="material" opacity={opacity} />
    </mesh>
  )
}
