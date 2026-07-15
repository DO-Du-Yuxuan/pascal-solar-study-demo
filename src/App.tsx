import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { findEditableWindow, restoreSceneWindow, updateSceneWindow, type WindowEditPatch } from './analysis/windowEditing'
import type { WindowCurrentSolarResult } from './analysis/windowCurrentSolar'
import { orientAnalyticalOpening } from './scene/pascal/parsePascalScene'
import type { AnalysisDisplayMode } from './scene/pascal/SolarAnalysisLayer'
import {
  rangeKey,
  rangeLabel,
  selectCumulativeHours,
} from './analysis/cumulativeSolar/cumulativeSolarClient'
import { positiveResultP95 } from './analysis/cumulativeSolar/quantile'
import type {
  CumulativeAnalysisResult,
  CumulativeDisplayResult,
  CumulativeProgress,
  CumulativeRangeSelection,
  CumulativeRunCommand,
} from './analysis/cumulativeSolar/cumulativeSolarTypes'

export default function App() {
  usePlaybackController()
  const [importedScene, setImportedScene] = useState<ParsedPascalScene | null>(null)
  const [originalImportedScene, setOriginalImportedScene] = useState<ParsedPascalScene | null>(null)
  const [sceneSource, setSceneSource] = useState<SceneSourceKind>('demo')
  const [weatherDataset, setWeatherDataset] = useState<WeatherDataset | null>(null)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null)
  const [analysisDisplayMode, setAnalysisDisplayMode] = useState<AnalysisDisplayMode>('normal')
  const [windowSolar, setWindowSolar] = useState<WindowCurrentSolarResult | null>(null)
  const [cumulativeSelection, setCumulativeSelection] = useState<CumulativeRangeSelection>({
    kind: 'day',
    startDate: '2025-06-01',
    endDate: '2025-06-30',
  })
  const [cumulativeRunCommand, setCumulativeRunCommand] = useState<CumulativeRunCommand | null>(null)
  const [cumulativeCancelRequestId, setCumulativeCancelRequestId] = useState<number | null>(null)
  const [cumulativeProgress, setCumulativeProgress] = useState<CumulativeProgress | null>(null)
  const [cumulativeResult, setCumulativeResult] = useState<CumulativeDisplayResult | null>(null)
  const [cumulativeRunning, setCumulativeRunning] = useState(false)
  const [cumulativeError, setCumulativeError] = useState<string | null>(null)
  const [lockedScale, setLockedScale] = useState<{ rangeKey: string; value: number } | null>(null)
  const cumulativeRequestId = useRef(0)
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
        setOriginalImportedScene(result.scene)
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
  const selectedWindowContext = useMemo(
    () => findEditableWindow(importedScene, selectedOpeningId),
    [importedScene, selectedOpeningId],
  )
  const selectedOpening = useMemo(
    () => selectedWindowContext
      ? orientAnalyticalOpening(selectedWindowContext.analytical, values.northOffsetDeg)
      : null,
    [selectedWindowContext, values.northOffsetDeg],
  )
  const editSelectedWindow = useCallback((patch: WindowEditPatch) => {
    if (!selectedOpeningId) return
    setImportedScene((scene) => scene ? updateSceneWindow(scene, selectedOpeningId, patch) : scene)
    if (['width', 'height', 'sillHeight', 'offsetAlongWall', 'enabled', 'shgc'].some((key) => key in patch)) {
      setCumulativeResult((current) => current ? { ...current, stale: true } : current)
    }
  }, [selectedOpeningId])
  const restoreSelectedWindow = useCallback(() => {
    if (!selectedOpeningId || !originalImportedScene) return
    setImportedScene((scene) => scene
      ? restoreSceneWindow(scene, originalImportedScene, selectedOpeningId)
      : scene)
    setCumulativeResult((current) => current ? { ...current, stale: true } : current)
  }, [originalImportedScene, selectedOpeningId])
  const currentCumulativeRangeKey = useMemo(
    () => rangeKey(cumulativeSelection, values.localDate),
    [cumulativeSelection, values.localDate],
  )
  const currentCumulativeResult = cumulativeResult?.rangeKey === currentCumulativeRangeKey
    ? cumulativeResult
    : null
  const startCumulativeAnalysis = useCallback(() => {
    if (!weatherDataset || !importedScene || cumulativeRunning) return
    const hours = selectCumulativeHours(weatherDataset, cumulativeSelection, values.localDate)
    if (hours.length === 0) {
      setCumulativeError('所选时间范围没有可用的 NASA POWER 2025 小时数据。')
      return
    }
    cumulativeRequestId.current += 1
    setAnalysisDisplayMode('cumulative-solar-energy')
    setCumulativeError(null)
    setCumulativeCancelRequestId(null)
    setCumulativeProgress({ processedHours: 0, totalHours: hours.length, progressPct: 0 })
    setCumulativeRunCommand({
      requestId: cumulativeRequestId.current,
      rangeKey: currentCumulativeRangeKey,
      rangeLabel: rangeLabel(cumulativeSelection, values.localDate),
      hours,
      solarInput: {
        latitude: values.latitude,
        longitude: values.longitude,
        timeZone: values.timeZone,
        northOffsetDeg: values.northOffsetDeg,
      },
    })
  }, [
    cumulativeRunning, cumulativeSelection, currentCumulativeRangeKey, importedScene, values.latitude,
    values.localDate, values.longitude, values.northOffsetDeg, values.timeZone, weatherDataset,
  ])
  const handleCumulativeResult = useCallback((resultValue: CumulativeAnalysisResult) => {
    const calculatedP95 = positiveResultP95(resultValue.grids)
    const scaleValue = lockedScale?.rangeKey === resultValue.rangeKey
      ? lockedScale.value
      : calculatedP95 ?? 0
    if (!lockedScale || lockedScale.rangeKey !== resultValue.rangeKey) {
      setLockedScale(scaleValue > 0 ? { rangeKey: resultValue.rangeKey, value: scaleValue } : null)
    }
    setCumulativeResult({ ...resultValue, lockedScaleMaxKWhM2: scaleValue, stale: false })
    setCumulativeProgress(null)
  }, [lockedScale])
  const resetCumulativeScale = useCallback(() => {
    if (!currentCumulativeResult) return
    const value = positiveResultP95(currentCumulativeResult.grids)
    if (!value || value <= 0) return
    setLockedScale({ rangeKey: currentCumulativeResult.rangeKey, value })
    setCumulativeResult({ ...currentCumulativeResult, lockedScaleMaxKWhM2: value })
  }, [currentCumulativeResult])
  const handleCumulativeRunningChange = useCallback((running: boolean) => {
    setCumulativeRunning(running)
    if (!running) setCumulativeRunCommand(null)
  }, [])

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
            selectedOpeningId={selectedOpeningId}
            selectedOpening={selectedOpening}
            analysisDisplayMode={analysisDisplayMode}
            cumulativeRunCommand={cumulativeRunCommand}
            cumulativeCancelRequestId={cumulativeCancelRequestId}
            cumulativeResult={currentCumulativeResult}
            onOpeningSelect={setSelectedOpeningId}
            onWindowSolarChange={setWindowSolar}
            onCumulativeProgress={setCumulativeProgress}
            onCumulativeResult={handleCumulativeResult}
            onCumulativeError={setCumulativeError}
            onCumulativeRunningChange={handleCumulativeRunningChange}
          />
          {analysisDisplayMode === 'current-sun-preview' && (
            <div className="analysis-mode-note">当前阳光预览 · 暖黄色区域表示当前可见直射阳光</div>
          )}
          {analysisDisplayMode === 'cumulative-solar-energy' && !cumulativeRunning && !currentCumulativeResult && (
            <div className="analysis-mode-note cumulative-status-note">尚未计算 · 请在右侧选择时间范围后点击“开始计算”</div>
          )}
          {analysisDisplayMode === 'cumulative-solar-energy' && cumulativeRunning && (
            <div className="analysis-mode-note cumulative-status-note">
              正在计算累计直射太阳能量 · {cumulativeProgress?.progressPct.toFixed(0) ?? 0}%
            </div>
          )}
          {analysisDisplayMode === 'cumulative-solar-energy' && !cumulativeRunning && currentCumulativeResult?.lockedScaleMaxKWhM2 === 0 && (
            <div className="analysis-mode-note cumulative-status-note">该时间范围内没有检测到室内直射太阳能量</div>
          )}
          {analysisDisplayMode === 'cumulative-solar-energy' && currentCumulativeResult?.lockedScaleMaxKWhM2 && currentCumulativeResult.lockedScaleMaxKWhM2 > 0 && (
            <div className="heatmap-legend" aria-label="累计直射太阳能量图例">
              <strong>累计直射太阳能量</strong>
              <div className="cumulative-gradient" />
              <div className="heatmap-scale-values">
                <span>0</span>
                <span>{(currentCumulativeResult.lockedScaleMaxKWhM2 / 2).toFixed(2)}</span>
                <span>{currentCumulativeResult.lockedScaleMaxKWhM2.toFixed(2)} kWh/m²</span>
              </div>
            </div>
          )}
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
          selectedWindow={selectedWindowContext}
          selectedOpening={selectedOpening}
          windowSolar={windowSolar}
          analysisDisplayMode={analysisDisplayMode}
          onAnalysisDisplayModeChange={setAnalysisDisplayMode}
          cumulativeSelection={cumulativeSelection}
          onCumulativeSelectionChange={(selection) => {
            setCumulativeSelection(selection)
            setLockedScale(null)
            setCumulativeResult(null)
          }}
          cumulativeProgress={cumulativeProgress}
          cumulativeResult={currentCumulativeResult}
          cumulativeRunning={cumulativeRunning}
          cumulativeError={cumulativeError}
          onCumulativeStart={startCumulativeAnalysis}
          onCumulativeCancel={() => {
            if (cumulativeRunCommand) setCumulativeCancelRequestId(cumulativeRunCommand.requestId)
          }}
          onCumulativeResetScale={resetCumulativeScale}
          onWindowEdit={editSelectedWindow}
          onWindowRestore={restoreSelectedWindow}
          onPascalImported={(scene) => {
            setImportedScene(scene)
            setOriginalImportedScene(scene)
            setSceneSource('pascal')
            setSelectedOpeningId(null)
            setCumulativeResult(null)
            setLockedScale(null)
          }}
          onSceneSourceChange={(source) => {
            setSceneSource(source)
            if (source !== 'pascal') setSelectedOpeningId(null)
          }}
        />
      </div>
    </main>
  )
}
