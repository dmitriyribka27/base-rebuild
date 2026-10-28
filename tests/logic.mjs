import assert from 'node:assert/strict'
import { build } from 'esbuild'

async function importTypeScript(entry) {
  const { outputFiles } = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`)
}

const { matchesDate, scheduledForDate, periodDates, occurrenceId } = await importTypeScript('src/schedule.ts')
const { parseBackup, createBackup, BACKUP_FORMAT } = await importTypeScript('src/storage.ts')
const { collectionProgress, linkedTask, setEntryDone, setTaskDone, defaultCollections } = await importTypeScript('src/collections.ts')
const { emptyJournal, makeDailyReport, sleepHours } = await importTypeScript('src/journal.ts')
const { QUESTS, MAX_DAILY_XP, XP_PER_LEVEL, questRecordId, dailyQuestXp, completedQuestCount, hasCompletedQuest, experience, programDay } = await importTypeScript('src/rpg.ts')
const { trackerReadingId, readingsForReport, lightDay, recordedDays } = await importTypeScript('src/trackers.ts')
const { achievements } = await importTypeScript('src/achievements.ts')

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

const original = { tasks: [task('none')], groups: [{ id: 'work', name: 'Работа', emoji: '▦', note: '', order: 0 }], occurrences: [], collections: defaultCollections, collectionEntries: [], journals: [], dailyReports: [], taskMoves: [], questCompletions: [], trackers: [], trackerReadings: [], dayModes: [] }
const backup = createBackup(original)
assert.equal(backup.schemaVersion, 6)
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
assert.deepEqual(imported.journals, [])
assert.deepEqual(imported.questCompletions, [])
assert.deepEqual(imported.trackers, [])
assert.deepEqual(imported.trackerReadings, [])
assert.deepEqual(imported.dayModes, [])
const priorBackup = { ...backup, schemaVersion: 2, collections: undefined, collectionEntries: undefined }
assert.equal(parseBackup(priorBackup).collections.length, 7)
assert.deepEqual(parseBackup(priorBackup).tasks, original.tasks)
assert.deepEqual(parseBackup({ ...backup, schemaVersion: 3, journals: undefined, dailyReports: undefined, taskMoves: undefined }).journals, [])
assert.deepEqual(parseBackup({ ...backup, schemaVersion: 4, questCompletions: undefined }).questCompletions, [])
assert.deepEqual(parseBackup({ ...backup, schemaVersion: 5, trackers: undefined, trackerReadings: undefined, dayModes: undefined }), original)
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

assert.equal(sleepHours('02:00', '08:00'), 6)
assert.equal(sleepHours('23:30', '07:00'), 7.5)
assert.equal(sleepHours(null, '08:00'), null)
assert.equal(sleepHours('08:00', '08:00'), null)
const journal = { ...emptyJournal(date), sleepAt: '02:00', wakeAt: '08:00', energy: 2, mood: 6, cigarettes: 0,
  workEvents: 'Созвонился с поставщиком', familyEvents: 'Ужин с Беллой' }
const movedTask = task('none', { id: 'moved-task', text: 'Отправить письмо', date: '2026-10-30' })
const moved = { id: 'move-1', taskId: movedTask.id, taskTitle: movedTask.text, fromDate: date, toDate: '2026-10-30', movedAt: timestamp }
const reportText = makeDailyReport({ date, journal, tasks: [task('none', { id: 'done-task', text: 'Согласовал', done: true }),
  task('none', { id: 'pending-task', text: 'Проверить документы' }), movedTask], groups: original.groups, occurrences: [], taskMoves: [moved], questCompletions: [], comment: '' })
assert.match(reportText, /Сон: 02:00–08:00 \(6 ч/)
assert.match(reportText, /Курение: 0 сигарет/)
assert.match(reportText, /ВЫПОЛНЕНО\n- \[Работа\] Согласовал/)
assert.match(reportText, /НЕ ВЫПОЛНЕНО\n- \[Работа\] Проверить документы/)
assert.match(reportText, /ПЕРЕНЕСЕНО\n- Отправить письмо → 30 окт/)
assert.match(reportText, /МОИ МЫСЛИ\nне указано/)
assert.match(reportText, /XP за день: 0/)
assert.match(reportText, /Уровень: LVL 01 — Пробуждение/)
assert.doesNotMatch(reportText.split('НЕ ВЫПОЛНЕНО')[0], /Проверить документы/)
const journalBackup = createBackup({ ...original, tasks: [movedTask], journals: [journal], dailyReports: [{ date, comment: '', completedAt: timestamp, updatedAt: timestamp }], taskMoves: [moved] })
assert.deepEqual(parseBackup(journalBackup).journals[0], journal)
assert.equal(parseBackup(journalBackup).taskMoves[0].toDate, '2026-10-30')
assert.throws(() => parseBackup({ ...journalBackup, journals: [{ ...journal, cigarettes: -1 }] }), /дневника/)
assert.throws(() => parseBackup({ ...journalBackup, taskMoves: [{ ...moved, taskId: 'unknown' }] }), /переносов/)

// A unique date + quest id is the only source of XP. Normal planner tasks give none.
assert.equal(MAX_DAILY_XP, 100)
assert.equal(XP_PER_LEVEL, 700)
assert.equal(QUESTS.length, 7)
assert.equal(experience([]).totalXp, 0)
const questDay = '2026-10-29'
const questRecord = (quest, date = questDay) => ({
  id: questRecordId(date, quest.id), questId: quest.id, date, done: true, completedAt: timestamp, updatedAt: timestamp,
})
const allQuests = QUESTS.map(quest => questRecord(quest))
assert.equal(dailyQuestXp(allQuests, questDay), 100)
assert.equal(completedQuestCount(allQuests, questDay), 7)
assert.equal(hasCompletedQuest(allQuests, questDay, 'word'), true)
assert.equal(experience(allQuests).byCharacteristic.reliability, 45)
assert.equal(experience(allQuests).byCharacteristic.finances, 0)
assert.equal(experience(allQuests).totalXp, 100)
// Newer uncheck replaces a formerly awarded quest. A repeated old click cannot inflate XP.
const reversed = { ...allQuests[0], done: false, completedAt: null, updatedAt: '2026-10-30T12:00:00.000Z' }
assert.equal(dailyQuestXp([...allQuests, allQuests[0]], questDay), 100)
assert.equal(dailyQuestXp([...allQuests, reversed], questDay), 75)
assert.equal(hasCompletedQuest([...allQuests, reversed], questDay, 'word'), false)
const weekRecords = Array.from({ length: 7 }, (_, index) => {
  const nextDate = new Date(Date.UTC(2026, 9, 23 + index)).toISOString().slice(0, 10)
  return QUESTS.map(quest => questRecord(quest, nextDate))
}).flat()
assert.equal(experience(weekRecords).totalXp, 700)
assert.equal(experience(weekRecords).level, 2)
assert.equal(experience(weekRecords).levelXp, 0)
assert.equal(experience(weekRecords, '2026-10-23').totalXp, 100)
assert.equal(programDay('2026-10-22'), 0)
assert.equal(programDay('2026-10-23'), 1)
assert.equal(programDay('2027-01-20'), 90)
assert.equal(programDay('2027-01-23'), 90)
const withQuests = createBackup({ ...original, questCompletions: allQuests })
assert.deepEqual(parseBackup(withQuests).questCompletions, allQuests)
assert.throws(() => parseBackup({ ...withQuests, questCompletions: [allQuests[0], allQuests[0]] }), /RPG/)
assert.throws(() => parseBackup({ ...withQuests, questCompletions: [{ ...allQuests[0], questId: 'invalid' }] }), /RPG/)
const xpReport = makeDailyReport({ date: questDay, journal, tasks: [], groups: original.groups, occurrences: [], taskMoves: [], questCompletions: allQuests, comment: '' })
assert.match(xpReport, /XP за день: 100/)
assert.match(xpReport, /Общий XP на эту дату: 100/)
assert.match(xpReport, /ЕЖЕДНЕВНЫЕ КВЕСТЫ\n- Слово = действие \(\+25 XP\)/)

// 0.9 trackers: absent !== explicit 0 !== explicit No. Archiving doesn't erase readings.
const tracker = (id, type, unit = '') => ({ id, title: id, type, unit, order: 0, archived: false, createdAt: timestamp, updatedAt: timestamp })
const definitions = [tracker('exercise', 'boolean'), tracker('water', 'number', 'стаканов'), tracker('wellbeing', 'scale')]
const reading = (id, value) => ({ id: trackerReadingId(date, id), date, trackerId: id, value, updatedAt: timestamp })
const readings = [reading('exercise', false), reading('water', 0), reading('wellbeing', null)]
assert.deepEqual(readingsForReport(definitions, readings, date), ['exercise: нет', 'water: 0 стаканов'])
assert.equal(recordedDays(readings), 1)
assert.equal(readingsForReport(definitions, [], date).length, 0)
const modes = [{ date, light: true, updatedAt: timestamp }]
assert.equal(lightDay(modes, date), true)
assert.equal(lightDay(modes, '2026-10-28'), false)
assert.equal(experience(allQuests).totalXp, experience(allQuests).totalXp)
const trackerBackup = createBackup({ ...original, trackers: definitions, trackerReadings: readings, dayModes: modes })
assert.deepEqual(parseBackup(trackerBackup).trackers, definitions)
assert.deepEqual(parseBackup(trackerBackup).trackerReadings, readings)
assert.deepEqual(parseBackup(trackerBackup).dayModes, modes)
assert.deepEqual(parseBackup({ ...trackerBackup, trackers: definitions.map(row => ({ ...row, archived: true })) }).trackerReadings, readings)
assert.throws(() => parseBackup({ ...trackerBackup, trackerReadings: [...readings, reading('exercise', true)] }), /трекеров/)
assert.throws(() => parseBackup({ ...trackerBackup, trackerReadings: [reading('missing', 1)] }), /трекеров/)
assert.throws(() => parseBackup({ ...trackerBackup, trackerReadings: [reading('wellbeing', 0)] }), /трекеров/)
assert.throws(() => parseBackup({ ...trackerBackup, trackerReadings: [reading('exercise', 0)] }), /трекеров/)
assert.throws(() => parseBackup({ ...trackerBackup, dayModes: [modes[0], modes[0]] }), /дней/)
const trackerReport = makeDailyReport({ date, journal, tasks: [], groups: original.groups, occurrences: [], taskMoves: [], questCompletions: allQuests, trackers: definitions, trackerReadings: readings, dayModes: modes, comment: '' })
assert.match(trackerReport, /Режим дня: облегчённый/)
assert.match(trackerReport, /ТРЕКЕРЫ\n- exercise: нет\n- water: 0 стаканов/)
const badges = achievements({ quests: allQuests, reports: [], readings, dayModes: modes })
assert.equal(badges.filter(badge => badge.unlocked).length, 4)
assert.equal(badges.find(badge => badge.id === 'firstReport').unlocked, false)
assert.equal(achievements({ quests: [], reports: [], readings: [], dayModes: [] }).filter(badge => badge.unlocked).length, 0)

console.log('PASS: recurrence, collection links, RPG quests/levels, journal/report accuracy, task moves, tracker zero/false/light days, achievements, JSON v1-v6 migration and invalid data')
