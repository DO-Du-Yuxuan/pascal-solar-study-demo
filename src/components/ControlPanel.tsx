import type { ReactNode } from 'react'
import {
  dateFromDayOfYear,
  daysInYear,
  formatInstantInZone,
  getDayOfYear,
  getYear,
  type SolarState,
} from '../solar'
import type { ParsedPascalScene } from '../scene/pascal/types'
import type { SceneSourceKind } from '../scene/SceneSource'
import { useSimulationStore } from '../state/simulationStore'
import { PascalImport } from './PascalImport'
import type { WeatherDataset, WeatherSnapshot } from '../weather/types'

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
  importedScene: ParsedPascalScene | null
  sceneSource: SceneSourceKind
  onPascalImported: (scene: ParsedPascalScene) => void
  onSceneSourceChange: (source: SceneSourceKind) => void
  weatherDataset: WeatherDataset | null
  weatherSnapshot: WeatherSnapshot | null
  weatherLoading: boolean
  weatherError: string | null
}

function formatWeather(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? '暂无数据' : value.toFixed(digits)
}

function formatMetric(value: number | null | undefined, unit: string, digits = 1): string {
  const formatted = formatWeather(value, digits)
  return formatted === '暂无数据' ? formatted : `${formatted} ${unit}`.trim()
}

function formatWind(speed: number | null | undefined, direction: number | null | undefined): string {
  if (speed === null || speed === undefined || direction === null || direction === undefined) return '暂无数据'
  return `${speed.toFixed(1)} m/s · ${direction.toFixed(0)}°`
}

export function ControlPanel({
  solarState, error, importedScene, sceneSource, onPascalImported, onSceneSourceChange,
  weatherDataset, weatherSnapshot, weatherLoading, weatherError,
}: ControlPanelProps) {
  const state = useSimulationStore()
  const year = getYear(state.localDate)
  const currentDay = getDayOfYear(state.localDate)
  const maxDay = daysInYear(year)

  const setDayOfYear = (day: number) => {
    if (Number.isFinite(day) && day >= 1 && day <= maxDay) state.setLocalDate(dateFromDayOfYear(year, day))
  }

  return (
    <aside className="control-panel">
      <Section title="项目位置">
        <div className="field-grid two-columns">
          <label>纬度
            <input type="number" min="-90" max="90" step="0.0001" value={state.latitude} disabled={state.weatherMode === 'nasa-power-2025'} onChange={(event) => state.setLatitude(event.currentTarget.valueAsNumber)} />
          </label>
          <label>经度
            <input type="number" min="-180" max="180" step="0.0001" value={state.longitude} disabled={state.weatherMode === 'nasa-power-2025'} onChange={(event) => state.setLongitude(event.currentTarget.valueAsNumber)} />
          </label>
        </div>
        <label>项目时区
          <input type="text" spellCheck={false} value={state.timeZone} disabled={state.weatherMode === 'nasa-power-2025'} onChange={(event) => state.setTimeZone(event.currentTarget.value)} aria-invalid={Boolean(error)} />
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
        <div className="date-compare">
          <h3>季节 / 固定日期对比</h3>
          <label className="range-label"><span>年内日期</span><output>第 {currentDay} / {maxDay} 天</output></label>
          <input aria-label="固定年内日期滑块" className="range" type="range" min="1" max={maxDay} step="1" value={currentDay} onInput={(event) => setDayOfYear(event.currentTarget.valueAsNumber)} />
          <label className="day-number-input">固定到第几天
            <input aria-label="固定到年内第几天" type="number" min="1" max={maxDay} step="1" value={currentDay} onChange={(event) => setDayOfYear(event.currentTarget.valueAsNumber)} />
          </label>
          <p className="hint">只改变日期，保留上方选定的当地时间，适合比较不同季节同一时刻的阴影。</p>
        </div>
        <div className="year-cycle-card">
          <h3>全年太阳循环</h3>
          <p className="cycle-progress">第 {currentDay} / {maxDay} 天 · {minutesToText(state.localTimeMinutes)}</p>
          <div className="playback-row">
            <PlaybackButton subject="全年太阳循环" active={state.yearPlaying} onClick={() => state.setYearPlaying(!state.yearPlaying)} />
            <label className="compact-select">速度
              <select value={state.yearSpeed} onChange={(event) => state.setYearSpeed(Number(event.currentTarget.value))}>
                {[
                  [0.25, '1 天 / 4 秒'],
                  [0.5, '1 天 / 2 秒'],
                  [1, '1 天 / 秒'],
                  [5, '5 天 / 秒'],
                ].map(([speed, label]) => <option value={speed} key={speed}>{label}</option>)}
              </select>
            </label>
            <label className="check"><input type="checkbox" checked={state.yearLoop} onChange={(event) => state.setYearLoop(event.currentTarget.checked)} /> 循环</label>
          </div>
          <p className="hint">日期和时间同时连续推进；每天完整经过日出、正午、日落与夜晚。</p>
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
        <PascalImport
          importedScene={importedScene}
          sceneSource={sceneSource}
          onImported={onPascalImported}
          onSceneSourceChange={onSceneSourceChange}
        />
      </Section>

      <Section title="天气">
        <details className="panel-details" open>
          <summary className="weather-summary">
            <span>{state.weatherMode === 'nasa-power-2025' ? 'NASA POWER 2025' : 'Clear Sky'}</span>
            {state.weatherMode === 'nasa-power-2025' && (
              <span className="weather-keyline">
                <span>直射辐照度 {formatWeather(weatherSnapshot?.dniWm2, 0)}</span>
                <span>温度 {formatMetric(weatherSnapshot?.temperatureC, '°C')}</span>
                <span>风 {formatWind(weatherSnapshot?.windSpeedMps, weatherSnapshot?.windDirectionDeg)}</span>
                <span>降水 {formatWeather(weatherSnapshot?.precipitation, 2)}</span>
              </span>
            )}
          </summary>
          <div className="panel-details-content">
            <label>天气模式
              <select value={state.weatherMode} onChange={(event) => state.setWeatherMode(event.currentTarget.value as 'clear-sky' | 'nasa-power-2025')}>
                <option value="clear-sky">晴空</option>
                <option value="nasa-power-2025">NASA POWER 2025</option>
              </select>
            </label>
            {state.weatherMode === 'clear-sky' ? (
              <p className="hint">晴空模式保持原有太阳与灯光行为。</p>
            ) : (
              <>
                {weatherLoading && <p className="hint">正在读取项目内的 2025 历史天气文件…</p>}
                {weatherError && <p className="error-message">{weatherError}</p>}
                {!weatherLoading && !weatherError && !weatherSnapshot && <p className="error-message">当前当地时间对应的 UTC 小时不在数据集中。</p>}
                {weatherSnapshot && (
                  <>
                    <dl className="weather-key-data">
                      <div><dt>直射法向辐照度（DNI）</dt><dd>{formatMetric(weatherSnapshot.dniWm2, 'W/m²')}</dd></div>
                      <div><dt>温度</dt><dd>{formatMetric(weatherSnapshot.temperatureC, '°C')}</dd></div>
                      <div><dt>风速 / 风向</dt><dd>{formatWind(weatherSnapshot.windSpeedMps, weatherSnapshot.windDirectionDeg)}</dd></div>
                      <div><dt>降水</dt><dd>{formatMetric(weatherSnapshot.precipitation, weatherDataset?.metadata.units[weatherDataset.metadata.precipitationSourceField] ?? '', 2)}</dd></div>
                    </dl>
                    <details className="nested-details">
                      <summary>更多天气数据</summary>
                      <dl className="solar-data weather-data">
                        <div><dt>GHI</dt><dd>{formatMetric(weatherSnapshot.ghiWm2, 'W/m²')}</dd></div>
                        <div><dt>DHI</dt><dd>{formatMetric(weatherSnapshot.dhiWm2, 'W/m²')}</dd></div>
                        <div><dt>相对湿度</dt><dd>{formatMetric(weatherSnapshot.relativeHumidityPct, '%')}</dd></div>
                        <div><dt>露点温度</dt><dd>{formatMetric(weatherSnapshot.dewPointC, '°C')}</dd></div>
                        <div><dt>湿球温度</dt><dd>{formatMetric(weatherSnapshot.wetBulbC, '°C')}</dd></div>
                        <div><dt>比湿</dt><dd>{formatMetric(weatherSnapshot.specificHumidityGkg, 'g/kg', 2)}</dd></div>
                        <div><dt>地表气压</dt><dd>{formatMetric(weatherSnapshot.surfacePressureKpa, 'kPa', 2)}</dd></div>
                        <div><dt>UTC 小时</dt><dd>{weatherSnapshot.utcTime.slice(0, 16).replace('T', ' ')}</dd></div>
                      </dl>
                    </details>
                  </>
                )}
                {weatherDataset && (
                  <>
                    <div className="weather-source">
                      <strong>来源：NASA POWER</strong>
                      <span>年份：2025</span>
                      <span>地点：Bellevue，47.6101，-122.2015</span>
                      <span>采样频率：逐小时</span>
                      <span>源数据时间：UTC</span>
                      <span>显示时区：America/Los_Angeles</span>
                      <span>历史网格化卫星/模型估算数据</span>
                      <span>非现场气象站实测数据</span>
                    </div>
                    <details className="nested-details climate-summary">
                      <summary>气候汇总</summary>
                      {weatherDataset.climateSummary ? (
                        <div className="climate-content">
                          <h3>年度</h3>
                          <dl className="solar-data">
                            <div><dt>平均温度</dt><dd>{formatMetric(weatherDataset.climateSummary.annual.averageTemperatureC, '°C')}</dd></div>
                            <div><dt>最低温度</dt><dd>{formatMetric(weatherDataset.climateSummary.annual.minimumTemperatureC, '°C')}</dd></div>
                            <div><dt>最高温度</dt><dd>{formatMetric(weatherDataset.climateSummary.annual.maximumTemperatureC, '°C')}</dd></div>
                            <div><dt>累计降水</dt><dd>{formatMetric(weatherDataset.climateSummary.annual.totalPrecipitationMm, weatherDataset.climateSummary.precipitationTotalUnit ?? '')}</dd></div>
                            <div><dt>降水小时数</dt><dd>{weatherDataset.climateSummary.annual.rainHours}</dd></div>
                            <div><dt>平均相对湿度</dt><dd>{formatMetric(weatherDataset.climateSummary.annual.averageRelativeHumidityPct, '%')}</dd></div>
                            <div><dt>平均风速</dt><dd>{formatMetric(weatherDataset.climateSummary.annual.averageWindSpeedMps, 'm/s')}</dd></div>
                            <div><dt>盛行风向</dt><dd>{formatMetric(weatherDataset.climateSummary.annual.prevailingWindDirectionDeg, '°', 0)}</dd></div>
                          </dl>
                          <h3>月度</h3>
                          <div className="climate-table-wrap">
                            <table className="climate-table">
                              <thead><tr><th>月份</th><th>平均 °C</th><th>降水 mm</th><th>降水 h</th><th>湿度 %</th><th>风速 m/s</th><th>GHI kWh/m²</th><th>DNI kWh/m²</th><th>DHI kWh/m²</th></tr></thead>
                              <tbody>
                                {weatherDataset.climateSummary.monthly.map((month) => (
                                  <tr key={month.month}>
                                    <th>{month.month}</th>
                                    <td>{formatWeather(month.averageTemperatureC)}</td>
                                    <td>{formatWeather(month.totalPrecipitationMm)}</td>
                                    <td>{month.rainHours}</td>
                                    <td>{formatWeather(month.averageRelativeHumidityPct)}</td>
                                    <td>{formatWeather(month.averageWindSpeedMps)}</td>
                                    <td>{formatWeather(month.ghiTotalKwhM2)}</td>
                                    <td>{formatWeather(month.dniTotalKwhM2)}</td>
                                    <td>{formatWeather(month.dhiTotalKwhM2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : <p>暂无数据</p>}
                    </details>
                    <details className="nested-details data-details">
                      <summary>数据详情</summary>
                      <div className="data-details-content">
                        <p>源文件：{weatherDataset.metadata.sourceFile}</p>
                        <p>CSV 原始记录：{weatherDataset.metadata.recordCount}</p>
                        <p>Bellevue 当地 2025 年记录：{weatherDataset.metadata.localYearRecordCount}</p>
                        <p>最早本地时间：{weatherDataset.metadata.earliestLocalTime ?? '暂无数据'}</p>
                        <p>最晚本地时间：{weatherDataset.metadata.latestLocalTime ?? '暂无数据'}</p>
                        <p>缺失小时数：{weatherDataset.metadata.missingHourCount}</p>
                        <p>含缺失值记录：{weatherDataset.metadata.missingRecordCount}</p>
                        <p>缺失值数量：{weatherDataset.metadata.missingValueCount}</p>
                        {weatherDataset.metadata.warnings.map((warning) => <p className="data-warning" key={warning}>{warning}</p>)}
                        <dl>
                          {Object.entries(weatherDataset.metadata.parameters).map(([key, description]) => (
                            <div key={key}><dt>{key}</dt><dd>{description} · {weatherDataset.metadata.units[key] ?? '未提供单位'}</dd></div>
                          ))}
                        </dl>
                        {Object.keys(weatherDataset.metadata.missingByField).length > 0 && (
                          <dl>
                            {Object.entries(weatherDataset.metadata.missingByField).map(([key, count]) => (
                              <div key={key}><dt>{key}</dt><dd>{count} 个缺失值</dd></div>
                            ))}
                          </dl>
                        )}
                      </div>
                    </details>
                  </>
                )}
              </>
            )}
          </div>
        </details>
      </Section>

      <Section title="太阳数据">
        <details className="panel-details">
          <summary>查看太阳位置与时刻</summary>
          <div className="panel-details-content">
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
          </div>
        </details>
      </Section>
    </aside>
  )
}
