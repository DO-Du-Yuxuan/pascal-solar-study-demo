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
    <button type="button" className="play-button" onClick={onClick} aria-label={`${active ? '暂停' : '播放'}${subject}`}>
      {active ? '暂停' : '播放'}
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
      <Section title="项目位置">
        <div className="field-grid two-columns">
          <label>纬度
            <input type="number" min="-90" max="90" step="0.0001" value={state.latitude} onChange={(event) => state.setLatitude(event.currentTarget.valueAsNumber)} />
          </label>
          <label>经度
            <input type="number" min="-180" max="180" step="0.0001" value={state.longitude} onChange={(event) => state.setLongitude(event.currentTarget.valueAsNumber)} />
          </label>
        </div>
        <label>项目时区
          <input type="text" spellCheck={false} value={state.timeZone} onChange={(event) => state.setTimeZone(event.currentTarget.value)} aria-invalid={Boolean(error)} />
        </label>
        <p className="hint">美国华盛顿州贝尔维尤 · 项目所在地当地时间</p>
      </Section>

      <Section title="日期与时间">
        <div className="inline-date">
          <input aria-label="当地日期" type="date" value={state.localDate} onInput={(event) => state.setLocalDate(event.currentTarget.value)} />
          <input aria-label="当地时间" type="time" value={minutesToText(state.localTimeMinutes)} onInput={(event) => state.setLocalTimeMinutes(textToMinutes(event.currentTarget.value))} />
        </div>
        <label className="range-label"><span>一天中的时间</span><output>{minutesToText(state.localTimeMinutes)}</output></label>
        <input aria-label="一天中的时间滑块" className="range" type="range" min="0" max="1439" step="1" value={state.localTimeMinutes} onInput={(event) => state.setLocalTimeMinutes(event.currentTarget.valueAsNumber)} />
        <div className="playback-row">
          <PlaybackButton subject="一天动画" active={state.dayPlaying} onClick={() => state.setDayPlaying(!state.dayPlaying)} />
          <label className="compact-select">速度
            <select value={state.daySpeed} onChange={(event) => state.setDaySpeed(Number(event.currentTarget.value))}>
              {[1, 5, 15, 30, 60].map((speed) => <option value={speed} key={speed}>{speed} 分钟/秒</option>)}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={state.dayLoop} onChange={(event) => state.setDayLoop(event.currentTarget.checked)} /> 循环</label>
        </div>
        <div className="jump-row">
          <button type="button" onClick={() => jumpTo(solarState?.sunrise ?? null)} disabled={!solarState?.sunrise}>日出</button>
          <button type="button" onClick={() => jumpTo(solarState?.solarNoon ?? null)} disabled={!solarState?.solarNoon}>太阳正午</button>
          <button type="button" onClick={() => jumpTo(solarState?.sunset ?? null)} disabled={!solarState?.sunset}>日落</button>
        </div>

        <label className="range-label"><span>年内日期</span><output>第 {currentDay} / {maxDay} 天</output></label>
        <input aria-label="全年日期滑块" className="range" type="range" min="1" max={maxDay} step="1" value={currentDay} onInput={(event) => state.setLocalDate(dateFromDayOfYear(year, event.currentTarget.valueAsNumber))} />
        <div className="playback-row">
          <PlaybackButton subject="全年动画" active={state.yearPlaying} onClick={() => state.setYearPlaying(!state.yearPlaying)} />
          <label className="compact-select">速度
            <select value={state.yearSpeed} onChange={(event) => state.setYearSpeed(Number(event.currentTarget.value))}>
              {[1, 5, 10, 30].map((speed) => <option value={speed} key={speed}>{speed} 天/秒</option>)}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={state.yearLoop} onChange={(event) => state.setYearLoop(event.currentTarget.checked)} /> 循环</label>
        </div>
        <div className="season-row">
          {([
            ['春分', `${year}-03-20`],
            ['夏至', `${year}-06-21`],
            ['秋分', `${year}-09-22`],
            ['冬至', `${year}-12-21`],
          ] satisfies [string, string][]).map(([label, date]) => <button type="button" key={date} onClick={() => state.setLocalDate(date)}>{label}</button>)}
        </div>
      </Section>

      <Section title="真北方向">
        <label className="range-label"><span>真北偏角</span><output>{state.northOffsetDeg.toFixed(0)}°</output></label>
        <input aria-label="真北偏角滑块" className="range" type="range" min="0" max="359" step="1" value={state.northOffsetDeg} onInput={(event) => state.setNorthOffsetDeg(event.currentTarget.valueAsNumber)} />
        <input aria-label="真北偏角度数" className="angle-input" type="number" min="0" max="359" step="1" value={state.northOffsetDeg} onChange={(event) => state.setNorthOffsetDeg(event.currentTarget.valueAsNumber)} />
        <p className="hint">从场景 +Z 轴顺时针旋转到真北；建筑模型保持不动。</p>
      </Section>

      <Section title="场景显示">
        <div className="toggle-grid">
          <label className="check"><input type="checkbox" checked={state.showSunPath} onChange={(event) => state.setShowSunPath(event.currentTarget.checked)} /> 太阳轨迹</label>
          <label className="check"><input type="checkbox" checked={state.showGrid} onChange={(event) => state.setShowGrid(event.currentTarget.checked)} /> 网格</label>
          <label className="check"><input type="checkbox" checked={state.showAxes} onChange={(event) => state.setShowAxes(event.currentTarget.checked)} /> XYZ 坐标轴</label>
        </div>
      </Section>

      <Section title="Pascal JSON">
        <PascalImport />
      </Section>

      <Section title="太阳数据">
        {error ? <p className="error-message">{error}</p> : solarState && (
          <dl className="solar-data">
            <div><dt>太阳高度角</dt><dd>{solarState.altitudeDeg.toFixed(2)}°</dd></div>
            <div><dt>太阳方位角</dt><dd>{solarState.azimuthDeg.toFixed(2)}°</dd></div>
            <div><dt>位于地平线上方</dt><dd className={solarState.isAboveHorizon ? 'positive' : 'muted'}>{solarState.isAboveHorizon ? '是' : '否'}</dd></div>
            <div><dt>日出</dt><dd>{formatInstantInZone(solarState.sunrise, state.timeZone)}</dd></div>
            <div><dt>太阳正午</dt><dd>{formatInstantInZone(solarState.solarNoon, state.timeZone)}</dd></div>
            <div><dt>日落</dt><dd>{formatInstantInZone(solarState.sunset, state.timeZone)}</dd></div>
            <div className="data-wide"><dt>世界方向（场景中心 → 太阳）</dt><dd>[{solarState.worldDirection.map((value) => value.toFixed(5)).join(', ')}]</dd></div>
            <div className="data-wide"><dt>平行光位置</dt><dd>[{solarState.lightPosition.map((value) => value.toFixed(3)).join(', ')}]</dd></div>
            <div className="data-wide"><dt>项目当地时间</dt><dd>{formatInstantInZone(solarState.instant, state.timeZone, 'yyyy-LL-dd HH:mm ZZZZ')}</dd></div>
          </dl>
        )}
      </Section>
    </aside>
  )
}
