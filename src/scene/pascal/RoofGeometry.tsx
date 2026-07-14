import { useMemo } from 'react'
import * as THREE from 'three'
import type { ParsedRoof, ParsedRoofSegment, Vector3Tuple } from './types'

const roofMaterial = { color: '#7e6f63', roughness: 0.9, side: THREE.DoubleSide }

function makeFacePrism(points: Vector3Tuple[], thickness: number): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const count = points.length
  for (const point of points) positions.push(...point)
  for (const point of points) positions.push(point[0], point[1] - thickness, point[2])
  for (let index = 1; index < count - 1; index += 1) {
    indices.push(0, index, index + 1)
    indices.push(count, count + index + 1, count + index)
  }
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count
    indices.push(index, count + index, count + next, index, count + next, next)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function Face({ points, thickness }: { points: Vector3Tuple[]; thickness: number }) {
  const geometry = useMemo(() => makeFacePrism(points, thickness), [points, thickness])
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial {...roofMaterial} />
    </mesh>
  )
}

function GableRoof({ segment }: { segment: ParsedRoofSegment }) {
  const width = segment.width + segment.overhang * 2
  const depth = segment.depth + segment.overhang * 2
  const eave = segment.wallHeight
  const ridge = eave + segment.depth / 2 * Math.tan(THREE.MathUtils.degToRad(segment.pitchDeg))
  const faces = useMemo<Vector3Tuple[][]>(() => [
    [[-width / 2, eave, depth / 2], [width / 2, eave, depth / 2], [width / 2, ridge, 0], [-width / 2, ridge, 0]],
    [[width / 2, eave, -depth / 2], [-width / 2, eave, -depth / 2], [-width / 2, ridge, 0], [width / 2, ridge, 0]],
  ], [depth, eave, ridge, width])
  return <>{faces.map((points, index) => <Face key={index} points={points} thickness={segment.deckThickness} />)}</>
}

function ShedRoof({ segment }: { segment: ParsedRoofSegment }) {
  const width = segment.width + segment.overhang * 2
  const depth = segment.depth + segment.overhang * 2
  const low = segment.wallHeight
  const high = low + segment.depth * Math.tan(THREE.MathUtils.degToRad(segment.pitchDeg))
  const points = useMemo<Vector3Tuple[]>(() => [
    [-width / 2, low, depth / 2], [width / 2, low, depth / 2],
    [width / 2, high, -depth / 2], [-width / 2, high, -depth / 2],
  ], [depth, high, low, width])
  return <Face points={points} thickness={segment.deckThickness} />
}

function HipRoof({ segment }: { segment: ParsedRoofSegment }) {
  const width = segment.width + segment.overhang * 2
  const depth = segment.depth + segment.overhang * 2
  const halfWidth = width / 2
  const halfDepth = depth / 2
  const rise = Math.min(segment.width, segment.depth) / 2 * Math.tan(THREE.MathUtils.degToRad(segment.pitchDeg))
  const eave = segment.wallHeight
  const ridge = eave + rise
  const faces = useMemo<Vector3Tuple[][]>(() => {
    if (width >= depth) {
      const ridgeHalf = Math.max(0, (width - depth) / 2)
      return [
        [[-halfWidth, eave, -halfDepth], [halfWidth, eave, -halfDepth], [ridgeHalf, ridge, 0], [-ridgeHalf, ridge, 0]],
        [[-halfWidth, eave, halfDepth], [-ridgeHalf, ridge, 0], [ridgeHalf, ridge, 0], [halfWidth, eave, halfDepth]],
        [[-halfWidth, eave, -halfDepth], [-ridgeHalf, ridge, 0], [-halfWidth, eave, halfDepth]],
        [[halfWidth, eave, -halfDepth], [halfWidth, eave, halfDepth], [ridgeHalf, ridge, 0]],
      ]
    }
    const ridgeHalf = Math.max(0, (depth - width) / 2)
    return [
      [[-halfWidth, eave, -halfDepth], [halfWidth, eave, -halfDepth], [0, ridge, -ridgeHalf]],
      [[-halfWidth, eave, halfDepth], [0, ridge, ridgeHalf], [halfWidth, eave, halfDepth]],
      [[-halfWidth, eave, -halfDepth], [0, ridge, -ridgeHalf], [0, ridge, ridgeHalf], [-halfWidth, eave, halfDepth]],
      [[halfWidth, eave, -halfDepth], [halfWidth, eave, halfDepth], [0, ridge, ridgeHalf], [0, ridge, -ridgeHalf]],
    ]
  }, [depth, eave, halfDepth, halfWidth, ridge, width])
  return <>{faces.map((points, index) => <Face key={index} points={points} thickness={segment.deckThickness} />)}</>
}

function RoofSegment({ segment }: { segment: ParsedRoofSegment }) {
  const content = segment.roofType === 'flat'
    ? (
      <mesh castShadow receiveShadow position={[0, segment.wallHeight, 0]}>
        <boxGeometry args={[segment.width + segment.overhang * 2, segment.deckThickness, segment.depth + segment.overhang * 2]} />
        <meshStandardMaterial {...roofMaterial} />
      </mesh>
    )
    : segment.roofType === 'hip' || segment.roofType === 'mansard'
      ? <HipRoof segment={segment} />
      : segment.roofType === 'shed'
        ? <ShedRoof segment={segment} />
        : <GableRoof segment={segment} />

  return <group position={segment.position} rotation={[0, segment.rotationY, 0]}>{content}</group>
}

export function Roofs({ roofs }: { roofs: ParsedRoof[] }) {
  return roofs.map((roof) => (
    <group key={roof.id} position={roof.position} rotation={[0, roof.rotationY, 0]} name={`Pascal roof ${roof.id}`}>
      {roof.segments.map((segment) => <RoofSegment key={segment.id} segment={segment} />)}
    </group>
  ))
}
