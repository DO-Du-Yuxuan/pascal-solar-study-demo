import { Canvas, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { generateDailySunPath, type SolarInput, type SolarState } from '../solar'
import type { SceneBounds, SceneSourceKind } from './SceneSource'
import { DemoBuilding } from './demo/DemoBuilding'
import { PascalScene } from './pascal/PascalScene'
import type { ParsedPascalScene } from './pascal/types'
import type { WeatherMode, WeatherSnapshot } from '../weather/types'

const SHADOW_SETTINGS = { type: THREE.PCFShadowMap } as const
const DEMO_BOUNDS: SceneBounds = { min: [-10, 0, -9], max: [10, 9, 10] }

interface SolarSceneProps {
  input: SolarInput
  solarState: SolarState | null
  showAxes: boolean
  showGrid: boolean
  showSunPath: boolean
  importedScene: ParsedPascalScene | null
  sceneSource: SceneSourceKind
  weatherMode: WeatherMode
  weatherSnapshot: WeatherSnapshot | null
}

function boundsBox(bounds: SceneBounds): THREE.Box3 {
  return new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max))
}

function SunLight({ solarState, bounds, weatherMode, weatherSnapshot }: {
  solarState: SolarState | null
  bounds: SceneBounds
  weatherMode: WeatherMode
  weatherSnapshot: WeatherSnapshot | null
}) {
  const light = useRef<THREE.DirectionalLight>(null)
  const settings = useMemo(() => {
    const box = boundsBox(bounds)
    const center = box.getCenter(new THREE.Vector3())
    const radius = Math.max(1, box.getBoundingSphere(new THREE.Sphere()).radius)
    const distance = Math.max(42, radius * 4 + 20)
    const extent = Math.max(24, radius * 1.6)
    return { center, distance, extent }
  }, [bounds])

  useLayoutEffect(() => {
    if (!light.current) return
    light.current.target.position.copy(settings.center)
    light.current.target.updateMatrixWorld()
    light.current.shadow.camera.updateProjectionMatrix()
  }, [settings])

  if (!solarState) return null
  const daylightFactor = solarState.isAboveHorizon
    ? THREE.MathUtils.smoothstep(solarState.altitudeDeg, 0, 18)
    : 0
  const directWeatherFactor = weatherMode === 'nasa-power-2025'
    ? THREE.MathUtils.smoothstep(weatherSnapshot?.dniWm2 ?? 0, 15, 700)
    : 1
  const position = solarState.worldDirection.map((component, index) => (
    settings.center.getComponent(index) + component * settings.distance
  )) as [number, number, number]

  return (
    <directionalLight
      ref={light}
      castShadow
      color={new THREE.Color('#ffd6a2').lerp(new THREE.Color('#fff8e8'), daylightFactor)}
      intensity={3.2 * daylightFactor * directWeatherFactor}
      position={position}
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-bias={-0.00025}
      shadow-camera-left={-settings.extent}
      shadow-camera-right={settings.extent}
      shadow-camera-top={settings.extent}
      shadow-camera-bottom={-settings.extent}
      shadow-camera-near={0.1}
      shadow-camera-far={settings.distance + settings.extent * 2}
    />
  )
}

function SunAndPath({ input, solarState, visible, center }: Pick<SolarSceneProps, 'input' | 'solarState'> & { visible: boolean; center: THREE.Vector3 }) {
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
    () => path.map(({ worldDirection }) => worldDirection.map((value, index) => value * 22 + center.getComponent(index)) as [number, number, number]),
    [path, center],
  )

  if (!solarState) return null
  const sunPosition = solarState.worldDirection.map((value, index) => value * 22 + center.getComponent(index)) as [number, number, number]

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

function Compass({ northOffsetDeg, position }: { northOffsetDeg: number; position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, THREE.MathUtils.degToRad(northOffsetDeg), 0]}>
      <Line points={[[0, 0, -1], [0, 0, 3]]} color="#e94e3d" lineWidth={3} />
      <mesh position={[0, 0, 3]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.32, 0.9, 4]} />
        <meshBasicMaterial color="#e94e3d" />
      </mesh>
      <Html position={[0, 0.25, 3.65]} center transform distanceFactor={10} occlude>
        <span className="compass-label">真北</span>
      </Html>
    </group>
  )
}

function CameraRig({ bounds }: { bounds: SceneBounds }) {
  const size = useThree((state) => state.size)
  const settings = useMemo(() => {
    const box = boundsBox(bounds)
    const center = box.getCenter(new THREE.Vector3())
    const radius = Math.max(2, box.getBoundingSphere(new THREE.Sphere()).radius)
    const verticalFov = THREE.MathUtils.degToRad(42)
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.2, size.width / size.height))
    const fitDistance = Math.max(radius / Math.sin(verticalFov / 2), radius / Math.sin(horizontalFov / 2)) * 1.15
    const direction = new THREE.Vector3(1, 0.72, 1).normalize()
    return {
      center,
      radius,
      fitDistance,
      position: center.clone().addScaledVector(direction, fitDistance),
    }
  }, [bounds, size.height, size.width])
  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={42}
        position={settings.position}
        near={Math.max(0.05, settings.fitDistance / 500)}
        far={Math.max(160, settings.fitDistance + settings.radius * 8)}
      />
      <OrbitControls
        makeDefault
        target={settings.center}
        minDistance={Math.max(2, settings.radius * 0.15)}
        maxDistance={Math.max(65, settings.radius * 8)}
        maxPolarAngle={Math.PI / 2.02}
        enableDamping
      />
    </>
  )
}

function SceneContent(props: SolarSceneProps) {
  const [importedBounds, setImportedBounds] = useState<SceneBounds>(DEMO_BOUNDS)
  const handleBoundsChange = useCallback((nextBounds: SceneBounds) => setImportedBounds(nextBounds), [])
  const useImportedScene = props.sceneSource === 'pascal' && props.importedScene !== null
  const bounds = useImportedScene ? importedBounds : DEMO_BOUNDS

  const box = boundsBox(bounds)
  const center = box.getCenter(new THREE.Vector3())
  const extent = box.getSize(new THREE.Vector3())
  const groundSize = Math.max(100, Math.max(extent.x, extent.z) * 2.5)
  const compassPosition: [number, number, number] = [bounds.min[0] - 2, 0.06, bounds.min[2] + 2]
  const diffuseFactor = props.weatherMode === 'nasa-power-2025'
    ? THREE.MathUtils.clamp((props.weatherSnapshot?.dhiWm2 ?? 0) / 250, 0, 1)
    : 0.72

  return (
    <>
      <color attach="background" args={['#e8edf0']} />
      <ambientLight intensity={0.22 + diffuseFactor * 0.58} color="#c8d6df" />
      <hemisphereLight args={['#dbe9f1', '#8c938d', 0.2 + diffuseFactor * 0.72]} />
      <SunLight solarState={props.solarState} bounds={bounds} weatherMode={props.weatherMode} weatherSnapshot={props.weatherSnapshot} />
      <SunAndPath input={props.input} solarState={props.solarState} visible={props.showSunPath} center={center} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[center.x, -0.05, center.z]}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color="#d6dcd8" roughness={0.98} />
      </mesh>
      {!useImportedScene && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.02, 0]}>
          <circleGeometry args={[8, 64]} />
          <meshStandardMaterial color="#c5cbc6" roughness={0.96} />
        </mesh>
      )}

      {useImportedScene && props.importedScene
        ? <PascalScene scene={props.importedScene} onBoundsChange={handleBoundsChange} />
        : <DemoBuilding />}
      <Compass northOffsetDeg={props.input.northOffsetDeg} position={compassPosition} />
      {props.showGrid && <gridHelper args={[groundSize, Math.min(200, Math.max(60, Math.round(groundSize))) , '#aab4b7', '#c7ced0']} position={[center.x, 0.01, center.z]} />}
      {props.showAxes && <axesHelper args={[Math.max(7, Math.min(30, groundSize / 8))]} position={[center.x, 0.03, center.z]} />}
      <CameraRig bounds={bounds} />
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
