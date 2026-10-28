import { defaultGroups, type GroupItem, type OccurrenceItem, type RepeatRule, type TaskItem, type TaskPriority } from './demo'
import { defaultCollections, type CollectionItem, type ListEntry } from './collections'
import { occurrenceId } from './schedule'

const DATABASE = 'base-rebuild'
const VERSION = 3
const TASKS_STORE = 'tasks'
const GROUPS_STORE = 'groups'
const OCCURRENCES_STORE = 'occurrences'
const COLLECTIONS_STORE = 'collections'
const ENTRIES_STORE = 'collectionEntries'
const STORES = [TASKS_STORE, GROUPS_STORE, OCCURRENCES_STORE, COLLECTIONS_STORE, ENTRIES_STORE]
export const BACKUP_FORMAT = 'BASE_REBUILD_BACKUP'
export const BACKUP_VERSION = 3

export type AppData = { tasks: TaskItem[]; groups: GroupItem[]; occurrences: OccurrenceItem[]; collections: CollectionItem[]; collectionEntries: ListEntry[] }
export type Backup = AppData & {
  format: typeof BACKUP_FORMAT
  schemaVersion: typeof BACKUP_VERSION
  exportedAt: string
}

let connection: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (connection) return connection
  connection = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB не поддерживается в этом браузере.'))
      return
    }
    const request = indexedDB.open(DATABASE, VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      // Do not clear or rewrite the v0.3 tasks store during the upgrade.
      if (!database.objectStoreNames.contains(TASKS_STORE)) {
        const store = database.createObjectStore(TASKS_STORE, { keyPath: 'id' })
        store.createIndex('byDate', 'date')
      }
      if (!database.objectStoreNames.contains(GROUPS_STORE)) {
        const store = database.createObjectStore(GROUPS_STORE, { keyPath: 'id' })
        defaultGroups.forEach(group => store.put(group))
      }
      if (!database.objectStoreNames.contains(OCCURRENCES_STORE)) {
        const store = database.createObjectStore(OCCURRENCES_STORE, { keyPath: 'id' })
        store.createIndex('byDate', 'date')
      }
      if (!database.objectStoreNames.contains(COLLECTIONS_STORE)) {
        const store = database.createObjectStore(COLLECTIONS_STORE, { keyPath: 'id' })
        defaultCollections.forEach(collection => store.put(collection))
      }
      if (!database.objectStoreNames.contains(ENTRIES_STORE)) {
        const store = database.createObjectStore(ENTRIES_STORE, { keyPath: 'id' })
        store.createIndex('byCollection', 'collectionId')
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => { database.close(); connection = null }
      resolve(database)
    }
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть базу данных.'))
    request.onblocked = () => reject(new Error('Хранилище заблокировано другой открытой вкладкой BASE.'))
  }).catch(error => { connection = null; throw error })
  return connection
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Ошибка записи на устройстве.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Операция с данными была прервана.'))
  })
}

export async function readAllData(): Promise<AppData> {
  const database = await openDatabase()
  const transaction = database.transaction(STORES, 'readonly')
  const tasks = transaction.objectStore(TASKS_STORE).getAll()
  const groups = transaction.objectStore(GROUPS_STORE).getAll()
  const occurrences = transaction.objectStore(OCCURRENCES_STORE).getAll()
  const collections = transaction.objectStore(COLLECTIONS_STORE).getAll()
  const collectionEntries = transaction.objectStore(ENTRIES_STORE).getAll()
  await transactionDone(transaction)
  return {
    tasks: tasks.result as TaskItem[],
    groups: (groups.result as GroupItem[]).sort((a, b) => a.order - b.order),
    occurrences: occurrences.result as OccurrenceItem[],
    collections: (collections.result as CollectionItem[]).sort((a, b) => a.order - b.order),
    collectionEntries: collectionEntries.result as ListEntry[],
  }
}

async function putRecord(storeName: string, value: TaskItem | GroupItem | OccurrenceItem | CollectionItem | ListEntry) {
  const database = await openDatabase()
  const transaction = database.transaction(storeName, 'readwrite')
  transaction.objectStore(storeName).put(value)
  await transactionDone(transaction)
}

export async function writeTask(task: TaskItem): Promise<void> {
  await putRecord(TASKS_STORE, task)
}
export async function writeGroup(group: GroupItem): Promise<void> {
  await putRecord(GROUPS_STORE, group)
}
export async function writeOccurrence(occurrence: OccurrenceItem): Promise<void> {
  await putRecord(OCCURRENCES_STORE, occurrence)
}
export async function writeCollection(collection: CollectionItem): Promise<void> {
  await putRecord(COLLECTIONS_STORE, collection)
}
export async function writeCollectionEntry(entry: ListEntry): Promise<void> {
  await putRecord(ENTRIES_STORE, entry)
}

// Keep the planner and collection checkmarks in one commit. If a write fails, both roll back.
export async function writeLinkedTaskAndEntry(task: TaskItem, entry: ListEntry): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction([TASKS_STORE, ENTRIES_STORE], 'readwrite')
  transaction.objectStore(TASKS_STORE).put(task)
  transaction.objectStore(ENTRIES_STORE).put(entry)
  await transactionDone(transaction)
}
export async function writeEntryPair(first: ListEntry, second: ListEntry): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(ENTRIES_STORE, 'readwrite')
  transaction.objectStore(ENTRIES_STORE).put(first)
  transaction.objectStore(ENTRIES_STORE).put(second)
  await transactionDone(transaction)
}

export async function replaceAllData(data: AppData): Promise<void> {
  const database = await openDatabase()
  // One atomic transaction: failed imports never partly overwrite an existing planner.
  const transaction = database.transaction(STORES, 'readwrite')
  for (const name of STORES) transaction.objectStore(name).clear()
  for (const task of data.tasks) transaction.objectStore(TASKS_STORE).put(task)
  for (const group of data.groups) transaction.objectStore(GROUPS_STORE).put(group)
  for (const occurrence of data.occurrences) transaction.objectStore(OCCURRENCES_STORE).put(occurrence)
  for (const collection of data.collections) transaction.objectStore(COLLECTIONS_STORE).put(collection)
  for (const entry of data.collectionEntries) transaction.objectStore(ENTRIES_STORE).put(entry)
  await transactionDone(transaction)
}

export function createBackup(data: AppData): Backup {
  return { format: BACKUP_FORMAT, schemaVersion: BACKUP_VERSION, exportedAt: new Date().toISOString(), ...data }
}

const priorities = new Set<TaskPriority>(['low', 'normal', 'high'])
const repeats = new Set<RepeatRule>(['none', 'daily', 'weekdays', 'weekly', 'monthly'])

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value
}
function validIso(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}
function isGroup(value: unknown): value is GroupItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 128
    && typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 50
    && typeof item.emoji === 'string' && item.emoji.length <= 12
    && typeof item.note === 'string' && item.note.length <= 140
    && Number.isInteger(item.order) && (item.order as number) >= 0
    && (item.archived === undefined || typeof item.archived === 'boolean')
}
function isTask(value: unknown, groupIds: Set<string>): value is TaskItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 128
    && typeof item.group === 'string' && groupIds.has(item.group)
    && typeof item.text === 'string' && item.text.trim().length > 0 && item.text.length <= 140
    && validDate(item.date) && typeof item.done === 'boolean'
    && (item.time === null || (typeof item.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)))
    && typeof item.notes === 'string' && item.notes.length <= 4000
    && priorities.has(item.priority as TaskPriority)
    && validIso(item.createdAt) && validIso(item.updatedAt)
    && (item.completedAt === null || validIso(item.completedAt))
    && (item.deletedAt === null || validIso(item.deletedAt))
    && (item.repeat === undefined || repeats.has(item.repeat as RepeatRule))
    && (item.repeatUntil === undefined || item.repeatUntil === null || (validDate(item.repeatUntil) && item.repeatUntil >= item.date))
    && (item.collectionItemId === undefined || item.collectionItemId === null || (typeof item.collectionItemId === 'string' && item.collectionItemId.length > 0 && item.collectionItemId.length <= 128))
}
function isOccurrence(value: unknown, taskIds: Set<string>): value is OccurrenceItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.taskId === 'string' && taskIds.has(item.taskId)
    && validDate(item.date) && item.id === occurrenceId(item.taskId, item.date)
    && typeof item.done === 'boolean' && validIso(item.updatedAt)
    && (item.completedAt === null || validIso(item.completedAt))
}

function isCollection(value: unknown): value is CollectionItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 128
    && typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 70
    && typeof item.emoji === 'string' && item.emoji.length <= 16
    && typeof item.note === 'string' && item.note.length <= 200
    && Number.isInteger(item.order) && (item.order as number) >= 0
    && (item.archived === undefined || typeof item.archived === 'boolean')
}

function isEntry(value: unknown, collectionIds: Set<string>): value is ListEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 128
    && typeof item.collectionId === 'string' && collectionIds.has(item.collectionId)
    && typeof item.text === 'string' && item.text.trim().length > 0 && item.text.length <= 180
    && typeof item.note === 'string' && item.note.length <= 1000
    && Array.isArray(item.tags) && item.tags.length <= 12 && item.tags.every(tag => typeof tag === 'string' && tag.trim().length > 0 && tag.length <= 35)
    && typeof item.done === 'boolean' && Number.isInteger(item.order) && (item.order as number) >= 0
    && validIso(item.createdAt) && validIso(item.updatedAt)
    && (item.completedAt === null || validIso(item.completedAt))
    && (item.deletedAt === null || validIso(item.deletedAt))
}

export function parseBackup(input: unknown): AppData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Файл не является резервной копией BASE.')
  const data = input as Record<string, unknown>
  if (data.format !== BACKUP_FORMAT || (data.schemaVersion !== 1 && data.schemaVersion !== 2 && data.schemaVersion !== BACKUP_VERSION)) {
    throw new Error('Неподдерживаемый формат или версия резервной копии.')
  }
  if (!Array.isArray(data.tasks) || data.tasks.length > 30000) throw new Error('Некорректный список задач в резервной копии.')
  // v0.3 backup compatibility: leave its tasks untouched, supply standard groups.
  const importedGroups: GroupItem[] = data.schemaVersion === 1
    ? defaultGroups.map(group => ({ ...group }))
    : Array.isArray(data.groups) && data.groups.length > 0 && data.groups.length <= 300
      ? data.groups as GroupItem[] : []
  if (!importedGroups.length || !importedGroups.every(isGroup)) throw new Error('Некорректные группы в резервной копии.')
  const groupIds = new Set(importedGroups.map(group => group.id))
  if (groupIds.size !== importedGroups.length) throw new Error('Повторяются идентификаторы групп.')
  if (!data.tasks.every(task => isTask(task, groupIds))) throw new Error('В резервной копии есть повреждённые задачи.')
  const tasks = (data.tasks as TaskItem[]).map(task => ({ ...task, repeat: task.repeat ?? 'none', repeatUntil: task.repeatUntil ?? null }))
  const taskIds = new Set(tasks.map(task => task.id))
  if (taskIds.size !== tasks.length) throw new Error('Повторяются идентификаторы задач.')
  const importedOccurrences = data.schemaVersion === 1 ? [] : data.occurrences
  if (!Array.isArray(importedOccurrences) || importedOccurrences.length > 100000 || !importedOccurrences.every(item => isOccurrence(item, taskIds))) {
    throw new Error('В резервной копии есть повреждённые отметки повторов.')
  }
  const occurrences = importedOccurrences as OccurrenceItem[]
  if (new Set(occurrences.map(item => item.id)).size !== occurrences.length) throw new Error('Повторяются отметки выполнения.')
  const importedCollections = data.schemaVersion === 3 ? data.collections : defaultCollections.map(collection => ({ ...collection }))
  if (!Array.isArray(importedCollections) || importedCollections.length > 300 || !importedCollections.every(isCollection)) {
    throw new Error('Некорректные коллекции в резервной копии.')
  }
  const collections = importedCollections as CollectionItem[]
  const collectionIds = new Set(collections.map(item => item.id))
  if (collectionIds.size !== collections.length) throw new Error('Повторяются идентификаторы коллекций.')
  const importedEntries = data.schemaVersion === 3 ? data.collectionEntries : []
  if (!Array.isArray(importedEntries) || importedEntries.length > 50000 || !importedEntries.every(item => isEntry(item, collectionIds))) {
    throw new Error('Некорректные пункты коллекций в резервной копии.')
  }
  const collectionEntries = importedEntries as ListEntry[]
  const entryIds = new Set(collectionEntries.map(item => item.id))
  if (entryIds.size !== collectionEntries.length) throw new Error('Повторяются идентификаторы пунктов.')
  const linked = tasks.filter(task => task.collectionItemId)
  if (linked.some(task => !entryIds.has(task.collectionItemId!) || (task.repeat && task.repeat !== 'none'))
    || new Set(linked.filter(task => !task.deletedAt).map(task => task.collectionItemId)).size !== linked.filter(task => !task.deletedAt).length) {
    throw new Error('Нарушены связи между коллекциями и планером.')
  }
  return { tasks, groups: importedGroups, occurrences, collections, collectionEntries }
}
