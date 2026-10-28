export type GroupId = string
export type TaskPriority = 'low' | 'normal' | 'high'
export type RepeatRule = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly'
export type PaymentCurrency = 'GEL' | 'USD' | 'RUB'
export type PaymentInfo = { amount: number; currency: PaymentCurrency }
export type TaskSubtask = { id: string; text: string }
export type GroupItem = { id: string; name: string; emoji: string; note: string; order: number; archived?: boolean }
export type OccurrenceItem = { id: string; taskId: string; date: string; done: boolean; updatedAt: string; completedAt: string | null; subtaskDoneIds?: string[] }
export type TaskItem = {
  id: string
  group: GroupId
  text: string
  date: string
  done: boolean
  time: string | null
  endTime?: string | null
  notes: string
  subtasks?: TaskSubtask[]
  subtaskDoneIds?: string[]
  priority: TaskPriority
  createdAt: string
  updatedAt: string
  completedAt: string | null
  deletedAt: string | null
  repeat?: RepeatRule
  repeatUntil?: string | null
  collectionItemId?: string | null
  kind?: 'task' | 'payment'
  payment?: PaymentInfo | null
}

export const defaultGroups: GroupItem[] = [
  { id: 'morning', name: 'Утренняя рутина', emoji: '☀', note: 'Без привязки ко времени', order: 0 },
  { id: 'work', name: 'Работа · Sea Livery', emoji: '▦', note: 'Главные рабочие дела', order: 1 },
  { id: 'family', name: 'Белла и семья', emoji: '♡', note: 'Время вместе', order: 2 },
  { id: 'home', name: 'Дом и коты', emoji: '⌂', note: 'Быт и забота', order: 3 },
  { id: 'health', name: 'Здоровье', emoji: '✚', note: 'Самочувствие и движение', order: 4 },
  { id: 'personal', name: 'Личное', emoji: '✳', note: 'Развитие и идеи', order: 5 },
  { id: 'finance', name: 'Финансы', emoji: '₾', note: 'Платежи и обязательства', order: 6 },
  { id: 'trackers', name: 'Трекеры', emoji: '◈', note: 'Заметить своё состояние', order: 7 },
]

export function dateKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function parseKey(key: string): Date {
  return new Date(`${key}T12:00:00+04:00`)
}

export function shiftDay(key: string, by: number): string {
  const date = parseKey(key)
  date.setUTCDate(date.getUTCDate() + by)
  return dateKey(date)
}

export function localDate(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tbilisi', ...options }).format(parseKey(key))
}
