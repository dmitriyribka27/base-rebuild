import { defaultGroups, type GroupItem, type OccurrenceItem, type RepeatRule, type TaskItem, type TaskPriority } from './demo'
import { defaultCollections, type CollectionItem, type ListEntry } from './collections'
import type { DailyReport, JournalEntry, TaskMove } from './journal'
import { QUESTS, questRecordId, type QuestCompletion } from './rpg'
import { occurrenceId } from './schedule'
import { trackerReadingId, type TrackerDefinition, type TrackerReading, type DayMode } from './trackers'

const DATABASE = 'base-rebuild'
const VERSION = 6
const TASKS_STORE = 'tasks'
const GROUPS_STORE = 'groups'
const OCCURRENCES_STORE = 'occurrences'
const COLLECTIONS_STORE = 'collections'
const ENTRIES_STORE = 'collectionEntries'
const JOURNAL_STORE = 'journals'
const REPORT_STORE = 'dailyReports'
const MOVES_STORE = 'taskMoves'
const QUESTS_STORE = 'questCompletions'
const TRACKERS_STORE = 'trackers'
const READINGS_STORE = 'trackerReadings'
const DAY_MODES_STORE = 'dayModes'
const STORES = [TASKS_STORE, GROUPS_STORE, OCCURRENCES_STORE, COLLECTIONS_STORE, ENTRIES_STORE, JOURNAL_STORE, REPORT_STORE, MOVES_STORE, QUESTS_STORE, TRACKERS_STORE, READINGS_STORE, DAY_MODES_STORE]
export const BACKUP_FORMAT = 'BASE_REBUILD_BACKUP'
export const BACKUP_VERSION = 6

export type AppData = {
  tasks: TaskItem[]; groups: GroupItem[]; occurrences: OccurrenceItem[]
  collections: CollectionItem[]; collectionEntries: ListEntry[]
  journals: JournalEntry[]; dailyReports: DailyReport[]; taskMoves: TaskMove[]
  questCompletions: QuestCompletion[]
  trackers: TrackerDefinition[]; trackerReadings: TrackerReading[]; dayModes: DayMode[]
}
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
      if (!database.objectStoreNames.contains(JOURNAL_STORE)) database.createObjectStore(JOURNAL_STORE, { keyPath: 'date' })
      if (!database.objectStoreNames.contains(REPORT_STORE)) database.createObjectStore(REPORT_STORE, { keyPath: 'date' })
      if (!database.objectStoreNames.contains(MOVES_STORE)) {
        const store = database.createObjectStore(MOVES_STORE, { keyPath: 'id' })
        store.createIndex('byFromDate', 'fromDate')
      }
      if (!database.objectStoreNames.contains(QUESTS_STORE)) {
        const store = database.createObjectStore(QUESTS_STORE, { keyPath: 'id' })
        store.createIndex('byDate', 'date')
      }
      if (!database.objectStoreNames.contains(TRACKERS_STORE)) database.createObjectStore(TRACKERS_STORE, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(READINGS_STORE)) {
        const store = database.createObjectStore(READINGS_STORE, { keyPath: 'id' })
        store.createIndex('byDate', 'date')
      }
      if (!database.objectStoreNames.contains(DAY_MODES_STORE)) database.createObjectStore(DAY_MODES_STORE, { keyPath: 'date' })
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
  const journals = transaction.objectStore(JOURNAL_STORE).getAll()
  const dailyReports = transaction.objectStore(REPORT_STORE).getAll()
  const taskMoves = transaction.objectStore(MOVES_STORE).getAll()
  const questCompletions = transaction.objectStore(QUESTS_STORE).getAll()
  const trackers = transaction.objectStore(TRACKERS_STORE).getAll()
  const trackerReadings = transaction.objectStore(READINGS_STORE).getAll()
  const dayModes = transaction.objectStore(DAY_MODES_STORE).getAll()
  await transactionDone(transaction)
  return {
    tasks: tasks.result as TaskItem[],
    groups: (groups.result as GroupItem[]).sort((a, b) => a.order - b.order),
    occurrences: occurrences.result as OccurrenceItem[],
    collections: (collections.result as CollectionItem[]).sort((a, b) => a.order - b.order),
    collectionEntries: collectionEntries.result as ListEntry[],
    journals: journals.result as JournalEntry[],
    dailyReports: dailyReports.result as DailyReport[],
    taskMoves: taskMoves.result as TaskMove[],
    questCompletions: questCompletions.result as QuestCompletion[],
    trackers: (trackers.result as TrackerDefinition[]).sort((a, b) => a.order - b.order),
    trackerReadings: trackerReadings.result as TrackerReading[],
    dayModes: dayModes.result as DayMode[],
  }
}

async function putRecord(storeName: string, value: TaskItem | GroupItem | OccurrenceItem | CollectionItem | ListEntry | JournalEntry | DailyReport | TaskMove | QuestCompletion | TrackerDefinition | TrackerReading | DayMode) {
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
export async function writeJournal(entry: JournalEntry): Promise<void> {
  await putRecord(JOURNAL_STORE, entry)
}
export async function writeDailyReport(report: DailyReport): Promise<void> {
  await putRecord(REPORT_STORE, report)
}
export async function writeQuestCompletion(completion: QuestCompletion): Promise<void> {
  await putRecord(QUESTS_STORE, completion)
}
export async function writeTracker(tracker: TrackerDefinition): Promise<void> { await putRecord(TRACKERS_STORE, tracker) }
export async function writeTrackerReading(reading: TrackerReading): Promise<void> { await putRecord(READINGS_STORE, reading) }
export async function writeDayMode(mode: DayMode): Promise<void> { await putRecord(DAY_MODES_STORE, mode) }
export async function writeTaskAndMove(task: TaskItem, move: TaskMove): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction([TASKS_STORE, MOVES_STORE], 'readwrite')
  transaction.objectStore(TASKS_STORE).put(task)
  transaction.objectStore(MOVES_STORE).put(move)
  await transactionDone(transaction)
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
  for (const entry of data.journals) transaction.objectStore(JOURNAL_STORE).put(entry)
  for (const report of data.dailyReports) transaction.objectStore(REPORT_STORE).put(report)
  for (const move of data.taskMoves) transaction.objectStore(MOVES_STORE).put(move)
  for (const completion of data.questCompletions) transaction.objectStore(QUESTS_STORE).put(completion)
  for (const tracker of data.trackers) transaction.objectStore(TRACKERS_STORE).put(tracker)
  for (const reading of data.trackerReadings) transaction.objectStore(READINGS_STORE).put(reading)
  for (const mode of data.dayModes) transaction.objectStore(DAY_MODES_STORE).put(mode)
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
    && (item.kind === undefined || item.kind === 'task' || item.kind === 'payment')
    && (item.payment === undefined || item.payment === null || (typeof item.payment === 'object' && !Array.isArray(item.payment)
      && Number.isFinite((item.payment as Record<string, unknown>).amount)
      && ((item.payment as Record<string, unknown>).amount as number) > 0
      && ((item.payment as Record<string, unknown>).amount as number) <= 1_000_000_000
      && Math.round(((item.payment as Record<string, unknown>).amount as number) * 100) / 100 === (item.payment as Record<string, unknown>).amount
      && ['GEL', 'USD', 'RUB'].includes((item.payment as Record<string, unknown>).currency as string)))
    && (item.kind !== 'payment' || (item.payment !== undefined && item.payment !== null))
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

function validClock(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value))
}
function validScore(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 10)
}
function isJournal(value: unknown): value is JournalEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return validDate(item.date) && validClock(item.sleepAt) && validClock(item.wakeAt)
    && validScore(item.energy) && validScore(item.mood)
    && (item.cigarettes === null || (Number.isInteger(item.cigarettes) && (item.cigarettes as number) >= 0 && (item.cigarettes as number) <= 999))
    && ['activity', 'thoughts', 'goodEvents', 'difficulties', 'conclusions', 'tomorrowPlans', 'workEvents', 'familyEvents', 'financeNotes']
      .every(field => typeof item[field] === 'string' && (item[field] as string).length <= 12000)
    && validIso(item.updatedAt)
}
function isReport(value: unknown): value is DailyReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return validDate(item.date) && validIso(item.completedAt) && validIso(item.updatedAt)
    && typeof item.comment === 'string' && item.comment.length <= 12000
}
function isMove(value: unknown, taskIds: Set<string>): value is TaskMove {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 128
    && typeof item.taskId === 'string' && taskIds.has(item.taskId)
    && typeof item.taskTitle === 'string' && item.taskTitle.length > 0 && item.taskTitle.length <= 180
    && validDate(item.fromDate) && validDate(item.toDate) && item.fromDate !== item.toDate
    && validIso(item.movedAt)
}

const questIds = new Set<string>(QUESTS.map(quest => quest.id))
function isQuestCompletion(value: unknown): value is QuestCompletion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return validDate(item.date) && typeof item.questId === 'string' && questIds.has(item.questId)
    && item.id === questRecordId(item.date as string, item.questId as QuestCompletion['questId'])
    && typeof item.done === 'boolean' && validIso(item.updatedAt)
    && (item.done ? validIso(item.completedAt) : item.completedAt === null)
}
function isTracker(value: unknown): value is TrackerDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 128
    && typeof item.title === 'string' && item.title.trim().length > 0 && item.title.length <= 70
    && ['boolean', 'number', 'scale'].includes(item.type as string)
    && typeof item.unit === 'string' && item.unit.length <= 20
    && Number.isInteger(item.order) && (item.order as number) >= 0
    && typeof item.archived === 'boolean' && validIso(item.createdAt) && validIso(item.updatedAt)
}
function isTrackerReading(value: unknown, trackerIds: Set<string>, trackerTypes: Map<string, TrackerDefinition['type']>): value is TrackerReading {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  const type = trackerTypes.get(item.trackerId as string)
  const validValue = item.value === null || (type === 'boolean' ? typeof item.value === 'boolean'
    : type === 'scale' ? Number.isInteger(item.value) && (item.value as number) >= 1 && (item.value as number) <= 10
    : type === 'number' ? typeof item.value === 'number' && Number.isFinite(item.value) && (item.value as number) >= 0 && (item.value as number) <= 1_000_000_000 : false)
  return typeof item.trackerId === 'string' && trackerIds.has(item.trackerId)
    && validDate(item.date) && item.id === trackerReadingId(item.date as string, item.trackerId)
    && validValue && validIso(item.updatedAt)
}
function isDayMode(value: unknown): value is DayMode {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return validDate(item.date) && typeof item.light === 'boolean' && validIso(item.updatedAt)
}

export function parseBackup(input: unknown): AppData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Файл не является резервной копией BASE.')
  const data = input as Record<string, unknown>
  if (data.format !== BACKUP_FORMAT || ![1, 2, 3, 4, 5, BACKUP_VERSION].includes(data.schemaVersion as number)) {
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
  const importedCollections = (data.schemaVersion as number) >= 3 ? data.collections : defaultCollections.map(collection => ({ ...collection }))
  if (!Array.isArray(importedCollections) || importedCollections.length > 300 || !importedCollections.every(isCollection)) {
    throw new Error('Некорректные коллекции в резервной копии.')
  }
  const collections = importedCollections as CollectionItem[]
  const collectionIds = new Set(collections.map(item => item.id))
  if (collectionIds.size !== collections.length) throw new Error('Повторяются идентификаторы коллекций.')
  const importedEntries = (data.schemaVersion as number) >= 3 ? data.collectionEntries : []
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
  const importedJournals = (data.schemaVersion as number) >= 4 ? data.journals : []
  const importedReports = (data.schemaVersion as number) >= 4 ? data.dailyReports : []
  const importedMoves = (data.schemaVersion as number) >= 4 ? data.taskMoves : []
  if (!Array.isArray(importedJournals) || importedJournals.length > 40000 || !importedJournals.every(isJournal)
    || new Set(importedJournals.map(item => item.date)).size !== importedJournals.length) throw new Error('Некорректные записи дневника.')
  if (!Array.isArray(importedReports) || importedReports.length > 40000 || !importedReports.every(isReport)
    || new Set(importedReports.map(item => item.date)).size !== importedReports.length) throw new Error('Некорректная история отчётов.')
  if (!Array.isArray(importedMoves) || importedMoves.length > 100000 || !importedMoves.every(item => isMove(item, taskIds))
    || new Set(importedMoves.map(item => item.id)).size !== importedMoves.length) throw new Error('Некорректная история переносов.')
  const importedQuests = (data.schemaVersion as number) >= 5 ? data.questCompletions : []
  if (!Array.isArray(importedQuests) || importedQuests.length > 400000 || !importedQuests.every(isQuestCompletion)
    || new Set(importedQuests.map(item => item.id)).size !== importedQuests.length) throw new Error('Некорректные отметки RPG-квестов.')
  const importedTrackers = data.schemaVersion === BACKUP_VERSION ? data.trackers : []
  if (!Array.isArray(importedTrackers) || importedTrackers.length > 500 || !importedTrackers.every(isTracker)
    || new Set(importedTrackers.map(item => item.id)).size !== importedTrackers.length) throw new Error('Некорректные определения трекеров.')
  const trackerIds = new Set((importedTrackers as TrackerDefinition[]).map(item => item.id))
  const types = new Map((importedTrackers as TrackerDefinition[]).map(item => [item.id, item.type]))
  const importedReadings = data.schemaVersion === BACKUP_VERSION ? data.trackerReadings : []
  if (!Array.isArray(importedReadings) || importedReadings.length > 400000 || !importedReadings.every(item => isTrackerReading(item, trackerIds, types))
    || new Set(importedReadings.map(item => item.id)).size !== importedReadings.length) throw new Error('Некорректные значения трекеров.')
  const importedModes = data.schemaVersion === BACKUP_VERSION ? data.dayModes : []
  if (!Array.isArray(importedModes) || importedModes.length > 40000 || !importedModes.every(isDayMode)
    || new Set(importedModes.map(item => item.date)).size !== importedModes.length) throw new Error('Некорректные режимы дней.')
  return { tasks, groups: importedGroups, occurrences, collections, collectionEntries,
    journals: importedJournals as JournalEntry[], dailyReports: importedReports as DailyReport[], taskMoves: importedMoves as TaskMove[],
    questCompletions: importedQuests as QuestCompletion[],
    trackers: importedTrackers as TrackerDefinition[], trackerReadings: importedReadings as TrackerReading[], dayModes: importedModes as DayMode[] }
}
