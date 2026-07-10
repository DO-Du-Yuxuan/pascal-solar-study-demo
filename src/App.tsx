import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import './App.css'
import { ControlPanel } from './components/ControlPanel'
import { SolarScene } from './scene/SolarScene'
import { calculateSolarState, type SolarInput } from './solar'
import { usePlaybackController } from './state/usePlaybackController'
import { useSimulationStore } from './state/simulationStore'

export default function App() {
  usePlaybackController()
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
  })))

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
        error: error instanceof Error ? error.message : 'Unable to calculate the solar position.',
      }
    }
  }, [input])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PASCAL · ENVIRONMENT STUDY</p>
          <h1>Solar & Shadow Lab</h1>
        </div>
        <div className="topbar-meta">
          <span className={result.solarState?.isAboveHorizon ? 'status daylight' : 'status night'}>
            <i /> {result.solarState?.isAboveHorizon ? 'Direct sun active' : 'Direct sun off'}
          </span>
          <span>{values.localDate} · {Math.floor(values.localTimeMinutes / 60).toString().padStart(2, '0')}:{(values.localTimeMinutes % 60).toString().padStart(2, '0')}</span>
        </div>
      </header>

      <div className="workspace">
        <section className="viewer" aria-label="Interactive 3D solar study viewer">
          <SolarScene
            input={input}
            solarState={result.solarState}
            showAxes={values.showAxes}
            showGrid={values.showGrid}
            showSunPath={values.showSunPath}
          />
          <div className="viewer-help">Orbit · left drag &nbsp; Pan · right drag &nbsp; Zoom · wheel</div>
          <div className="axis-legend"><span className="x">X</span> East <span className="y">Y</span> Up <span className="z">Z</span> Scene north</div>
        </section>
        <ControlPanel solarState={result.solarState} error={result.error} />
      </div>
    </main>
  )
}
