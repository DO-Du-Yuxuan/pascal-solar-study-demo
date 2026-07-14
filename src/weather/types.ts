export type WeatherMode = 'clear-sky' | 'nasa-power-2025'

export interface WeatherRecord {
  utcTime: string
  ghiWm2: number | null
  dniWm2: number | null
  dhiWm2: number | null
  temperatureC: number | null
  relativeHumidityPct: number | null
  windSpeedMps: number | null
  windDirectionDeg: number | null
  precipitation: number | null
  dewPointC: number | null
  wetBulbC: number | null
  surfacePressureKpa: number | null
  specificHumidityGkg: number | null
}

export type WeatherValueKey = Exclude<keyof WeatherRecord, 'utcTime'>

export interface WeatherMetadata {
  source: 'NASA POWER'
  year: 2025
  latitude: number
  longitude: number
  sourceTimeStandard: 'UTC'
  displayTimeZone: 'America/Los_Angeles'
  sampling: 'Hourly'
  sourceFile: string
  dataDescription: string
  parameters: Record<string, string>
  units: Record<string, string>
  precipitationSourceField: 'PRECTOT' | 'PRECTOTCORR'
  recordCount: number
  localYearRecordCount: number
  earliestLocalTime: string | null
  latestLocalTime: string | null
  missingHourCount: number
  missingRecordCount: number
  missingValueCount: number
  missingByField: Partial<Record<WeatherValueKey, number>>
  warnings: string[]
}

export interface AnnualClimateSummary {
  averageTemperatureC: number | null
  minimumTemperatureC: number | null
  maximumTemperatureC: number | null
  totalPrecipitationMm: number | null
  rainHours: number
  averageRelativeHumidityPct: number | null
  averageWindSpeedMps: number | null
  prevailingWindDirectionDeg: number | null
}

export interface MonthlyClimateSummary {
  month: number
  recordCount: number
  averageTemperatureC: number | null
  totalPrecipitationMm: number | null
  rainHours: number
  averageRelativeHumidityPct: number | null
  averageWindSpeedMps: number | null
  ghiTotalKwhM2: number | null
  dniTotalKwhM2: number | null
  dhiTotalKwhM2: number | null
}

export interface ClimateSummary {
  annual: AnnualClimateSummary
  monthly: MonthlyClimateSummary[]
  precipitationTotalUnit: 'mm' | null
  radiationTotalUnit: 'kWh/m²' | null
}

export interface WeatherDataset {
  metadata: WeatherMetadata
  records: WeatherRecord[]
  climateSummary: ClimateSummary | null
}

export interface WeatherSnapshot extends Omit<WeatherRecord, 'utcTime'> {
  utcTime: string
  nextUtcTime: string | null
  interpolationFraction: number
}
