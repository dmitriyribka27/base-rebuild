import { localDate, shiftDay, type GroupItem, type OccurrenceItem, type TaskItem } from './demo'
import { scheduledForDate } from './schedule'
import { paymentLabel } from './payments'
import { QUESTS, dailyQuestXp, experience, hasCompletedQuest, type QuestCompletion } from './rpg'
import { lightDay, readingsForReport, type TrackerDefinition, type TrackerReading, type DayMode } from './trackers'

export type JournalEntry = {
  date: string
  sleepAt: string | null
  wakeAt: string | null
  energy: number | null
  mood: number | null
  cigarettes: number | null
  activity: string
  thoughts: string
  goodEvents: string
  difficulties: string
  conclusions: string
  tomorrowPlans: string
  workEvents: string
  familyEvents: string
  financeNotes: string
  updatedAt: string
}

export type DailyReport = { date: string; completedAt: string; comment: string; updatedAt: string }
export type TaskMove = { id: string; taskId: string; taskTitle: string; fromDate: string; toDate: string; movedAt: string }

export const REPORT_REQUEST = 'Проанализируй мой день с учётом проекта BASE: REBUILD и предыдущего контекста. Оцени выполнение обязательств, состояние, распределение сил и реальные результаты. Укажи ошибки без лести и самоунижения. Предложи конкретные изменения на завтра, учитывая мой ненормированный график, сон и доступную энергию. Не придумывай отсутствующие данные.'

export function emptyJournal(date: string): JournalEntry {
  return { date, sleepAt: null, wakeAt: null, energy: null, mood: null, cigarettes: null,
    activity: '', thoughts: '', goodEvents: '', difficulties: '', conclusions: '', tomorrowPlans: '',
    workEvents: '', familyEvents: '', financeNotes: '', updatedAt: new Date().toISOString() }
}

export function sleepHours(sleepAt: string | null, wakeAt: string | null): number | null {
  if (!sleepAt || !wakeAt || !/^([01]\d|2[0-3]):[0-5]\d$/.test(sleepAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(wakeAt)) return null
  const [sHour, sMinute] = sleepAt.split(':').map(Number)
  const [wHour, wMinute] = wakeAt.split(':').map(Number)
  const sleep = sHour * 60 + sMinute
  const wake = wHour * 60 + wMinute
  const minutes = (wake - sleep + 1440) % 1440
  // Identical timestamps may be either 0 or 24 hours: don't infer a duration.
  return minutes === 0 ? null : Math.round(minutes / 60 * 10) / 10
}

function value(text: string | null | undefined): string { return text?.trim() || 'не указано' }
function lines(items: string[]) { return items.length ? items.map(item => `- ${item}`).join('\n') : 'не указано' }

export function makeDailyReport(input: {
  date: string
  journal: JournalEntry | undefined
  tasks: TaskItem[]
  groups: GroupItem[]
  occurrences: OccurrenceItem[]
  taskMoves: TaskMove[]
  questCompletions: QuestCompletion[]
  trackers?: TrackerDefinition[]
  trackerReadings?: TrackerReading[]
  dayModes?: DayMode[]
  comment: string
}) {
  const { date, journal, tasks, groups, occurrences, taskMoves, questCompletions, comment } = input
  const forDay = scheduledForDate(tasks, occurrences, date)
  const groupNames = new Map(groups.map(group => [group.id, group.name]))
  const taskLabel = (task: TaskItem) => `[${groupNames.get(task.group) ?? 'Без группы'}] ${task.text}${task.payment ? ` · ${paymentLabel(task.payment)}` : ''}${task.time ? ` (${task.time})` : ''}`
  const completed = forDay.filter(item => item.done).map(item => taskLabel(item.task))
  const incomplete = forDay.filter(item => !item.done).map(item => taskLabel(item.task))
  const transferred = taskMoves.filter(move => move.fromDate === date).sort((a, b) => a.movedAt.localeCompare(b.movedAt))
    .map(move => `${move.taskTitle} → ${localDate(move.toDate, { day: 'numeric', month: 'short', year: 'numeric' })}`)
  const tomorrow = scheduledForDate(tasks, occurrences, shiftDay(date, 1)).filter(item => !item.done).map(item => taskLabel(item.task))
  const duration = sleepHours(journal?.sleepAt ?? null, journal?.wakeAt ?? null)
  const sleep = journal?.sleepAt && journal.wakeAt
    ? `${journal.sleepAt}–${journal.wakeAt}${duration !== null ? ` (${duration.toLocaleString('ru-RU')} ч, расчёт по указанному времени)` : ''}`
    : journal?.sleepAt || journal?.wakeAt ? `Лёг: ${value(journal.sleepAt)}, проснулся: ${value(journal.wakeAt)}` : 'не указано'
  const paragraph = (text: string | undefined) => value(text)
  const thoughts = [journal?.thoughts, comment].map(v => v?.trim()).filter(Boolean).join('\n')
  const dateLabel = localDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const dayXp = dailyQuestXp(questCompletions, date)
  const rpg = experience(questCompletions, date)
  const quests = QUESTS.filter(quest => hasCompletedQuest(questCompletions, date, quest.id)).map(quest => `${quest.title} (+${quest.xp} XP)`)
  const tracked = readingsForReport(input.trackers ?? [], input.trackerReadings ?? [], date)
  const dayPayments = forDay.filter(item => item.task.kind === 'payment' && !!item.task.payment)
    .map(item => `${item.task.text}: ${paymentLabel(item.task.payment!)} — ${item.done ? 'отмечено как оплачено' : 'запланировано, оплата не подтверждена'}`)
  const finance = [journal?.financeNotes?.trim(), dayPayments.length ? lines(dayPayments) : ''].filter(Boolean).join('\n')
  const isLight = lightDay(input.dayModes ?? [], date)
  return `BASE: REBUILD — DAILY REPORT

Дата: ${dateLabel}
Персонаж: Дмитрий
Уровень: LVL ${String(rpg.level).padStart(2, '0')} — ${rpg.title}
XP за день: ${dayXp}
Общий XP на эту дату: ${rpg.totalXp}
Режим дня: ${isLight ? 'облегчённый' : 'обычный'}

СОСТОЯНИЕ
Сон: ${sleep}
Энергия: ${journal?.energy == null ? 'не указано' : `${journal.energy}/10`}
Настроение: ${journal?.mood == null ? 'не указано' : `${journal.mood}/10`}
Курение: ${journal?.cigarettes == null ? 'не указано' : `${journal.cigarettes} сигарет`}
Активность: ${paragraph(journal?.activity)}

ВЫПОЛНЕНО
${lines(completed)}

НЕ ВЫПОЛНЕНО
${lines(incomplete)}

ПЕРЕНЕСЕНО
${lines(transferred)}

ЕЖЕДНЕВНЫЕ КВЕСТЫ
${lines(quests)}

ТРЕКЕРЫ
${lines(tracked)}

РАБОТА
${paragraph(journal?.workEvents)}

ДОМ И СЕМЬЯ
${paragraph(journal?.familyEvents)}

ФИНАНСЫ
${value(finance)}

ХОРОШИЕ СОБЫТИЯ
${paragraph(journal?.goodEvents)}

СЛОЖНОСТИ
${paragraph(journal?.difficulties)}

ВЫВОДЫ
${paragraph(journal?.conclusions)}

МОИ МЫСЛИ
${value(thoughts)}

ПЛАН НА ЗАВТРА
${lines(tomorrow)}
Личный план: ${paragraph(journal?.tomorrowPlans)}

ЗАПРОС К CHATGPT
${REPORT_REQUEST}`
}
