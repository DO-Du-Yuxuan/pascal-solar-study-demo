import type { ThreeElements } from '@react-three/fiber'

const wallMaterial = { color: '#d9d1c2', roughness: 0.86 }
const trimMaterial = { color: '#44525a', roughness: 0.64 }
const slabMaterial = { color: '#aeb5b4', roughness: 0.9 }
const roofMaterial = { color: '#55656a', roughness: 0.82 }

interface BoxProps {
  args: [number, number, number]
  position: [number, number, number]
  rotation?: [number, number, number]
  material?: typeof wallMaterial
}

function BuildingBox({ args, position, rotation, material = wallMaterial }: BoxProps) {
  return (
    <mesh
      castShadow
      receiveShadow
      position={position}
      rotation={rotation}
    >
      <boxGeometry args={args} />
      <meshStandardMaterial {...material} />
    </mesh>
  )
}

function SouthFacade() {
  return (
    <>
      {/* Ground floor: segments leave a real door and a wide window opening. */}
      <BuildingBox args={[1.1, 3, 0.24]} position={[-3.95, 1.62, -4]} />
      <BuildingBox args={[1.9, 3, 0.24]} position={[-1.35, 1.62, -4]} />
      <BuildingBox args={[2.6, 0.7, 0.24]} position={[1.15, 0.47, -4]} />
      <BuildingBox args={[2.6, 0.65, 0.24]} position={[1.15, 2.795, -4]} />
      <BuildingBox args={[0.55, 3, 0.24]} position={[2.725, 1.62, -4]} />
      <BuildingBox args={[0.85, 0.55, 0.24]} position={[3.425, 2.87, -4]} />
      <BuildingBox args={[0.85, 0.42, 0.24]} position={[3.425, 0.34, -4]} />

      {/* Upper floor: two large south-facing openings. */}
      <BuildingBox args={[0.8, 2.9, 0.24]} position={[-4.1, 4.62, -4]} />
      <BuildingBox args={[2.5, 0.55, 0.24]} position={[-2.45, 3.445, -4]} />
      <BuildingBox args={[2.5, 0.55, 0.24]} position={[-2.45, 5.795, -4]} />
      <BuildingBox args={[0.55, 2.9, 0.24]} position={[-0.925, 4.62, -4]} />
      <BuildingBox args={[2.5, 0.55, 0.24]} position={[0.6, 3.445, -4]} />
      <BuildingBox args={[2.5, 0.55, 0.24]} position={[0.6, 5.795, -4]} />
      <BuildingBox args={[0.55, 2.9, 0.24]} position={[2.125, 4.62, -4]} />
      <BuildingBox args={[2.1, 2.9, 0.24]} position={[3.45, 4.62, -4]} />

      {/* Minimal structural trim describes the open apertures without glass. */}
      <BuildingBox args={[2.65, 0.08, 0.12]} position={[1.15, 2.5, -4.14]} material={trimMaterial} />
      <BuildingBox args={[0.08, 1.9, 0.12]} position={[-0.15, 1.55, -4.14]} material={trimMaterial} />
    </>
  )
}

function NorthFacade() {
  return (
    <>
      {[1.62, 4.62].map((y) => (
        <group key={y}>
          <BuildingBox args={[3.45, 2.9, 0.24]} position={[-2.775, y, 4]} />
          <BuildingBox args={[1.7, 0.65, 0.24]} position={[0, y - 1.125, 4]} />
          <BuildingBox args={[1.7, 0.65, 0.24]} position={[0, y + 1.125, 4]} />
          <BuildingBox args={[3.45, 2.9, 0.24]} position={[2.775, y, 4]} />
        </group>
      ))}
    </>
  )
}

function SideFacade({ x }: { x: number }) {
  return (
    <>
      {[1.62, 4.62].map((y) => (
        <group key={y}>
          <BuildingBox args={[0.24, 2.9, 3.1]} position={[x, y, -2.45]} />
          <BuildingBox args={[0.24, 0.65, 1.8]} position={[x, y - 1.125, 0]} />
          <BuildingBox args={[0.24, 0.65, 1.8]} position={[x, y + 1.125, 0]} />
          <BuildingBox args={[0.24, 2.9, 3.1]} position={[x, y, 2.45]} />
        </group>
      ))}
    </>
  )
}

function Balcony() {
  return (
    <group>
      <BuildingBox args={[3.4, 0.18, 1.35]} position={[-2.55, 3.22, -4.55]} material={slabMaterial} />
      <BuildingBox args={[0.16, 2.9, 0.16]} position={[-4.05, 1.72, -5.05]} material={trimMaterial} />
      <BuildingBox args={[0.16, 2.9, 0.16]} position={[-1.05, 1.72, -5.05]} material={trimMaterial} />
      <BuildingBox args={[3.25, 0.1, 0.1]} position={[-2.55, 4.15, -5.15]} material={trimMaterial} />
      {[-4.05, -3.3, -2.55, -1.8, -1.05].map((x) => (
        <BuildingBox key={x} args={[0.08, 0.9, 0.08]} position={[x, 3.72, -5.15]} material={trimMaterial} />
      ))}
    </group>
  )
}

function InteriorPartition() {
  return (
    <group>
      {/* Partition at x=0 with a genuine internal doorway. */}
      <BuildingBox args={[0.18, 3, 2.6]} position={[0, 1.62, -2.7]} />
      <BuildingBox args={[0.18, 0.7, 1.2]} position={[0, 2.77, -0.8]} />
      <BuildingBox args={[0.18, 3, 3.8]} position={[0, 1.62, 2.1]} />
    </group>
  )
}

export function DemoBuilding(props: ThreeElements['group']) {
  return (
    <group {...props}>
      <BuildingBox args={[9.2, 0.22, 8.2]} position={[0, 0.11, 0]} material={slabMaterial} />
      <BuildingBox args={[9.2, 0.22, 8.2]} position={[0, 3.12, 0]} material={slabMaterial} />
      <SouthFacade />
      <NorthFacade />
      <SideFacade x={-4.5} />
      <SideFacade x={4.5} />
      <InteriorPartition />
      <Balcony />

      {/* Stable two-plane pitched roof; ridge runs north-south. */}
      <BuildingBox
        args={[4.9, 0.2, 8.7]}
        position={[-2.2, 6.7, 0]}
        rotation={[0, 0, 0.25]}
        material={roofMaterial}
      />
      <BuildingBox
        args={[4.9, 0.2, 8.7]}
        position={[2.2, 6.7, 0]}
        rotation={[0, 0, -0.25]}
        material={roofMaterial}
      />
    </group>
  )
}
