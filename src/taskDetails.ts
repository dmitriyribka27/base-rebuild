import type { TaskItem } from './demo'

export function checkedSubtasks(task: TaskItem, done: boolean, recorded?: string[]): string[] {
  const validIds = (task.subtasks ?? []).map(part => part.id)
  if (done) return validIds
  const checked = new Set(recorded ?? [])
  return validIds.filter(id => checked.has(id))
}

export function toggleSubtask(task: TaskItem, checked: string[], id: string): { subtaskDoneIds: string[]; done: boolean } {
  const parts = task.subtasks ?? []
  if (!parts.some(part => part.id === id)) throw new Error('Подзадача не найдена.')
  const marked = new Set(checked)
  if (marked.has(id)) marked.delete(id)
  else marked.add(id)
  const next = parts.map(part => part.id).filter(key => marked.has(key))
  return { subtaskDoneIds: next, done: parts.length > 0 && next.length === parts.length }
}

export function durationLabel(start: string | null, end: string | null | undefined): string | null {
  if (!start || !end || end <= start) return null
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  const minutes = (endHour - startHour) * 60 + endMinute - startMinute
  if (minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours ? `${hours} ч` : '', rest ? `${rest} мин` : ''].filter(Boolean).join(' ')
}
