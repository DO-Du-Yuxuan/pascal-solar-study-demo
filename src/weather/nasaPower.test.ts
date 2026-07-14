import { describe, expect, it } from 'vitest'
import { parseNasaPowerCsv, weatherAtInstant } from './nasaPower'
import type { WeatherDataset, WeatherRecord } from './types'

function record(utcTime: string, values: Partial<WeatherRecord>): WeatherRecord {
  return {
    utcTime,
    ghiWm2: 0,
    dniWm2: 0,
    dhiWm2: 0,
    temperatureC: 0,
    relativeHumidityPct: 0,
    windSpeedMps: 0,
    windDirectionDeg: 0,
    precipitation: 0,
    dewPointC: 0,
    wetBulbC: 0,
    surfacePressureKpa: 0,
    specificHumidityGkg: 0,
    ...values,
  }
}

const dataset: WeatherDataset = {
  metadata: {
    source: 'NASA POWER', year: 2025, latitude: 47.6101, longitude: -122.2015,
    sourceTimeStandard: 'UTC', displayTimeZone: 'America/Los_Angeles', sampling: 'Hourly',
    sourceFile: 'test.csv', dataDescription: 'test', parameters: {}, units: {}, precipitationSourceField: 'PRECTOT',
    recordCount: 2, localYearRecordCount: 2, earliestLocalTime: null, latestLocalTime: null,
    missingHourCount: 0, missingRecordCount: 0, missingValueCount: 0, missingByField: {}, warnings: [],
  },
  records: [
    record('2025-01-01T00:00:00.000Z', { dniWm2: 100, temperatureC: 10, windSpeedMps: 2, windDirectionDeg: 350, precipitation: 1 }),
    record('2025-01-01T01:00:00.000Z', { dniWm2: 300, temperatureC: 12, windSpeedMps: 4, windDirectionDeg: 10, precipitation: 5 }),
  ],
  climateSummary: null,
}

describe('NASA POWER CSV weather', () => {
  it('interpolates scalar values but uses nearest-hour wind direction and precipitation', () => {
    const early = weatherAtInstant(dataset, new Date('2025-01-01T00:15:00.000Z'))
    const late = weatherAtInstant(dataset, new Date('2025-01-01T00:45:00.000Z'))
    expect(early?.dniWm2).toBe(150)
    expect(early?.windDirectionDeg).toBe(350)
    expect(early?.precipitation).toBe(1)
    expect(late?.dniWm2).toBe(250)
    expect(late?.windDirectionDeg).toBe(10)
    expect(late?.precipitation).toBe(5)
  })

  it('finds the real header, accepts PRECTOTCORR, and preserves -999 as null', () => {
    const csv = [
      '-BEGIN HEADER-',
      'ALLSKY_SFC_SW_DWN Irradiance (W m-2)',
      'PRECTOTCORR Precipitation Corrected (mm/day)',
      '-END HEADER-',
      'YEAR,MO,DY,HR,ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI,ALLSKY_SFC_SW_DIFF,T2M,RH2M,WS10M,WD10M,T2MDEW,T2MWET,PS,QV2M,PRECTOTCORR',
      '2025,1,1,8,100,200,20,-999,75,2,180,3,4,100,5,1.2',
    ].join('\n')
    const parsed = parseNasaPowerCsv(csv)
    expect(parsed.records).toHaveLength(1)
    expect(parsed.records[0]!.temperatureC).toBeNull()
    expect(parsed.records[0]!.precipitation).toBe(1.2)
    expect(parsed.metadata.precipitationSourceField).toBe('PRECTOTCORR')
    expect(parsed.metadata.missingByField.temperatureC).toBe(1)
  })
})
