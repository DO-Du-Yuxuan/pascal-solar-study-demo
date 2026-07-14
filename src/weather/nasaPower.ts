import { DateTime } from 'luxon'
import type {
  AnnualClimateSummary,
  ClimateSummary,
  MonthlyClimateSummary,
  WeatherDataset,
  WeatherMetadata,
  WeatherRecord,
  WeatherSnapshot,
  WeatherValueKey,
} from './types'

const SOURCE_FILE = 'POWER_Point_Hourly_20250101_20251231_047d61N_0122d20W_UTC.csv'
const DISPLAY_TIME_ZONE = 'America/Los_Angeles'
const YEAR = 2025
const HOUR_MS = 3_600_000

const sourceFields = [
  'ALLSKY_SFC_SW_DWN', 'ALLSKY_SFC_SW_DNI', 'ALLSKY_SFC_SW_DIFF',
  'T2M', 'RH2M', 'WS10M', 'WD10M', 'T2MDEW', 'T2MWET', 'PS', 'QV2M',
] as const

const sourceToRecord = {
  ALLSKY_SFC_SW_DWN: 'ghiWm2',
  ALLSKY_SFC_SW_DNI: 'dniWm2',
  ALLSKY_SFC_SW_DIFF: 'dhiWm2',
  T2M: 'temperatureC',
  RH2M: 'relativeHumidityPct',
  WS10M: 'windSpeedMps',
  WD10M: 'windDirectionDeg',
  T2MDEW: 'dewPointC',
  T2MWET: 'wetBulbC',
  PS: 'surfacePressureKpa',
  QV2M: 'specificHumidityGkg',
} as const satisfies Record<(typeof sourceFields)[number], WeatherValueKey>

const interpolatedKeys = [
  'ghiWm2', 'dniWm2', 'dhiWm2', 'temperatureC', 'relativeHumidityPct',
  'windSpeedMps', 'dewPointC', 'wetBulbC', 'surfacePressureKpa', 'specificHumidityGkg',
] as const satisfies readonly WeatherValueKey[]

const allValueKeys = [
  ...interpolatedKeys, 'windDirectionDeg', 'precipitation',
] as const satisfies readonly WeatherValueKey[]

const recordMaps = new WeakMap<WeatherDataset, Map<number, WeatherRecord>>()

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      values.push(value.trim())
      value = ''
    } else {
      value += character
    }
  }
  values.push(value.trim())
  return values
}

function parseHeaderMetadata(lines: string[]): { parameters: Record<string, string>; units: Record<string, string> } {
  const parameters: Record<string, string> = {}
  const units: Record<string, string> = {}
  for (const line of lines) {
    const match = line.trim().match(/^([A-Z][A-Z0-9_]*)\s+(.+?)\s+\(([^()]*)\)\s*$/)
    if (!match) continue
    const field = match[1]
    const description = match[2]
    const unit = match[3]
    if (!field || !description || !unit) continue
    parameters[field] = description
    units[field] = unit
  }
  return { parameters, units }
}

function parseNullableNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return !Number.isFinite(parsed) || parsed <= -900 ? null : parsed
}

function formatLocal(timestamp: number): string {
  return DateTime.fromMillis(timestamp, { zone: 'utc' }).setZone(DISPLAY_TIME_ZONE).toFormat("yyyy-LL-dd HH:mm ZZZZ")
}

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null)
  return valid.length > 0 ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

function minimum(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null)
  return valid.length > 0 ? Math.min(...valid) : null
}

function maximum(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null)
  return valid.length > 0 ? Math.max(...valid) : null
}

function normalizedUnit(unit: string | undefined): string {
  return (unit ?? '').toLowerCase().replaceAll(' ', '').replace('²', '2')
}

function precipitationTotal(records: WeatherRecord[], sourceUnit: string | undefined): number | null {
  const values = records.map((record) => record.precipitation).filter((value): value is number => value !== null)
  if (values.length === 0) return null
  const unit = normalizedUnit(sourceUnit)
  if (unit === 'mm/day') return values.reduce((sum, value) => sum + value / 24, 0)
  if (unit === 'mm/hour' || unit === 'mm/hr' || unit === 'mm/h') return values.reduce((sum, value) => sum + value, 0)
  return null
}

function radiationTotal(records: WeatherRecord[], key: 'ghiWm2' | 'dniWm2' | 'dhiWm2', sourceUnit: string | undefined): number | null {
  const unit = normalizedUnit(sourceUnit).replace('−', '-').replace('^-', '-')
  if (!['wm-2', 'w/m2', 'wm2'].includes(unit)) return null
  const values = records.map((record) => record[key]).filter((value): value is number => value !== null)
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / 1000 : null
}

function prevailingWindDirection(records: WeatherRecord[]): number | null {
  let x = 0
  let y = 0
  let count = 0
  for (const record of records) {
    if (record.windDirectionDeg === null) continue
    const weight = record.windSpeedMps !== null && record.windSpeedMps > 0 ? record.windSpeedMps : 1
    const radians = record.windDirectionDeg * Math.PI / 180
    x += Math.sin(radians) * weight
    y += Math.cos(radians) * weight
    count += 1
  }
  if (count === 0 || (Math.abs(x) < 1e-12 && Math.abs(y) < 1e-12)) return null
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360
}

function annualSummary(records: WeatherRecord[], precipitationUnit: string | undefined): AnnualClimateSummary {
  const temperatures = records.map((record) => record.temperatureC)
  return {
    averageTemperatureC: average(temperatures),
    minimumTemperatureC: minimum(temperatures),
    maximumTemperatureC: maximum(temperatures),
    totalPrecipitationMm: precipitationTotal(records, precipitationUnit),
    rainHours: records.filter((record) => record.precipitation !== null && record.precipitation > 0).length,
    averageRelativeHumidityPct: average(records.map((record) => record.relativeHumidityPct)),
    averageWindSpeedMps: average(records.map((record) => record.windSpeedMps)),
    prevailingWindDirectionDeg: prevailingWindDirection(records),
  }
}

function createClimateSummary(records: WeatherRecord[], units: Record<string, string>, precipitationField: 'PRECTOT' | 'PRECTOTCORR'): ClimateSummary {
  const precipitationUnit = units[precipitationField]
  const localRecords = records.filter((record) => DateTime.fromISO(record.utcTime, { zone: 'utc' }).setZone(DISPLAY_TIME_ZONE).year === YEAR)
  const monthly: MonthlyClimateSummary[] = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const monthRecords = localRecords.filter((record) => DateTime.fromISO(record.utcTime, { zone: 'utc' }).setZone(DISPLAY_TIME_ZONE).month === month)
    return {
      month,
      recordCount: monthRecords.length,
      averageTemperatureC: average(monthRecords.map((record) => record.temperatureC)),
      totalPrecipitationMm: precipitationTotal(monthRecords, precipitationUnit),
      rainHours: monthRecords.filter((record) => record.precipitation !== null && record.precipitation > 0).length,
      averageRelativeHumidityPct: average(monthRecords.map((record) => record.relativeHumidityPct)),
      averageWindSpeedMps: average(monthRecords.map((record) => record.windSpeedMps)),
      ghiTotalKwhM2: radiationTotal(monthRecords, 'ghiWm2', units.ALLSKY_SFC_SW_DWN),
      dniTotalKwhM2: radiationTotal(monthRecords, 'dniWm2', units.ALLSKY_SFC_SW_DNI),
      dhiTotalKwhM2: radiationTotal(monthRecords, 'dhiWm2', units.ALLSKY_SFC_SW_DIFF),
    }
  })
  const hasPrecipitationUnit = precipitationTotal(localRecords, precipitationUnit) !== null
  const hasRadiationUnit = radiationTotal(localRecords, 'ghiWm2', units.ALLSKY_SFC_SW_DWN) !== null
  return {
    annual: annualSummary(localRecords, precipitationUnit),
    monthly,
    precipitationTotalUnit: hasPrecipitationUnit ? 'mm' : null,
    radiationTotalUnit: hasRadiationUnit ? 'kWh/m²' : null,
  }
}

export function parseNasaPowerCsv(csv: string): WeatherDataset {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/)
  const headerIndex = lines.findIndex((line) => {
    const fields = parseCsvLine(line)
    return ['YEAR', 'MO', 'DY', 'HR', ...sourceFields].every((field) => fields.includes(field))
      && (fields.includes('PRECTOT') || fields.includes('PRECTOTCORR'))
  })
  if (headerIndex < 0) throw new Error('NASA POWER CSV 中未找到包含全部气象字段的实际表头。')

  const headerLine = lines[headerIndex]
  if (!headerLine) throw new Error('NASA POWER CSV 的实际表头为空。')
  const header = parseCsvLine(headerLine)
  const indexes = new Map(header.map((field, index) => [field, index]))
  const precipitationSourceField = indexes.has('PRECTOT') ? 'PRECTOT' : 'PRECTOTCORR'
  const { parameters, units } = parseHeaderMetadata(lines.slice(0, headerIndex))
  const missingByField: Partial<Record<WeatherValueKey, number>> = {}
  const records: WeatherRecord[] = []
  let missingRecordCount = 0

  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue
    const values = parseCsvLine(line)
    const get = (field: string): string => values[indexes.get(field) ?? -1] ?? ''
    const year = Number(get('YEAR'))
    const month = Number(get('MO'))
    const day = Number(get('DY'))
    const hour = Number(get('HR'))
    const timestamp = Date.UTC(year, month - 1, day, hour)
    const date = new Date(timestamp)
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || date.getUTCHours() !== hour) {
      throw new Error(`NASA POWER CSV 包含无效 UTC 时间：${year}-${month}-${day} ${hour}:00。`)
    }

    const record: WeatherRecord = {
      utcTime: new Date(timestamp).toISOString(),
      ghiWm2: null,
      dniWm2: null,
      dhiWm2: null,
      temperatureC: null,
      relativeHumidityPct: null,
      windSpeedMps: null,
      windDirectionDeg: null,
      precipitation: parseNullableNumber(get(precipitationSourceField)),
      dewPointC: null,
      wetBulbC: null,
      surfacePressureKpa: null,
      specificHumidityGkg: null,
    }
    for (const field of sourceFields) record[sourceToRecord[field]] = parseNullableNumber(get(field))

    let recordHasMissing = false
    for (const key of allValueKeys) {
      if (record[key] !== null) continue
      missingByField[key] = (missingByField[key] ?? 0) + 1
      recordHasMissing = true
    }
    if (recordHasMissing) missingRecordCount += 1
    records.push(record)
  }
  records.sort((first, second) => Date.parse(first.utcTime) - Date.parse(second.utcTime))
  if (records.length === 0) throw new Error('NASA POWER CSV 没有可解析的数据记录。')

  const timestamps = new Set(records.map((record) => Date.parse(record.utcTime)))
  const localStart = DateTime.fromObject({ year: YEAR, month: 1, day: 1, hour: 0 }, { zone: DISPLAY_TIME_ZONE }).toUTC()
  const localEnd = localStart.plus({ years: 1 })
  let missingHourCount = 0
  for (let timestamp = localStart.toMillis(); timestamp < localEnd.toMillis(); timestamp += HOUR_MS) {
    if (!timestamps.has(timestamp)) missingHourCount += 1
  }
  const localYearRecordCount = records.filter((record) => {
    return DateTime.fromISO(record.utcTime, { zone: 'utc' }).setZone(DISPLAY_TIME_ZONE).year === YEAR
  }).length
  const warnings: string[] = []
  if (missingHourCount > 0) warnings.push(`Bellevue 当地 ${YEAR} 年缺少 ${missingHourCount} 个 UTC 对应小时；未生成填充值。`)
  const missingValueCount = Object.values(missingByField).reduce((sum, value) => sum + (value ?? 0), 0)
  if (missingValueCount > 0) warnings.push(`CSV 中有 ${missingValueCount} 个缺失气象值，均保留为 null。`)

  const metadata: WeatherMetadata = {
    source: 'NASA POWER',
    year: YEAR,
    latitude: 47.6101,
    longitude: -122.2015,
    sourceTimeStandard: 'UTC',
    displayTimeZone: DISPLAY_TIME_ZONE,
    sampling: 'Hourly',
    sourceFile: SOURCE_FILE,
    dataDescription: 'Historical gridded satellite/model-derived estimates; not an on-site measurement',
    parameters,
    units,
    precipitationSourceField,
    recordCount: records.length,
    localYearRecordCount,
    earliestLocalTime: formatLocal(Date.parse(records[0]!.utcTime)),
    latestLocalTime: formatLocal(Date.parse(records.at(-1)?.utcTime ?? '')),
    missingHourCount,
    missingRecordCount,
    missingValueCount,
    missingByField,
    warnings,
  }
  return { metadata, records, climateSummary: createClimateSummary(records, units, precipitationSourceField) }
}

export async function loadNasaPower2025(signal?: AbortSignal): Promise<WeatherDataset> {
  const response = await fetch(`${import.meta.env.BASE_URL}${SOURCE_FILE}`, { signal })
  if (!response.ok) throw new Error(`无法读取 NASA POWER 扩展 CSV（${response.status}）。`)
  return parseNasaPowerCsv(await response.text())
}

function interpolateValue(first: number | null, second: number | null, fraction: number): number | null {
  if (fraction === 0) return first
  if (first === null || second === null) return null
  return first + (second - first) * fraction
}

function nearestValue(first: number | null, second: number | null, fraction: number): number | null {
  return fraction < 0.5 || second === null ? first : second
}

export function weatherAtInstant(dataset: WeatherDataset, instant: Date): WeatherSnapshot | null {
  const timestamp = instant.getTime()
  const hourTimestamp = Math.floor(timestamp / HOUR_MS) * HOUR_MS
  const nextTimestamp = hourTimestamp + HOUR_MS
  let byTimestamp = recordMaps.get(dataset)
  if (!byTimestamp) {
    byTimestamp = new Map(dataset.records.map((record) => [Date.parse(record.utcTime), record]))
    recordMaps.set(dataset, byTimestamp)
  }
  const current = byTimestamp.get(hourTimestamp)
  if (!current) return null
  const next = byTimestamp.get(nextTimestamp) ?? null
  const fraction = (timestamp - hourTimestamp) / HOUR_MS
  const snapshot = { ...current } as WeatherSnapshot
  for (const key of interpolatedKeys) snapshot[key] = interpolateValue(current[key], next?.[key] ?? null, fraction)
  snapshot.windDirectionDeg = nearestValue(current.windDirectionDeg, next?.windDirectionDeg ?? null, fraction)
  snapshot.precipitation = nearestValue(current.precipitation, next?.precipitation ?? null, fraction)
  snapshot.nextUtcTime = next?.utcTime ?? null
  snapshot.interpolationFraction = fraction
  return snapshot
}
