import assert from 'node:assert/strict'
import { build } from 'esbuild'

async function importTypeScript(entry) {
  const { outputFiles } = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`)
}

const { matchesDate, scheduledForDate, periodDates, occurrenceId } = await importTypeScript('src/schedule.ts')
const { parseBackup, createBackup, BACKUP_FORMAT } = await importTypeScript('src/storage.ts')

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

const original = { tasks: [task('none')], groups: [{ id: 'work', name: 'Работа', emoji: '▦', note: '', order: 0 }], occurrences: [] }
const backup = createBackup(original)
assert.equal(backup.schemaVersion, 2)
assert.deepEqual(parseBackup(backup), original)

const legacyTask = task('none')
delete legacyTask.repeat
delete legacyTask.repeatUntil
const imported = parseBackup({ format: BACKUP_FORMAT, schemaVersion: 1, exportedAt: new Date().toISOString(), tasks: [legacyTask] })
assert.equal(imported.tasks[0].repeat, 'none')
assert.equal(imported.groups.length, 8)
assert.deepEqual(imported.occurrences, [])
assert.throws(() => parseBackup({ ...backup, tasks: [task('daily', { group: 'nonexistent' })] }))
assert.throws(() => parseBackup({ ...backup, occurrences: [{ ...occurrence, taskId: 'missing' }] }))

console.log('PASS: recurrence, independent completion, date ranges, JSON v1/v2 compatibility and invalid data')
