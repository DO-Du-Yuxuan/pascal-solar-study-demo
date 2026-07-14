import { dateFromDayOfYear, daysInYear, getDayOfYear } from '../solar'

const MINUTES_PER_DAY = 1440

export interface YearCyclePosition {
  localDate: string
  localTimeMinutes: number
}

export function toYearMinuteCursor(localDate: string, localTimeMinutes: number): number {
  return (getDayOfYear(localDate) - 1) * MINUTES_PER_DAY + localTimeMinutes
}

export function advanceYearMinuteCursor(
  cursor: number,
  elapsedDays: number,
  year: number,
  loop: boolean,
): { cursor: number; completed: boolean } {
  const totalMinutes = daysInYear(year) * MINUTES_PER_DAY
  const advanced = cursor + elapsedDays * MINUTES_PER_DAY
  if (advanced < totalMinutes) return { cursor: advanced, completed: false }
  if (loop) return { cursor: advanced % totalMinutes, completed: false }
  return { cursor: totalMinutes - 1, completed: true }
}

export function fromYearMinuteCursor(year: number, cursor: number): YearCyclePosition {
  const wholeMinutes = Math.max(0, Math.floor(cursor))
  const ordinal = Math.floor(wholeMinutes / MINUTES_PER_DAY) + 1
  return {
    localDate: dateFromDayOfYear(year, ordinal),
    localTimeMinutes: wholeMinutes % MINUTES_PER_DAY,
  }
}
