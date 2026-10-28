import type { GroupItem, TaskItem, TaskPriority } from './demo'

type Example = { key: string; text: string; group: string; time: string | null; priority: TaskPriority }

const EXAMPLES: Example[] = [
  { key: 'work', text: 'Пример · Выбрать 3 рабочие задачи', group: 'work', time: '16:00', priority: 'high' },
  { key: 'home', text: 'Пример · Разобрать домашние дела', group: 'home', time: '20:00', priority: 'normal' },
  { key: 'learning', text: 'Пример · 15 минут обучения', group: 'personal', time: null, priority: 'low' },
  { key: 'family', text: 'Пример · Время с близкими', group: 'family', time: null, priority: 'normal' },
  { key: 'journal', text: 'Пример · Подвести итоги дня', group: 'trackers', time: '23:00', priority: 'normal' },
]

export const SAMPLE_TASK_COUNT = EXAMPLES.length

// Examples only appear when the user explicitly requests them. Stable IDs keep retries idempotent.
export function sampleTasksForDate(date: string, groups: GroupItem[], existing: TaskItem[], timestamp = new Date().toISOString()): TaskItem[] {
  const active = groups.filter(group => !group.archived)
  if (!active.length) return []
  const existingIds = new Set(existing.map(task => task.id))

  return EXAMPLES.flatMap(example => {
    const id = `sample-${date}-${example.key}`
    if (existingIds.has(id)) return []
    return [{
      id, text: example.text, date,
      group: active.find(group => group.id === example.group)?.id ?? active[0].id,
      time: example.time, priority: example.priority,
      notes: 'Демонстрационная задача: её можно изменить, выполнить или удалить.',
      repeat: 'none' as const, repeatUntil: null,
      done: false, completedAt: null, deletedAt: null,
      kind: 'task' as const, payment: null, collectionItemId: null,
      createdAt: timestamp, updatedAt: timestamp,
    }]
  })
}
