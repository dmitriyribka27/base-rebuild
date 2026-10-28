import { parseKey, shiftDay, type OccurrenceItem, type RepeatRule, type TaskItem } from './demo'

export type ScheduledTask = {
  task: TaskItem
  date: string
  done: boolean
  recurring: boolean
}
export type SortMode = 'time' | 'priority' | 'newest'
export type StatusFilter = 'all' | 'open' | 'done'

export function recurrenceOf(task: TaskItem): RepeatRule {
  return task.repeat ?? 'none'
}

export function occurrenceId(taskId: string, date: string) {
  return `${taskId}::${date}`
}

export function matchesDate(task: TaskItem, date: string): boolean {
  if (task.deletedAt || date < task.date || (task.repeatUntil && date > task.repeatUntil)) return false
  const rule = recurrenceOf(task)
  if (rule === 'none') return task.date === date
  if (rule === 'daily') return true
  const weekday = parseKey(date).getUTCDay()
  if (rule === 'weekdays') return weekday !== 0 && weekday !== 6
  if (rule === 'weekly') return weekday === parseKey(task.date).getUTCDay()
  if (rule === 'monthly') {
    const [year, month, day] = date.split('-').map(Number)
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return day === Math.min(Number(task.date.slice(8)), lastDay)
  }
  return false
}

export function scheduledForDate(tasks: TaskItem[], occurrences: OccurrenceItem[], date: string): ScheduledTask[] {
  const states = new Map(occurrences.map(record => [record.id, record]))
  return tasks.filter(task => matchesDate(task, date)).map(task => {
    const recurring = recurrenceOf(task) !== 'none'
    return {
      task, date, recurring,
      done: recurring ? (states.get(occurrenceId(task.id, date))?.done ?? false) : task.done,
    }
  })
}

export function periodDates(selected: string, mode: 'day' | 'week' | 'month'): string[] {
  if (mode === 'day') return [selected]
  if (mode === 'week') {
    const weekday = (parseKey(selected).getUTCDay() + 6) % 7
    const start = shiftDay(selected, -weekday)
    return Array.from({ length: 7 }, (_, index) => shiftDay(start, index))
  }
  const [year, month] = selected.split('-').map(Number)
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Array.from({ length: days }, (_, index) =>
    `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`)
}

export function sortedTasks(rows: ScheduledTask[], mode: SortMode): ScheduledTask[] {
  const priorityValue = { high: 0, normal: 1, low: 2 }
  return [...rows].sort((a, b) => {
    if (mode === 'priority') {
      return priorityValue[a.task.priority] - priorityValue[b.task.priority]
        || (a.task.time ?? '99:99').localeCompare(b.task.time ?? '99:99')
        || a.task.createdAt.localeCompare(b.task.createdAt)
    }
    if (mode === 'newest') return b.task.createdAt.localeCompare(a.task.createdAt)
    return (a.task.time ?? '99:99').localeCompare(b.task.time ?? '99:99')
      || a.task.createdAt.localeCompare(b.task.createdAt)
  })
}
