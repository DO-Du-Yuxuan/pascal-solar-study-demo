import { DateTime, IANAZone } from 'luxon'

export function isValidTimeZone(timeZone: string): boolean {
  return IANAZone.isValidZone(timeZone)
}

export function localDateTimeToInstant(
  localDate: string,
  localTimeMinutes: number,
  timeZone: string,
): Date {
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError(`无效的 IANA 时区：${timeZone}`)
  }

  const wholeMinutes = Math.max(0, Math.min(1439, Math.round(localTimeMinutes)))
  const hours = Math.floor(wholeMinutes / 60)
  const minutes = wholeMinutes % 60
  const dateTime = DateTime.fromISO(localDate, { zone: timeZone }).set({
    hour: hours,
    minute: minutes,
    second: 0,
    millisecond: 0,
  })

  if (!dateTime.isValid) {
    throw new RangeError(`无效的当地日期：${localDate}`)
  }

  return dateTime.toJSDate()
}

export function formatInstantInZone(
  instant: Date | null,
  timeZone: string,
  format = 'HH:mm',
): string {
  if (!instant) return '—'
  return DateTime.fromJSDate(instant, { zone: timeZone }).toFormat(format)
}

export function getMinuteOfDayInZone(instant: Date | null, timeZone: string): number | null {
  if (!instant) return null
  const dateTime = DateTime.fromJSDate(instant, { zone: timeZone })
  return dateTime.hour * 60 + dateTime.minute
}

export function getDayOfYear(localDate: string): number {
  const dateTime = DateTime.fromISO(localDate)
  if (!dateTime.isValid) throw new RangeError(`无效的当地日期：${localDate}`)
  return dateTime.ordinal
}

export function dateFromDayOfYear(year: number, dayOfYear: number): string {
  const dateTime = DateTime.fromObject({ year, ordinal: dayOfYear })
  if (!dateTime.isValid) throw new RangeError(`${year} 年不存在第 ${dayOfYear} 天`)
  return dateTime.toISODate() ?? `${year}-01-01`
}

export function daysInYear(year: number): number {
  return DateTime.local(year).daysInYear ?? 365
}

export function getYear(localDate: string): number {
  const dateTime = DateTime.fromISO(localDate)
  if (!dateTime.isValid) throw new RangeError(`无效的当地日期：${localDate}`)
  return dateTime.year
}
