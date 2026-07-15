import { Tree, TreePreset } from '@dgreenheck/ez-tree'
import type { ThreeEvent } from '@react-three/fiber'
import { Bvh } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { SceneBounds } from '../SceneSource'
import { Roofs } from './RoofGeometry'
import type { ParsedOpening, ParsedPascalScene, ParsedSurface, ParsedTree, ParsedWall } from './types'
import { createWallPieces, pointAndTangentAlongWall } from './wallGeometry'

const wallMaterial = { color: '#d7d0c4', roughness: 0.88 }
const slabMaterial = { color: '#aeb7b5', roughness: 0.92 }
const ceilingMaterial = { color: '#dfe2df', roughness: 0.92 }
const frameMaterial = { color: '#e5e3dc', roughness: 0.72 }
const doorMaterial = { color: '#92745b', roughness: 0.78 }

function OpeningAssembly({ opening, wall, levelElevation, selected, onSelect }: {
  opening: ParsedOpening
  wall: ParsedWall
  levelElevation: number
  selected: boolean
  onSelect: (id: string) => void
}) {
  const location = pointAndTangentAlongWall(wall, opening.offsetAlongWall)
  const yaw = Math.atan2(location.tangent[0], location.tangent[1])
  const frame = Math.min(opening.frameThickness, opening.width * 0.2, opening.height * 0.2)
  const innerWidth = Math.max(0.02, opening.width - frame * 2)
  const innerHeight = Math.max(0.02, opening.height - frame * 2)
  const depth = Math.max(wall.thickness + 0.025, opening.frameDepth)
  const glassHeight = opening.kind === 'door' ? innerHeight * opening.glassHeightRatio : innerHeight
  const panelHeight = Math.max(0, innerHeight - glassHeight)
  const glassCenterY = -innerHeight / 2 + panelHeight + glassHeight / 2
  return (
    <group
      name={`Pascal ${opening.kind} ${opening.id}`}
      position={[location.point[0], levelElevation + opening.centerHeight, location.point[1]]}
      rotation={[0, yaw, 0]}
      userData={{ openingId: opening.id }}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation()
        onSelect(opening.id)
      }}
    >
      <mesh renderOrder={10}>
        <boxGeometry args={[wall.thickness + 0.08, opening.height, opening.width]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {opening.enabled && (
        <>
      <mesh castShadow receiveShadow position={[0, 0, -opening.width / 2 + frame / 2]}>
        <boxGeometry args={[depth, opening.height, frame]} />
        <meshStandardMaterial {...frameMaterial} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0, opening.width / 2 - frame / 2]}>
        <boxGeometry args={[depth, opening.height, frame]} />
        <meshStandardMaterial {...frameMaterial} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, opening.height / 2 - frame / 2, 0]}>
        <boxGeometry args={[depth, frame, innerWidth]} />
        <meshStandardMaterial {...frameMaterial} />
      </mesh>
      {opening.kind === 'window' && (
        <mesh castShadow receiveShadow position={[0, -opening.height / 2 + frame / 2, 0]}>
          <boxGeometry args={[depth, frame, innerWidth]} />
          <meshStandardMaterial {...frameMaterial} />
        </mesh>
      )}
      {glassHeight > 0.02 && (
        <mesh receiveShadow position={[0, glassCenterY, 0]}>
          <boxGeometry args={[0.018, glassHeight, innerWidth]} />
          <meshPhysicalMaterial color="#9fc3cf" transparent opacity={0.28} roughness={0.12} metalness={0.05} depthWrite={false} />
        </mesh>
      )}
      {opening.kind === 'door' && panelHeight > 0.02 && (
        <mesh castShadow receiveShadow position={[0, -innerHeight / 2 + panelHeight / 2, 0]}>
          <boxGeometry args={[Math.max(0.035, wall.thickness * 0.35), panelHeight, innerWidth]} />
          <meshStandardMaterial {...doorMaterial} />
        </mesh>
      )}
      {opening.kind === 'door' && glassHeight <= 0.02 && (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[Math.max(0.035, wall.thickness * 0.35), innerHeight, innerWidth]} />
          <meshStandardMaterial {...doorMaterial} />
        </mesh>
      )}
        </>
      )}
      {selected && (
        <mesh renderOrder={12}>
          <boxGeometry args={[wall.thickness + 0.12, opening.height + 0.06, opening.width + 0.06]} />
          <meshBasicMaterial color="#ff7a2f" wireframe depthTest={false} transparent opacity={0.95} />
        </mesh>
      )}
    </group>
  )
}

function WallGeometry({ levelElevation, walls, selectedOpeningId, onOpeningSelect }: {
  levelElevation: number
  walls: ParsedPascalScene['levels'][number]['walls']
  selectedOpeningId: string | null
  onOpeningSelect: (id: string) => void
}) {
  const pieces = useMemo(() => walls.flatMap(createWallPieces), [walls])
  return (
    <>
      {pieces.map((piece) => {
        const dx = piece.end[0] - piece.start[0]
        const dz = piece.end[1] - piece.start[1]
        const length = Math.hypot(dx, dz)
        return (
          <mesh
            key={piece.id}
            castShadow
            receiveShadow
            position={[
              (piece.start[0] + piece.end[0]) / 2,
              levelElevation + piece.bottom + piece.height / 2,
              (piece.start[1] + piece.end[1]) / 2,
            ]}
            rotation={[0, Math.atan2(dx, dz), 0]}
            userData={{ solarOccluder: true, obstructionKind: '墙体', surfaceId: piece.wallId }}
          >
            <boxGeometry args={[piece.thickness, piece.height, length]} />
            <meshStandardMaterial {...wallMaterial} />
          </mesh>
        )
      })}
      {walls.flatMap((wall) => wall.openings.map((opening) => (
        <OpeningAssembly
          key={opening.id}
          opening={opening}
          wall={wall}
          levelElevation={levelElevation}
          selected={opening.id === selectedOpeningId}
          onSelect={onOpeningSelect}
        />
      )))}
    </>
  )
}

function makeSurfaceGeometry(surface: ParsedSurface): THREE.ExtrudeGeometry {
  const toVectors = (loop: ParsedSurface['polygon']) => loop.map(([x, z]) => new THREE.Vector2(x, -z))
  const outer = toVectors(surface.polygon)
  if (!THREE.ShapeUtils.isClockWise(outer)) outer.reverse()
  const shape = new THREE.Shape(outer)
  for (const holeLoop of surface.holes) {
    const hole = toVectors(holeLoop)
    if (THREE.ShapeUtils.isClockWise(hole)) hole.reverse()
    shape.holes.push(new THREE.Path(hole))
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: surface.thickness, bevelEnabled: false, curveSegments: 1 })
  geometry.computeVertexNormals()
  return geometry
}

function Surface({ surface, kind }: { surface: ParsedSurface; kind: 'slab' | 'ceiling' }) {
  const geometry = useMemo(() => makeSurfaceGeometry(surface), [surface])
  return (
    <mesh
      geometry={geometry}
      position={[0, surface.elevation, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
      userData={{ solarOccluder: true, obstructionKind: kind === 'slab' ? '楼板' : '天花', surfaceId: surface.id }}
    >
      <meshStandardMaterial {...(kind === 'slab' ? slabMaterial : ceilingMaterial)} side={THREE.DoubleSide} />
    </mesh>
  )
}

const presetNames = new Set(Object.keys(TreePreset))

function normalizedPreset(value: string): string {
  if (presetNames.has(value)) return value
  const lower = value.toLowerCase()
  const species = lower.includes('pine') ? 'Pine' : lower.includes('ash') ? 'Ash' : lower.includes('aspen') ? 'Aspen' : 'Oak'
  const size = lower.includes('small') ? 'Small' : lower.includes('large') ? 'Large' : 'Medium'
  return `${species} ${size}`
}

function colorNumber(value: string, fallback: number): number {
  const color = new THREE.Color()
  try {
    color.set(value)
    return color.getHex()
  } catch {
    return fallback
  }
}

function treeSignature(tree: ParsedTree): string {
  return JSON.stringify([
    tree.preset, tree.size, tree.seed, tree.treeType, tree.height, tree.foliageDensity,
    tree.trunkThickness, tree.leafless, tree.leafColor, tree.branchColor,
  ])
}

function generateTree(spec: ParsedTree): Tree {
  const tree = new Tree()
  tree.loadPreset(normalizedPreset(spec.preset))
  tree.options.seed = spec.seed
  tree.options.type = spec.treeType.includes('evergreen') || spec.treeType.includes('pine') ? 'evergreen' : 'deciduous'
  tree.options.branch.radius[0] = spec.trunkThickness
  tree.options.leaves.count = spec.leafless ? 0 : Math.max(1, Math.min(4, Math.round(spec.foliageDensity * 2)))
  tree.options.leaves.tint = colorNumber(spec.leafColor, 0x6f914d)
  tree.options.bark.tint = colorNumber(spec.branchColor, 0x7a5940)
  tree.options.leaves.alphaTest = 0.5
  tree.generate()
  tree.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  return tree
}

function Trees({ trees }: { trees: ParsedTree[] }) {
  const objects = useMemo(() => {
    const cache = new Map<string, Tree>()
    return trees.map((spec) => {
      const signature = treeSignature(spec)
      let source = cache.get(signature)
      if (!source) {
        source = generateTree(spec)
        cache.set(signature, source)
      }
      const object = source.clone(true)
      const bounds = new THREE.Box3().setFromObject(object)
      const generatedHeight = Math.max(0.001, bounds.max.y - bounds.min.y)
      const heightScale = spec.height / generatedHeight
      object.scale.set(heightScale * spec.size[0], heightScale * spec.size[1], heightScale * spec.size[2])
      object.position.set(...spec.position)
      object.rotation.set(...spec.rotation)
      object.name = `Pascal tree ${spec.id}`
      object.userData.solarOccluder = true
      object.userData.obstructionKind = '树木'
      return { id: spec.id, object }
    })
  }, [trees])
  return objects.map(({ id, object }) => <primitive key={id} object={object} />)
}

interface PascalSceneProps {
  scene: ParsedPascalScene
  onBoundsChange: (bounds: SceneBounds) => void
  selectedOpeningId: string | null
  onOpeningSelect: (id: string) => void
}

export function PascalScene({ scene, onBoundsChange, selectedOpeningId, onOpeningSelect }: PascalSceneProps) {
  const group = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    if (!group.current) return
    group.current.updateWorldMatrix(true, true)
    const bounds = new THREE.Box3().setFromObject(group.current)
    if (bounds.isEmpty()) return
    onBoundsChange({ min: bounds.min.toArray(), max: bounds.max.toArray() })
  }, [scene, onBoundsChange])

  return (
    <group ref={group}>
      <Bvh firstHitOnly maxLeafTris={20}>
        {scene.levels.map((level) => (
          <group key={level.id} name={level.name}>
            <WallGeometry
              levelElevation={level.elevation}
              walls={level.walls}
              selectedOpeningId={selectedOpeningId}
              onOpeningSelect={onOpeningSelect}
            />
            {level.slabs.map((surface) => <Surface key={surface.id} surface={surface} kind="slab" />)}
            {level.ceilings.map((surface) => <Surface key={surface.id} surface={surface} kind="ceiling" />)}
          </group>
        ))}
        <Roofs roofs={scene.roofs} />
      </Bvh>
      <Trees trees={scene.trees} />
    </group>
  )
}
