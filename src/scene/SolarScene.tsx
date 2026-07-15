import { Canvas, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { generateDailySunPath, type SolarInput, type SolarState } from '../solar'
import type { SceneBounds, SceneSourceKind } from './SceneSource'
import { DemoBuilding } from './demo/DemoBuilding'
import { PascalScene } from './pascal/PascalScene'
import {
  SolarAnalysisLayer,
  type AnalysisDisplayMode,
} from './pascal/SolarAnalysisLayer'
import type {
  CumulativeAnalysisResult,
  CumulativeDisplayResult,
  CumulativeProgress,
  CumulativeRunCommand,
} from '../analysis/cumulativeSolar/cumulativeSolarTypes'
import type { WindowCurrentSolarResult } from '../analysis/windowCurrentSolar'
import type { AnalyticalOpening, ParsedPascalScene } from './pascal/types'
import type { WeatherMode, WeatherSnapshot } from '../weather/types'

const SHADOW_SETTINGS = { type: THREE.PCFSoftShadowMap } as const
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
  selectedOpeningId: string | null
  selectedOpening: AnalyticalOpening | null
  analysisDisplayMode: AnalysisDisplayMode
  cumulativeRunCommand: CumulativeRunCommand | null
  cumulativeCancelRequestId: number | null
  cumulativeResult: CumulativeDisplayResult | null
  onOpeningSelect: (id: string | null) => void
  onWindowSolarChange: (result: WindowCurrentSolarResult | null) => void
  onCumulativeProgress: (progress: CumulativeProgress) => void
  onCumulativeResult: (result: CumulativeAnalysisResult) => void
  onCumulativeError: (message: string | null) => void
  onCumulativeRunningChange: (running: boolean) => void
}

function boundsBox(bounds: SceneBounds): THREE.Box3 {
  return new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max))
}

function buildingShadowBounds(scene: ParsedPascalScene | null, fallback: SceneBounds): SceneBounds {
  if (!scene) return fallback
  const box = new THREE.Box3()
  const point = new THREE.Vector3()
  for (const level of scene.levels) {
    for (const wall of level.walls) {
      for (const [x, z] of [wall.start, wall.end]) {
        box.expandByPoint(point.set(x, level.elevation, z))
        box.expandByPoint(point.set(x, level.elevation + wall.height, z))
      }
    }
    for (const surface of [...level.slabs, ...level.ceilings]) {
      for (const [x, z] of surface.polygon) {
        box.expandByPoint(point.set(x, surface.elevation, z))
        box.expandByPoint(point.set(x, surface.elevation + surface.thickness, z))
      }
    }
  }
  for (const roof of scene.roofs) {
    const rotation = new THREE.Matrix4().makeRotationY(roof.rotationY)
    for (const segment of roof.segments) {
      const localCenter = new THREE.Vector3(...segment.position).applyMatrix4(rotation)
      const center = new THREE.Vector3(...roof.position).add(localCenter)
      const horizontalRadius = Math.hypot(
        segment.width / 2 + segment.overhang,
        segment.depth / 2 + segment.overhang,
      )
      const rise = Math.max(segment.width, segment.depth) * Math.tan(THREE.MathUtils.degToRad(segment.pitchDeg))
      box.expandByPoint(point.set(center.x - horizontalRadius, center.y - segment.deckThickness, center.z - horizontalRadius))
      box.expandByPoint(point.set(center.x + horizontalRadius, center.y + segment.wallHeight + rise, center.z + horizontalRadius))
    }
  }
  if (box.isEmpty()) return fallback
  box.expandByScalar(6)
  return { min: box.min.toArray(), max: box.max.toArray() }
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
    const extent = Math.max(10, radius * 1.05)
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
      shadow-mapSize-width={4096}
      shadow-mapSize-height={4096}
      shadow-bias={-0.00005}
      shadow-normalBias={0.025}
      shadow-radius={2}
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
    <group position={position} rotation={[0, THREE.MathUtils.degToRad(northOffsetDeg) + Math.PI, 0]}>
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
  const camera = useRef<THREE.PerspectiveCamera>(null)
  const controls = useRef<OrbitControlsImpl>(null)
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
  const boundsKey = `${bounds.min.join(',')}|${bounds.max.join(',')}`
  const framedBoundsKey = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (!camera.current || !controls.current || framedBoundsKey.current === boundsKey) return
    camera.current.position.copy(settings.position)
    camera.current.near = Math.max(0.05, settings.fitDistance / 500)
    camera.current.far = Math.max(160, settings.fitDistance + settings.radius * 8)
    camera.current.updateProjectionMatrix()
    controls.current.target.copy(settings.center)
    controls.current.minDistance = Math.max(2, settings.radius * 0.15)
    controls.current.maxDistance = Math.max(65, settings.radius * 8)
    controls.current.update()
    framedBoundsKey.current = boundsKey
  }, [boundsKey, settings])

  return (
    <>
      <PerspectiveCamera
        ref={camera}
        makeDefault
        fov={42}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        maxPolarAngle={Math.PI / 2.02}
        enableDamping
      />
    </>
  )
}

function SceneContent(props: SolarSceneProps) {
  const [importedBounds, setImportedBounds] = useState<SceneBounds>(DEMO_BOUNDS)
  const handleBoundsChange = useCallback((nextBounds: SceneBounds) => setImportedBounds((currentBounds) => {
    const unchanged = currentBounds.min.every((value, index) => Math.abs(value - nextBounds.min[index]!) < 1e-4)
      && currentBounds.max.every((value, index) => Math.abs(value - nextBounds.max[index]!) < 1e-4)
    return unchanged ? currentBounds : nextBounds
  }), [])
  const useImportedScene = props.sceneSource === 'pascal' && props.importedScene !== null
  const bounds = useImportedScene ? importedBounds : DEMO_BOUNDS
  const shadowBounds = useMemo(
    () => useImportedScene ? buildingShadowBounds(props.importedScene, bounds) : bounds,
    [bounds, props.importedScene, useImportedScene],
  )

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
      <SunLight solarState={props.solarState} bounds={shadowBounds} weatherMode={props.weatherMode} weatherSnapshot={props.weatherSnapshot} />
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
        ? (
          <>
            <PascalScene
              scene={props.importedScene}
              onBoundsChange={handleBoundsChange}
              selectedOpeningId={props.selectedOpeningId}
              onOpeningSelect={props.onOpeningSelect}
            />
            <SolarAnalysisLayer
              parsedScene={props.importedScene}
              selectedOpening={props.selectedOpening}
              solarState={props.solarState}
              dniWm2={props.weatherSnapshot?.dniWm2}
              displayMode={props.analysisDisplayMode}
              cumulativeRunCommand={props.cumulativeRunCommand}
              cumulativeCancelRequestId={props.cumulativeCancelRequestId}
              cumulativeResult={props.cumulativeResult}
              onWindowSolarChange={props.onWindowSolarChange}
              onCumulativeProgress={props.onCumulativeProgress}
              onCumulativeResult={props.onCumulativeResult}
              onCumulativeError={props.onCumulativeError}
              onCumulativeRunningChange={props.onCumulativeRunningChange}
            />
          </>
        )
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
      onPointerMissed={() => props.onOpeningSelect(null)}
    >
      <Suspense fallback={null}>
        <SceneContent {...props} />
      </Suspense>
    </Canvas>
  )
}
