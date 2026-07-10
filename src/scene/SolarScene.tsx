import { Canvas } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { generateDailySunPath, type SolarInput, type SolarState } from '../solar'
import { DemoBuilding } from './demo/DemoBuilding'

const SHADOW_SETTINGS = { type: THREE.PCFShadowMap } as const

interface SolarSceneProps {
  input: SolarInput
  solarState: SolarState | null
  showAxes: boolean
  showGrid: boolean
  showSunPath: boolean
}

function SunLight({ solarState }: { solarState: SolarState | null }) {
  const light = useRef<THREE.DirectionalLight>(null)

  useEffect(() => {
    if (!light.current) return
    light.current.target.position.set(0, 2.6, 0)
    light.current.target.updateMatrixWorld()
  }, [])

  if (!solarState) return null
  const daylightFactor = solarState.isAboveHorizon
    ? THREE.MathUtils.smoothstep(solarState.altitudeDeg, 0, 18)
    : 0

  return (
    <directionalLight
      ref={light}
      castShadow
      color={new THREE.Color('#ffd6a2').lerp(new THREE.Color('#fff8e8'), daylightFactor)}
      intensity={3.2 * daylightFactor}
      position={solarState.lightPosition}
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-bias={-0.00025}
      shadow-camera-left={-24}
      shadow-camera-right={24}
      shadow-camera-top={24}
      shadow-camera-bottom={-24}
      shadow-camera-near={1}
      shadow-camera-far={100}
    />
  )
}

function SunAndPath({ input, solarState, visible }: Pick<SolarSceneProps, 'input' | 'solarState'> & { visible: boolean }) {
  const { latitude, longitude, localDate, timeZone, northOffsetDeg } = input
  const pathInput = useMemo(() => ({
    latitude,
    longitude,
    localDate,
    timeZone,
    northOffsetDeg,
    localTimeMinutes: 0,
  }), [latitude, longitude, localDate, timeZone, northOffsetDeg])
  const path = useMemo(
    () => generateDailySunPath(pathInput).filter((point) => point.altitudeDeg >= 0),
    [pathInput],
  )
  const pathPoints = useMemo(
    () => path.map(({ worldDirection }) => worldDirection.map((value) => value * 22) as [number, number, number]),
    [path],
  )

  if (!solarState) return null
  const sunPosition = solarState.worldDirection.map((value) => value * 22) as [number, number, number]

  return (
    <>
      {visible && pathPoints.length > 1 && (
        <Line points={pathPoints} color="#f09a3e" lineWidth={1.6} transparent opacity={0.78} />
      )}
      <mesh position={sunPosition}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshBasicMaterial color={solarState.isAboveHorizon ? '#ffbe4f' : '#7d8790'} />
      </mesh>
    </>
  )
}

function Compass({ northOffsetDeg }: { northOffsetDeg: number }) {
  return (
    <group position={[-6, 0.06, 4]} rotation={[0, THREE.MathUtils.degToRad(northOffsetDeg), 0]}>
      <Line points={[[0, 0, -1], [0, 0, 3]]} color="#e94e3d" lineWidth={3} />
      <mesh position={[0, 0, 3]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.32, 0.9, 4]} />
        <meshBasicMaterial color="#e94e3d" />
      </mesh>
      <Html position={[0, 0.25, 3.65]} center transform distanceFactor={10} occlude>
        <span className="compass-label">TRUE N</span>
      </Html>
    </group>
  )
}

function SceneContent(props: SolarSceneProps) {
  return (
    <>
      <color attach="background" args={['#e8edf0']} />
      <fog attach="fog" args={['#e8edf0', 35, 85]} />
      <ambientLight intensity={0.75} color="#c8d6df" />
      <hemisphereLight args={['#dbe9f1', '#8c938d', 0.65]} />
      <SunLight solarState={props.solarState} />
      <SunAndPath input={props.input} solarState={props.solarState} visible={props.showSunPath} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.05, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#d6dcd8" roughness={0.98} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.02, 0]}>
        <circleGeometry args={[8, 64]} />
        <meshStandardMaterial color="#c5cbc6" roughness={0.96} />
      </mesh>

      <DemoBuilding />
      <Compass northOffsetDeg={props.input.northOffsetDeg} />
      {props.showGrid && <gridHelper args={[60, 60, '#aab4b7', '#c7ced0']} position={[0, 0.01, 0]} />}
      {props.showAxes && <axesHelper args={[7]} position={[0, 0.03, 0]} />}
      <OrbitControls
        makeDefault
        target={[0, 2.5, 0]}
        minDistance={8}
        maxDistance={65}
        maxPolarAngle={Math.PI / 2.02}
        enableDamping
      />
    </>
  )
}

export function SolarScene(props: SolarSceneProps) {
  return (
    <Canvas
      shadows={SHADOW_SETTINGS}
      camera={{ position: [15, 12, 18], fov: 42, near: 0.1, far: 160 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <Suspense fallback={null}>
        <SceneContent {...props} />
      </Suspense>
    </Canvas>
  )
}
