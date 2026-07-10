import type { ReactNode } from 'react'
import {
  dateFromDayOfYear,
  daysInYear,
  formatInstantInZone,
  getDayOfYear,
  getMinuteOfDayInZone,
  getYear,
  type SolarState,
} from '../solar'
import { useSimulationStore } from '../state/simulationStore'
import { PascalImport } from './PascalImport'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="control-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function minutesToText(minutes: number): string {
  const hours = Math.floor(minutes / 60).toString().padStart(2, '0')
  const mins = (minutes % 60).toString().padStart(2, '0')
  return `${hours}:${mins}`
}

function textToMinutes(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':')
  return Number(hours) * 60 + Number(minutes)
}

function PlaybackButton({ active, onClick, subject }: { active: boolean; onClick: () => void; subject: string }) {
  return (
    <button type="button" className="play-button" onClick={onClick} aria-label={`${active ? 'Pause' : 'Play'} ${subject}`}>
      {active ? 'Pause' : 'Play'}
    </button>
  )
}

interface ControlPanelProps {
  solarState: SolarState | null
  error: string | null
}

export function ControlPanel({ solarState, error }: ControlPanelProps) {
  const state = useSimulationStore()
  const year = getYear(state.localDate)
  const currentDay = getDayOfYear(state.localDate)
  const maxDay = daysInYear(year)

  const jumpTo = (instant: Date | null) => {
    const minutes = getMinuteOfDayInZone(instant, state.timeZone)
    if (minutes !== null) state.setLocalTimeMinutes(minutes)
  }

  return (
    <aside className="control-panel">
      <Section title="Location">
        <div className="field-grid two-columns">
          <label>Latitude
            <input type="number" min="-90" max="90" step="0.0001" value={state.latitude} onChange={(event) => state.setLatitude(event.currentTarget.valueAsNumber)} />
          </label>
          <label>Longitude
            <input type="number" min="-180" max="180" step="0.0001" value={state.longitude} onChange={(event) => state.setLongitude(event.currentTarget.valueAsNumber)} />
          </label>
        </div>
        <label>Project time zone
          <input type="text" spellCheck={false} value={state.timeZone} onChange={(event) => state.setTimeZone(event.currentTarget.value)} aria-invalid={Boolean(error)} />
        </label>
        <p className="hint">Bellevue, Washington · local civil time</p>
      </Section>

      <Section title="Date & time">
        <div className="inline-date">
          <input aria-label="Local date" type="date" value={state.localDate} onInput={(event) => state.setLocalDate(event.currentTarget.value)} />
          <input aria-label="Local time" type="time" value={minutesToText(state.localTimeMinutes)} onInput={(event) => state.setLocalTimeMinutes(textToMinutes(event.currentTarget.value))} />
        </div>
        <label className="range-label"><span>Time of day</span><output>{minutesToText(state.localTimeMinutes)}</output></label>
        <input aria-label="Time of day slider" className="range" type="range" min="0" max="1439" step="1" value={state.localTimeMinutes} onInput={(event) => state.setLocalTimeMinutes(event.currentTarget.valueAsNumber)} />
        <div className="playback-row">
          <PlaybackButton subject="day animation" active={state.dayPlaying} onClick={() => state.setDayPlaying(!state.dayPlaying)} />
          <label className="compact-select">Speed
            <select value={state.daySpeed} onChange={(event) => state.setDaySpeed(Number(event.currentTarget.value))}>
              {[1, 5, 15, 30, 60].map((speed) => <option value={speed} key={speed}>{speed} min/s</option>)}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={state.dayLoop} onChange={(event) => state.setDayLoop(event.currentTarget.checked)} /> Loop</label>
        </div>
        <div className="jump-row">
          <button type="button" onClick={() => jumpTo(solarState?.sunrise ?? null)} disabled={!solarState?.sunrise}>Sunrise</button>
          <button type="button" onClick={() => jumpTo(solarState?.solarNoon ?? null)} disabled={!solarState?.solarNoon}>Noon</button>
          <button type="button" onClick={() => jumpTo(solarState?.sunset ?? null)} disabled={!solarState?.sunset}>Sunset</button>
        </div>

        <label className="range-label"><span>Day of year</span><output>{currentDay} / {maxDay}</output></label>
        <input aria-label="Day of year slider" className="range" type="range" min="1" max={maxDay} step="1" value={currentDay} onInput={(event) => state.setLocalDate(dateFromDayOfYear(year, event.currentTarget.valueAsNumber))} />
        <div className="playback-row">
          <PlaybackButton subject="year animation" active={state.yearPlaying} onClick={() => state.setYearPlaying(!state.yearPlaying)} />
          <label className="compact-select">Speed
            <select value={state.yearSpeed} onChange={(event) => state.setYearSpeed(Number(event.currentTarget.value))}>
              {[1, 5, 10, 30].map((speed) => <option value={speed} key={speed}>{speed} days/s</option>)}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={state.yearLoop} onChange={(event) => state.setYearLoop(event.currentTarget.checked)} /> Loop</label>
        </div>
        <div className="season-row">
          {([
            ['Mar 20', `${year}-03-20`],
            ['Jun 21', `${year}-06-21`],
            ['Sep 22', `${year}-09-22`],
            ['Dec 21', `${year}-12-21`],
          ] satisfies [string, string][]).map(([label, date]) => <button type="button" key={date} onClick={() => state.setLocalDate(date)}>{label}</button>)}
        </div>
      </Section>

      <Section title="True north">
        <label className="range-label"><span>North offset</span><output>{state.northOffsetDeg.toFixed(0)}°</output></label>
        <input aria-label="North offset slider" className="range" type="range" min="0" max="359" step="1" value={state.northOffsetDeg} onInput={(event) => state.setNorthOffsetDeg(event.currentTarget.valueAsNumber)} />
        <input aria-label="North offset degrees" className="angle-input" type="number" min="0" max="359" step="1" value={state.northOffsetDeg} onChange={(event) => state.setNorthOffsetDeg(event.currentTarget.valueAsNumber)} />
        <p className="hint">Clockwise from scene +Z to true north. The building stays fixed.</p>
      </Section>

      <Section title="Scene display">
        <div className="toggle-grid">
          <label className="check"><input type="checkbox" checked={state.showSunPath} onChange={(event) => state.setShowSunPath(event.currentTarget.checked)} /> Sun path</label>
          <label className="check"><input type="checkbox" checked={state.showGrid} onChange={(event) => state.setShowGrid(event.currentTarget.checked)} /> Grid</label>
          <label className="check"><input type="checkbox" checked={state.showAxes} onChange={(event) => state.setShowAxes(event.currentTarget.checked)} /> XYZ axes</label>
        </div>
      </Section>

      <Section title="Pascal JSON">
        <PascalImport />
      </Section>

      <Section title="Solar data">
        {error ? <p className="error-message">{error}</p> : solarState && (
          <dl className="solar-data">
            <div><dt>Altitude</dt><dd>{solarState.altitudeDeg.toFixed(2)}°</dd></div>
            <div><dt>Azimuth</dt><dd>{solarState.azimuthDeg.toFixed(2)}°</dd></div>
            <div><dt>Above horizon</dt><dd className={solarState.isAboveHorizon ? 'positive' : 'muted'}>{solarState.isAboveHorizon ? 'Yes' : 'No'}</dd></div>
            <div><dt>Sunrise</dt><dd>{formatInstantInZone(solarState.sunrise, state.timeZone)}</dd></div>
            <div><dt>Solar noon</dt><dd>{formatInstantInZone(solarState.solarNoon, state.timeZone)}</dd></div>
            <div><dt>Sunset</dt><dd>{formatInstantInZone(solarState.sunset, state.timeZone)}</dd></div>
            <div className="data-wide"><dt>World direction (center → sun)</dt><dd>[{solarState.worldDirection.map((value) => value.toFixed(5)).join(', ')}]</dd></div>
            <div className="data-wide"><dt>DirectionalLight position</dt><dd>[{solarState.lightPosition.map((value) => value.toFixed(3)).join(', ')}]</dd></div>
            <div className="data-wide"><dt>Local timestamp</dt><dd>{formatInstantInZone(solarState.instant, state.timeZone, 'yyyy-LL-dd HH:mm ZZZZ')}</dd></div>
          </dl>
        )}
      </Section>
    </aside>
  )
}
