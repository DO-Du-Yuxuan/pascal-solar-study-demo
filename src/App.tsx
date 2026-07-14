import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import './App.css'
import { ControlPanel } from './components/ControlPanel'
import { SolarScene } from './scene/SolarScene'
import type { SceneSourceKind } from './scene/SceneSource'
import type { ParsedPascalScene } from './scene/pascal/types'
import { validatePascalJson } from './scene/pascal/validatePascalJson'
import { calculateSolarState, localDateTimeToInstant, type SolarInput } from './solar'
import { usePlaybackController } from './state/usePlaybackController'
import { useSimulationStore } from './state/simulationStore'
import { loadNasaPower2025, weatherAtInstant } from './weather/nasaPower'
import type { WeatherDataset } from './weather/types'

export default function App() {
  usePlaybackController()
  const [importedScene, setImportedScene] = useState<ParsedPascalScene | null>(null)
  const [sceneSource, setSceneSource] = useState<SceneSourceKind>('demo')
  const [weatherDataset, setWeatherDataset] = useState<WeatherDataset | null>(null)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const values = useSimulationStore(useShallow((state) => ({
    latitude: state.latitude,
    longitude: state.longitude,
    timeZone: state.timeZone,
    localDate: state.localDate,
    localTimeMinutes: state.localTimeMinutes,
    northOffsetDeg: state.northOffsetDeg,
    showAxes: state.showAxes,
    showGrid: state.showGrid,
    showSunPath: state.showSunPath,
    weatherMode: state.weatherMode,
  })))

  useEffect(() => {
    if (values.weatherMode !== 'nasa-power-2025' || weatherDataset || weatherError) return
    const controller = new AbortController()
    loadNasaPower2025(controller.signal)
      .then(setWeatherDataset)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setWeatherError(error instanceof Error ? error.message : '无法读取天气数据。')
      })
    return () => controller.abort()
  }, [values.weatherMode, weatherDataset, weatherError])

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}models/default-pascal-scene.json`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`默认展示模型读取失败（${response.status}）。`)
        return response.json() as Promise<unknown>
      })
      .then((json) => {
        const result = validatePascalJson(json)
        if (!result.scene) throw new Error(result.message)
        setImportedScene(result.scene)
        setSceneSource('pascal')
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error(error)
      })
    return () => controller.abort()
  }, [])

  const input: SolarInput = useMemo(() => ({
    latitude: values.latitude,
    longitude: values.longitude,
    timeZone: values.timeZone,
    localDate: values.localDate,
    localTimeMinutes: values.localTimeMinutes,
    northOffsetDeg: values.northOffsetDeg,
  }), [values])
  const result = useMemo(() => {
    try {
      return { solarState: calculateSolarState(input), error: null }
    } catch (error) {
      return {
        solarState: null,
        error: error instanceof Error ? error.message : '无法计算当前太阳位置。',
      }
    }
  }, [input])
  const weatherSnapshot = useMemo(() => {
    if (values.weatherMode !== 'nasa-power-2025' || !weatherDataset) return null
    try {
      return weatherAtInstant(weatherDataset, localDateTimeToInstant(values.localDate, values.localTimeMinutes, values.timeZone))
    } catch {
      return null
    }
  }, [values.localDate, values.localTimeMinutes, values.timeZone, values.weatherMode, weatherDataset])
  const directSunEnabled = Boolean(result.solarState?.isAboveHorizon)
    && (values.weatherMode === 'clear-sky' || (weatherSnapshot?.dniWm2 ?? 0) > 15)

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PASCAL · 环境分析</p>
          <h1>太阳与阴影实验室</h1>
        </div>
        <div className="topbar-meta">
          <span className={directSunEnabled ? 'status daylight' : 'status night'}>
            <i /> {directSunEnabled ? '直射阳光已开启' : '直射阳光已关闭'}
          </span>
          <span>{values.localDate} · {Math.floor(values.localTimeMinutes / 60).toString().padStart(2, '0')}:{(values.localTimeMinutes % 60).toString().padStart(2, '0')}</span>
        </div>
      </header>

      <div className="workspace">
        <section className="viewer" aria-label="交互式三维太阳研究视图">
          <SolarScene
            input={input}
            solarState={result.solarState}
            showAxes={values.showAxes}
            showGrid={values.showGrid}
            showSunPath={values.showSunPath}
            importedScene={importedScene}
            sceneSource={sceneSource}
            weatherMode={values.weatherMode}
            weatherSnapshot={weatherSnapshot}
          />
          <div className="viewer-help">旋转 · 左键拖动 &nbsp; 平移 · 右键拖动 &nbsp; 缩放 · 滚轮</div>
          <div className="axis-legend"><span className="x">X</span> 东 <span className="y">Y</span> 上 <span className="z">Z</span> 场景北</div>
        </section>
        <ControlPanel
          solarState={result.solarState}
          error={result.error}
          importedScene={importedScene}
          sceneSource={sceneSource}
          weatherDataset={weatherDataset}
          weatherSnapshot={weatherSnapshot}
          weatherLoading={values.weatherMode === 'nasa-power-2025' && !weatherDataset && !weatherError}
          weatherError={weatherError}
          onPascalImported={(scene) => {
            setImportedScene(scene)
            setSceneSource('pascal')
          }}
          onSceneSourceChange={setSceneSource}
        />
      </div>
    </main>
  )
}
