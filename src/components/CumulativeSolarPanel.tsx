import type {
  CumulativeDisplayResult,
  CumulativeProgress,
  CumulativeRangeSelection,
} from '../analysis/cumulativeSolar/cumulativeSolarTypes'

export function CumulativeSolarPanel({
  selection,
  onSelectionChange,
  running,
  progress,
  result,
  error,
  canCalculate,
  onStart,
  onCancel,
  onResetScale,
}: {
  selection: CumulativeRangeSelection
  onSelectionChange: (selection: CumulativeRangeSelection) => void
  running: boolean
  progress: CumulativeProgress | null
  result: CumulativeDisplayResult | null
  error: string | null
  canCalculate: boolean
  onStart: () => void
  onCancel: () => void
  onResetScale: () => void
}) {
  return (
    <div className="cumulative-panel">
      <label>分析时间范围
        <select
          value={selection.kind}
          disabled={running}
          onChange={(event) => onSelectionChange({ ...selection, kind: event.currentTarget.value as CumulativeRangeSelection['kind'] })}
        >
          <option value="day">一天</option>
          <option value="month">一个月</option>
          <option value="summer">夏季</option>
          <option value="winter">冬季</option>
          <option value="year">全年</option>
          <option value="custom">自定义日期范围</option>
        </select>
      </label>
      {selection.kind === 'custom' && (
        <div className="field-grid two-columns cumulative-dates">
          <label>开始日期<input type="date" value={selection.startDate} disabled={running} onChange={(event) => onSelectionChange({ ...selection, startDate: event.currentTarget.value })} /></label>
          <label>结束日期<input type="date" value={selection.endDate} disabled={running} onChange={(event) => onSelectionChange({ ...selection, endDate: event.currentTarget.value })} /></label>
        </div>
      )}
      <div className="cumulative-actions">
        <button type="button" className="secondary-button" disabled={!canCalculate || running} onClick={onStart}>
          {result ? '重新计算' : '开始计算'}
        </button>
        {running && <button type="button" className="secondary-button cancel-button" onClick={onCancel}>取消计算</button>}
      </div>
      {running && progress && (
        <div className="cumulative-progress">
          <progress max="100" value={progress.progressPct} />
          <span>{progress.progressPct.toFixed(0)}% · 已处理 {progress.processedHours} / {progress.totalHours} 小时</span>
        </div>
      )}
      {error && <p className="error-message">{error}</p>}
      {result && (
        <div className="cumulative-result-summary">
          {result.stale && <p className="data-warning">窗户参数已变化，累计结果需要重新计算。</p>}
          {result.lockedScaleMaxKWhM2 <= 0 ? (
            <p>该时间范围内没有检测到室内直射太阳能量。</p>
          ) : (
            <dl className="solar-data">
              <div className="data-wide"><dt>分析时间范围</dt><dd>{result.rangeLabel}</dd></div>
              <div><dt>有效天气小时数</dt><dd>{result.validWeatherHours}</dd></div>
              <div><dt>太阳计算小时数</dt><dd>{result.processedSolarHours}</dd></div>
              <div><dt>实际最大值</dt><dd>{result.actualMaximumKWhM2.toFixed(2)} kWh/m²</dd></div>
              <div><dt>色标上限</dt><dd>{result.lockedScaleMaxKWhM2.toFixed(2)} kWh/m²</dd></div>
              <div><dt>直射影响面积</dt><dd>{result.affectedAreaM2.toFixed(1)} m²</dd></div>
              <div><dt>最大直射日照时长</dt><dd>{result.maximumDirectSunHours.toFixed(0)} 小时</dd></div>
              <div><dt>平均直射日照时长</dt><dd>{result.averageDirectSunHours.toFixed(1)} 小时</dd></div>
              <div><dt>结果状态</dt><dd>{result.stale ? '需要重新计算' : '最新结果'}</dd></div>
            </dl>
          )}
          {result.lockedScaleMaxKWhM2 > 0 && (
            <button type="button" className="secondary-button reset-scale-button" onClick={onResetScale}>以当前结果重设色标</button>
          )}
        </div>
      )}
      <details className="nested-details">
        <summary>累计分析设置与说明</summary>
        <div className="data-details-content">
          <p>结果表示选定时间范围内，地板表面累计接收到的简化直射太阳能量，不包含天空漫射、室内反射和材料热工过程。</p>
          <p>SHGC 暂作为方案比较用的简化太阳透射系数，不代表完整产品与建筑热工模拟。</p>
          <p>P95（第95百分位）表示约95%的有效正数分析结果不超过该值。</p>
          <p>色标上限采用首次计算结果的P95，并在当前分析范围内锁定，用于比较窗户调整前后的变化。</p>
        </div>
      </details>
    </div>
  )
}
