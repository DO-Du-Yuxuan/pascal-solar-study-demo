import { useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { FloorAnalysisGrid } from '../surfaceSampling'
import { cumulativeColor } from './colorScale'
import type { CumulativeGridResult } from './cumulativeSolarTypes'

const vertexShader = /* glsl */`
attribute vec3 analysisColor;
attribute float analysisAlpha;
varying vec3 vColor;
varying float vAnalysisAlpha;
void main() {
  vColor = analysisColor;
  vAnalysisAlpha = analysisAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */`
varying vec3 vColor;
varying float vAnalysisAlpha;
void main() {
  if (vAnalysisAlpha <= 0.001) discard;
  gl_FragColor = vec4(vColor, vAnalysisAlpha);
}
`

export function CumulativeSolarMesh({
  grid,
  result,
  lockedScaleMaxKWhM2,
}: {
  grid: FloorAnalysisGrid
  result: CumulativeGridResult
  lockedScaleMaxKWhM2: number
}) {
  const geometry = useMemo(() => {
    const output = new THREE.BufferGeometry()
    output.setAttribute('position', new THREE.BufferAttribute(grid.positions, 3))
    output.setAttribute('analysisColor', new THREE.BufferAttribute(new Float32Array(grid.vertexCount * 3), 3))
    output.setAttribute('analysisAlpha', new THREE.BufferAttribute(new Float32Array(grid.vertexCount), 1))
    output.setIndex(new THREE.BufferAttribute(grid.indices, 1))
    output.computeBoundingBox()
    output.computeBoundingSphere()
    return output
  }, [grid])
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    toneMapped: false,
  }), [])
  useLayoutEffect(() => {
    const colorAttribute = geometry.getAttribute('analysisColor') as THREE.BufferAttribute
    const alphaAttribute = geometry.getAttribute('analysisAlpha') as THREE.BufferAttribute
    for (let index = 0; index < grid.vertexCount; index += 1) {
      const value = result.energyKWhM2[index] ?? 0
      const mapped = cumulativeColor(value, lockedScaleMaxKWhM2)
      colorAttribute.setXYZ(index, mapped.color.r, mapped.color.g, mapped.color.b)
      alphaAttribute.setX(index, mapped.alpha)
    }
    colorAttribute.needsUpdate = true
    alphaAttribute.needsUpdate = true
  }, [geometry, grid.vertexCount, lockedScaleMaxKWhM2, result])
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])
  return (
    <mesh
      geometry={geometry}
      material={material}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
      renderOrder={10}
    />
  )
}
