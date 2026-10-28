export type TrackerType = 'boolean' | 'number' | 'scale'

export type TrackerDefinition = {
  id: string
  title: string
  type: TrackerType
  unit: string
  order: number
  archived: boolean
  createdAt: string
  updatedAt: string
}

export type TrackerReading = {
  id: string
  trackerId: string
  date: string
  value: boolean | number | null
  updatedAt: string
}

export type DayMode = { date: string; light: boolean; updatedAt: string }

export function trackerReadingId(date: string, trackerId: string) { return `${date}:${trackerId}` }

export function readingForDate(readings: TrackerReading[], date: string, trackerId: string): TrackerReading | undefined {
  return readings.find(reading => reading.id === trackerReadingId(date, trackerId))
}

export function lightDay(modes: DayMode[], date: string) {
  return modes.find(mode => mode.date === date)?.light ?? false
}

export function trackingValue(tracker: TrackerDefinition, value: boolean | number | null): string {
  if (value === null) return 'не указано'
  if (tracker.type === 'boolean') return value === true ? 'да' : 'нет'
  if (typeof value !== 'number') return 'не указано'
  return `${value.toLocaleString('ru-RU')}${tracker.type === 'scale' ? '/10' : tracker.unit.trim() ? ` ${tracker.unit.trim()}` : ''}`
}

export function readingsForReport(trackers: TrackerDefinition[], readings: TrackerReading[], date: string) {
  return [...trackers].sort((a, b) => a.order - b.order)
    .flatMap(tracker => {
      const reading = readingForDate(readings, date, tracker.id)
      return reading && reading.value !== null ? [`${tracker.title}: ${trackingValue(tracker, reading.value)}`] : []
    })
}

export function recordedDays(readings: TrackerReading[]) {
  return new Set(readings.filter(record => record.value !== null).map(record => record.date)).size
}
