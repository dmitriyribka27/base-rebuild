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
  { id: 'shopping', name: 'Покупки', emoji: '🛒', note: 'Для дома и походов в магазин', order: 0 },
  { id: 'books', name: 'Прочитать', emoji: '📚', note: 'Книги и авторы', order: 1 },
  { id: 'movies', name: 'Посмотреть', emoji: '🎬', note: 'Кино и сериалы', order: 2 },
  { id: 'food', name: 'Попробовать', emoji: '🍜', note: 'Блюда и рецепты', order: 3 },
  { id: 'places', name: 'Посетить', emoji: '🗺️', note: 'Места и поездки', order: 4 },
  { id: 'together', name: 'Сделать вместе', emoji: '♡', note: 'Идеи для нас с Беллой', order: 5 },
  { id: 'wishes', name: 'Идеи и желания', emoji: '✳', note: 'Когда-нибудь', order: 6 },
]

// Existing installations keep the original collection ID and stored entries.
export function displayCollectionName(collection: CollectionItem): string {
  return collection.id === 'shopping' && collection.name === 'Купить' ? 'Покупки' : collection.name
}

export function displayCollectionNote(collection: CollectionItem): string {
  return collection.id === 'shopping' && collection.note === 'Покупки и находки' ? 'Для дома и походов в магазин' : collection.note
}

export function orderedCollections(collections: CollectionItem[]): CollectionItem[] {
  return [...collections].sort((a, b) => (a.id === 'shopping' ? -1 : b.id === 'shopping' ? 1 : a.order - b.order))
}

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
