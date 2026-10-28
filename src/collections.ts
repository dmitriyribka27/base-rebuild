import type { TaskItem } from './demo'

export type CollectionItem = {
  id: string
  name: string
  emoji: string
  note: string
  order: number
  archived?: boolean
}

export type ListEntry = {
  id: string
  collectionId: string
  text: string
  note: string
  tags: string[]
  done: boolean
  order: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  deletedAt: string | null
}

export const defaultCollections: CollectionItem[] = [
  { id: 'books', name: 'Прочитать', emoji: '📚', note: 'Книги и авторы', order: 0 },
  { id: 'movies', name: 'Посмотреть', emoji: '🎬', note: 'Кино и сериалы', order: 1 },
  { id: 'food', name: 'Попробовать', emoji: '🍜', note: 'Блюда и рецепты', order: 2 },
  { id: 'places', name: 'Посетить', emoji: '🗺️', note: 'Места и поездки', order: 3 },
  { id: 'shopping', name: 'Купить', emoji: '🛍️', note: 'Покупки и находки', order: 4 },
  { id: 'together', name: 'Сделать вместе', emoji: '♡', note: 'Идеи для нас с Беллой', order: 5 },
  { id: 'wishes', name: 'Идеи и желания', emoji: '✳', note: 'Когда-нибудь', order: 6 },
]

export function collectionProgress(entries: ListEntry[], collectionId: string) {
  const active = entries.filter(entry => entry.collectionId === collectionId && !entry.deletedAt)
  const done = active.filter(entry => entry.done).length
  return { done, total: active.length, percent: active.length ? Math.round(done / active.length * 100) : 0 }
}

export function linkedTask(tasks: TaskItem[], entryId: string): TaskItem | undefined {
  return tasks.find(task => task.collectionItemId === entryId && !task.deletedAt)
}

export function setEntryDone(entry: ListEntry, done: boolean, updatedAt: string): ListEntry {
  return { ...entry, done, updatedAt, completedAt: done ? updatedAt : null }
}

export function setTaskDone(task: TaskItem, done: boolean, updatedAt: string): TaskItem {
  return { ...task, done, updatedAt, completedAt: done ? updatedAt : null }
}
