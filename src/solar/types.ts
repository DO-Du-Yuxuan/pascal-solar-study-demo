export type Vector3Tuple = [number, number, number]

export interface SolarInput {
  latitude: number
  longitude: number
  timeZone: string
  localDate: string
  localTimeMinutes: number
  northOffsetDeg: number
}

export interface SunTimesResult {
  sunrise: Date | null
  solarNoon: Date | null
  sunset: Date | null
}

export interface SolarState extends SunTimesResult {
  instant: Date
  altitudeDeg: number
  azimuthDeg: number
  worldDirection: Vector3Tuple
  lightPosition: Vector3Tuple
  isAboveHorizon: boolean
}

export interface SunPathPoint {
  instant: Date
  altitudeDeg: number
  worldDirection: Vector3Tuple
}
