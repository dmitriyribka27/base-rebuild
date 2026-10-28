import assert from 'node:assert/strict'
import { build } from 'esbuild'

async function importTypeScript(entry) {
  const { outputFiles } = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`)
}

const { matchesDate, scheduledForDate, periodDates, occurrenceId } = await importTypeScript('src/schedule.ts')
const { parseBackup, createBackup, BACKUP_FORMAT } = await importTypeScript('src/storage.ts')
const { collectionProgress, linkedTask, setEntryDone, setTaskDone, defaultCollections } = await importTypeScript('src/collections.ts')

const date = '2026-10-29'
const task = (repeat, overrides = {}) => ({
  id: `task-${repeat}`, text: 'Проверка', group: 'work', date,
  done: false, time: null, notes: '', priority: 'normal',
  createdAt: '2026-10-28T12:00:00.000Z', updatedAt: '2026-10-28T12:00:00.000Z',
  completedAt: null, deletedAt: null, repeat, repeatUntil: null, ...overrides,
})

assert.equal(matchesDate(task('none'), date), true)
assert.equal(matchesDate(task('none'), '2026-10-30'), false)
assert.equal(matchesDate(task('daily'), '2026-10-31'), true)
assert.equal(matchesDate(task('daily'), '2026-10-28'), false)
assert.equal(matchesDate(task('daily', { repeatUntil: '2026-10-31' }), '2026-11-01'), false)
assert.equal(matchesDate(task('weekdays'), '2026-10-30'), true)
assert.equal(matchesDate(task('weekdays'), '2026-10-31'), false)
assert.equal(matchesDate(task('weekly'), '2026-11-05'), true)
assert.equal(matchesDate(task('weekly'), '2026-11-06'), false)
assert.equal(matchesDate(task('monthly'), '2026-11-29'), true)
assert.equal(matchesDate(task('monthly'), '2026-11-28'), false)
assert.equal(matchesDate(task('monthly', { date: '2026-10-31' }), '2026-11-30'), false)
assert.equal(matchesDate(task('daily', { deletedAt: '2026-10-28T12:00:00.000Z' }), date), false)

const repeatTask = task('daily')
const occurrence = { id: occurrenceId(repeatTask.id, date), taskId: repeatTask.id, date,
  done: true, completedAt: '2026-10-29T12:00:00.000Z', updatedAt: '2026-10-29T12:00:00.000Z' }
assert.equal(scheduledForDate([repeatTask], [occurrence], date)[0].done, true)
assert.equal(scheduledForDate([repeatTask], [occurrence], '2026-10-30')[0].done, false)
assert.equal(periodDates(date, 'week').length, 7)
assert.equal(periodDates(date, 'month').length, 31)
assert.equal(periodDates('2027-02-05', 'month').length, 28)

const original = { tasks: [task('none')], groups: [{ id: 'work', name: 'Работа', emoji: '▦', note: '', order: 0 }], occurrences: [], collections: defaultCollections, collectionEntries: [] }
const backup = createBackup(original)
assert.equal(backup.schemaVersion, 3)
assert.deepEqual(parseBackup(backup), original)

const legacyTask = task('none')
delete legacyTask.repeat
delete legacyTask.repeatUntil
const imported = parseBackup({ format: BACKUP_FORMAT, schemaVersion: 1, exportedAt: new Date().toISOString(), tasks: [legacyTask] })
assert.equal(imported.tasks[0].repeat, 'none')
assert.equal(imported.groups.length, 8)
assert.deepEqual(imported.occurrences, [])
assert.equal(imported.collections.length, 7)
assert.deepEqual(imported.collectionEntries, [])
const priorBackup = { ...backup, schemaVersion: 2, collections: undefined, collectionEntries: undefined }
assert.equal(parseBackup(priorBackup).collections.length, 7)
assert.deepEqual(parseBackup(priorBackup).tasks, original.tasks)
assert.throws(() => parseBackup({ ...backup, tasks: [task('daily', { group: 'nonexistent' })] }))
assert.throws(() => parseBackup({ ...backup, occurrences: [{ ...occurrence, taskId: 'missing' }] }))

const timestamp = '2026-10-29T12:00:00.000Z'
const item = { id: 'film-1', collectionId: 'movies', text: 'Остров проклятых', note: '', tags: ['вместе', 'триллер'],
  done: false, order: 0, createdAt: timestamp, updatedAt: timestamp, completedAt: null, deletedAt: null }
const linked = task('none', { collectionItemId: item.id })
const linkedBackup = createBackup({ ...original, tasks: [linked], collectionEntries: [item] })
assert.equal(parseBackup(linkedBackup).tasks[0].collectionItemId, item.id)
assert.equal(linkedTask([linked], item.id)?.id, linked.id)
assert.equal(linkedTask([{ ...linked, deletedAt: timestamp }], item.id), undefined)
assert.deepEqual(collectionProgress([item], 'movies'), { done: 0, total: 1, percent: 0 })
const doneEntry = setEntryDone(item, true, timestamp)
const doneTask = setTaskDone(linked, true, timestamp)
assert.equal(doneEntry.completedAt, timestamp)
assert.equal(doneTask.completedAt, timestamp)
assert.deepEqual(collectionProgress([doneEntry], 'movies'), { done: 1, total: 1, percent: 100 })
assert.deepEqual(collectionProgress([{ ...doneEntry, deletedAt: timestamp }], 'movies'), { done: 0, total: 0, percent: 0 })
assert.equal(setEntryDone(doneEntry, false, timestamp).completedAt, null)
assert.throws(() => parseBackup({ ...linkedBackup, collectionEntries: [] }), /связи/)
assert.throws(() => parseBackup({ ...linkedBackup, tasks: [linked, { ...linked, id: 'film-dup' }] }), /связи/)
assert.throws(() => parseBackup({ ...linkedBackup, collectionEntries: [{ ...item, tags: 123 }] }), /пункты/)

console.log('PASS: recurrence, collection links and progress, date ranges, JSON v1/v2/v3 compatibility and invalid data')
