import { MAX_DAILY_XP, experience, type QuestCompletion } from './rpg'
import type { DailyReport } from './journal'
import type { TrackerReading, DayMode } from './trackers'

export type Achievement = { id: string; name: string; description: string; icon: string; unlocked: boolean }

export function achievements({ quests, reports, readings, dayModes }: {
  quests: QuestCompletion[]
  reports: DailyReport[]
  readings: TrackerReading[]
  dayModes: DayMode[]
}): Achievement[] {
  const xp = experience(quests)
  const hasFullDay = xp.daily.some(day => day.xp === MAX_DAILY_XP)
  return [
    { id: 'firstQuest', name: 'Первое действие', description: 'Отметить первый ежедневный квест', icon: '✦', unlocked: xp.totalXp > 0 },
    { id: 'firstReport', name: 'Записанный день', description: 'Сохранить первый вечерний отчёт', icon: '▤', unlocked: reports.length > 0 },
    { id: 'firstTracker', name: 'Наблюдатель', description: 'Внести первое значение своего трекера', icon: '◈', unlocked: readings.some(reading => reading.value !== null) },
    { id: 'lightDay', name: 'Бережный режим', description: 'Попробовать облегчённый день', icon: '☾', unlocked: dayModes.some(mode => mode.light) },
    { id: 'threeDays', name: 'Три точки опоры', description: 'Отметить квесты в трёх разных днях', icon: '◇', unlocked: xp.activeDays >= 3 },
    { id: 'fullDay', name: 'Все семь', description: 'Однажды выполнить все семь квестов за день', icon: '✳', unlocked: hasFullDay },
    { id: 'levelTwo', name: 'Первый контроль', description: 'Достичь второго уровня (700 XP)', icon: '▲', unlocked: xp.level >= 2 },
    { id: 'sevenDays', name: 'Свой ритм', description: 'Отметить квесты в семи разных днях, не обязательно подряд', icon: '❖', unlocked: xp.activeDays >= 7 },
  ]
}
