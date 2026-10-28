import assert from 'node:assert/strict'
import { build } from 'esbuild'

async function load(file) {
  const { outputFiles } = await build({ entryPoints: [file], bundle: true, format: 'esm', platform: 'node', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`)
}

const { scheduledForDate, occurrenceId } = await load('src/schedule.ts')
const { checkedSubtasks, toggleSubtask, durationLabel } = await load('src/taskDetails.ts')
const { createBackup, parseBackup } = await load('src/storage.ts')
const { defaultCollections } = await load('src/collections.ts')
const stamp = '2026-10-28T09:00:00.000Z'
const parts = [{ id: 'step-one', text: 'Первый шаг' }, { id: 'step-two', text: 'Второй шаг' }]
const parent = {
  id: 'card-1', group: 'custom', text: 'Составная задача', date: '2026-10-28',
  done: false, time: '10:30', endTime: '11:30', notes: '', subtasks: parts, subtaskDoneIds: [],
  priority: 'normal', repeat: 'none', repeatUntil: null, createdAt: stamp, updatedAt: stamp,
  completedAt: null, deletedAt: null, kind: 'task', payment: null,
}
assert.equal(durationLabel('10:30', '11:30'), '1 ч')
assert.equal(durationLabel('11:30', '11:45'), '15 мин')
assert.equal(durationLabel('15:00', '14:30'), null)
assert.deepEqual(checkedSubtasks(parent, false), [])
const once = toggleSubtask(parent, [], 'step-one')
assert.deepEqual(once, { subtaskDoneIds: ['step-one'], done: false })
const twice = toggleSubtask(parent, once.subtaskDoneIds, 'step-two')
assert.deepEqual(twice, { subtaskDoneIds: ['step-one', 'step-two'], done: true })
assert.deepEqual(toggleSubtask(parent, twice.subtaskDoneIds, 'step-one'), { subtaskDoneIds: ['step-two'], done: false })
assert.throws(() => toggleSubtask(parent, [], 'missing'), /не найдена/)

const single = { ...parent, subtaskDoneIds: once.subtaskDoneIds }
assert.deepEqual(scheduledForDate([single], [], '2026-10-28')[0].checkedSubtaskIds, ['step-one'])
const repeated = { ...parent, repeat: 'daily' }
const occurrence = { id: occurrenceId(repeated.id, '2026-10-28'), taskId: repeated.id, date: '2026-10-28',
  done: false, subtaskDoneIds: once.subtaskDoneIds, completedAt: null, updatedAt: stamp }
assert.deepEqual(scheduledForDate([repeated], [occurrence], '2026-10-28')[0].checkedSubtaskIds, ['step-one'])
assert.deepEqual(scheduledForDate([repeated], [occurrence], '2026-10-29')[0].checkedSubtaskIds, [])
assert.deepEqual(scheduledForDate([repeated], [{ ...occurrence, done: true, subtaskDoneIds: undefined }], '2026-10-28')[0].checkedSubtaskIds, ['step-one', 'step-two'])

const data = { tasks: [repeated], groups: [{ id: 'custom', name: 'Моя категория', emoji: '✳', note: '', order: 0 }],
  occurrences: [occurrence], collections: defaultCollections, collectionEntries: [], journals: [],
  dailyReports: [], taskMoves: [], questCompletions: [], trackers: [], trackerReadings: [], dayModes: [] }
assert.deepEqual(parseBackup(createBackup(data)), data)
assert.throws(() => parseBackup(createBackup({ ...data, tasks: [{ ...repeated, subtasks: [{ id: 'step-one', text: '' }] }] })), /задачи/)
assert.throws(() => parseBackup(createBackup({ ...data, tasks: [{ ...repeated, endTime: '09:30' }] })), /задачи/)
assert.throws(() => parseBackup(createBackup({ ...data, occurrences: [{ ...occurrence, subtaskDoneIds: ['unknown'] }] })), /отметки/)
console.log('PASS: task cards, time range, subtasks, recurring day isolation, backup compatibility')
