import { sleepHours, type JournalEntry } from './journal.ts'
import { localDate, shiftDay } from './demo'
import { periodDates } from './schedule'
import type { TrackerDefinition, TrackerReading } from './trackers'

export type InsightPeriod = 'week' | 'month'
export type TrackerPoint = { date: string; value: boolean | number | null }

export function insightDates(anchor: string, period: InsightPeriod) {
  return periodDates(anchor, period)
}

export function shiftInsightPeriod(anchor: string, period: InsightPeriod, direction: -1 | 1) {
  if (period === 'week') return shiftDay(anchor, direction * 7)
  const [year, month, day] = anchor.split('-').map(Number)
  const nextMonth = new Date(Date.UTC(year, month - 1 + direction, 1))
  const nextYear = nextMonth.getUTCFullYear()
  const nextMonthNumber = nextMonth.getUTCMonth() + 1
  const maxDay = new Date(Date.UTC(nextYear, nextMonthNumber, 0)).getUTCDate()
  return `${nextYear}-${String(nextMonthNumber).padStart(2, '0')}-${String(Math.min(day, maxDay)).padStart(2, '0')}`
}

export function insightPeriodLabel(dates: string[], period: InsightPeriod) {
  if (!dates.length) return ''
  if (period === 'month') return localDate(dates[0], { month: 'long', year: 'numeric' })
  const first = localDate(dates[0], { day: 'numeric', month: 'short' })
  const last = localDate(dates[dates.length - 1], { day: 'numeric', month: 'short', year: 'numeric' })
  return `${first} – ${last}`
}

export function trackerInsight(tracker: TrackerDefinition, readings: TrackerReading[], dates: string[]) {
  const lookup = new Map(readings.filter(row => row.trackerId === tracker.id).map(row => [row.date, row.value]))
  const points: TrackerPoint[] = dates.map(date => ({ date, value: lookup.get(date) ?? null }))
  const observed = points.filter(point => point.value !== null)
  const numberValues = observed.map(point => point.value).filter((value): value is number => typeof value === 'number')
  const yesCount = observed.filter(point => point.value === true).length
  const noCount = observed.filter(point => point.value === false).length
  const average = numberValues.length ? numberValues.reduce((total, number) => total + number, 0) / numberValues.length : null
  const maximum = numberValues.length ? Math.max(...numberValues) : null
  const minimum = numberValues.length ? Math.min(...numberValues) : null
  return { points, count: observed.length, yesCount, noCount, average, minimum, maximum }
}

function average(numbers: number[]) { return numbers.length ? numbers.reduce((sum, number) => sum + number, 0) / numbers.length : null }

export function journalInsight(journals: JournalEntry[], dates: string[]) {
  const keys = new Set(dates)
  const entries = journals.filter(entry => keys.has(entry.date))
  const energies = entries.map(entry => entry.energy).filter((value): value is number => value !== null)
  const moods = entries.map(entry => entry.mood).filter((value): value is number => value !== null)
  const sleeps = entries.map(entry => sleepHours(entry.sleepAt, entry.wakeAt)).filter((value): value is number => value !== null)
  const cigarettes = entries.map(entry => entry.cigarettes).filter((value): value is number => value !== null)
  return {
    energy: { average: average(energies), count: energies.length },
    mood: { average: average(moods), count: moods.length },
    sleep: { average: average(sleeps), count: sleeps.length },
    cigarettes: { average: average(cigarettes), count: cigarettes.length, sum: cigarettes.reduce((sum, number) => sum + number, 0) },
  }
}
