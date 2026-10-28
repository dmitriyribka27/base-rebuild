import { dateKey } from './demo'

export const XP_PER_LEVEL = 700
export const PROGRAM_START = '2026-10-23'
export const PROGRAM_END = '2027-01-20'

export const CHARACTERISTICS = [
  { id: 'reliability', name: 'Надёжность', symbol: '◇', description: 'Держать слово и выполнять обязательства' },
  { id: 'closeness', name: 'Близость', symbol: '♡', description: 'Бережность и контакт с близкими' },
  { id: 'health', name: 'Здоровье', symbol: '✚', description: 'Забота о теле и восстановлении' },
  { id: 'selfControl', name: 'Самообладание', symbol: '◈', description: 'Замечать состояние и выбирать действия' },
  { id: 'finances', name: 'Финансы', symbol: '₾', description: 'Отдельные финансовые миссии появятся позднее' },
  { id: 'fullness', name: 'Полнота жизни', symbol: '✳', description: 'Маленькие радости и интерес к жизни' },
] as const

export type CharacteristicId = (typeof CHARACTERISTICS)[number]['id']

export const QUESTS = [
  { id: 'word', title: 'Слово = действие', detail: 'Сдержал конкретное обещание или выполнил обязательство', xp: 25, characteristic: 'reliability' },
  { id: 'initiative', title: 'Инициатива дома', detail: 'Сам заметил и сделал полезное для дома или котов', xp: 20, characteristic: 'reliability' },
  { id: 'contact', title: 'Бережный контакт', detail: 'Уделил внимание отношениям без требования ответной реакции', xp: 15, characteristic: 'closeness' },
  { id: 'recovery', title: 'Восстановление', detail: 'Сделал посильное действие ради отдыха или здоровья', xp: 15, characteristic: 'health' },
  { id: 'reflection', title: 'Честный вечерний отчёт', detail: 'Отметил факты дня и сделал небольшой вывод', xp: 15, characteristic: 'selfControl' },
  { id: 'nicotine', title: 'Никотиновый журнал', detail: 'Записал число сигарет, без оценки и наказания', xp: 5, characteristic: 'selfControl' },
  { id: 'joy', title: 'Маленькая радость', detail: 'Нашёл место для чего-то приятного или нового', xp: 5, characteristic: 'fullness' },
] as const satisfies ReadonlyArray<{ id: string; title: string; detail: string; xp: number; characteristic: CharacteristicId }>

export type QuestId = (typeof QUESTS)[number]['id']
export type QuestCompletion = {
  id: string
  date: string
  questId: QuestId
  done: boolean
  completedAt: string | null
  updatedAt: string
}

const QUEST_BY_ID = new Map<string, (typeof QUESTS)[number]>(QUESTS.map(quest => [quest.id, quest]))
export const MAX_DAILY_XP = QUESTS.reduce((sum, quest) => sum + quest.xp, 0)

export const LEVEL_TITLES = [
  'Пробуждение', 'Первый контроль', 'Последовательность', 'Надёжность',
  'Устойчивость', 'Самостоятельность', 'Восстановление', 'Дисциплина',
  'Равновесие', 'Новая база',
]

export function questRecordId(date: string, questId: QuestId) { return `${date}:${questId}` }

function uniqueCompleted(records: QuestCompletion[], throughDate?: string) {
  const latest = new Map<string, QuestCompletion>()
  for (const record of records) {
    if (!QUEST_BY_ID.has(record.questId) || record.id !== questRecordId(record.date, record.questId) || (throughDate && record.date > throughDate)) continue
    const previous = latest.get(record.id)
    if (!previous || previous.updatedAt <= record.updatedAt) latest.set(record.id, record)
  }
  return [...latest.values()].filter(record => record.done && !!record.completedAt)
}

export function dailyQuestXp(records: QuestCompletion[], date: string) {
  return uniqueCompleted(records, date).filter(record => record.date === date)
    .reduce((total, record) => total + (QUEST_BY_ID.get(record.questId)?.xp ?? 0), 0)
}

export function completedQuestCount(records: QuestCompletion[], date: string) {
  return uniqueCompleted(records, date).filter(record => record.date === date).length
}

export function hasCompletedQuest(records: QuestCompletion[], date: string, questId: QuestId) {
  return uniqueCompleted(records, date).some(record => record.date === date && record.questId === questId)
}

export function experience(records: QuestCompletion[], throughDate?: string) {
  const completed = uniqueCompleted(records, throughDate)
  const byCharacteristic = Object.fromEntries(CHARACTERISTICS.map(stat => [stat.id, 0])) as Record<CharacteristicId, number>
  const byDate = new Map<string, number>()
  for (const record of completed) {
    const quest = QUEST_BY_ID.get(record.questId)
    if (!quest) continue
    byCharacteristic[quest.characteristic] += quest.xp
    byDate.set(record.date, (byDate.get(record.date) ?? 0) + quest.xp)
  }
  const totalXp = Object.values(byCharacteristic).reduce((sum, value) => sum + value, 0)
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1
  const levelXp = totalXp % XP_PER_LEVEL
  return {
    totalXp, level, title: LEVEL_TITLES[level - 1] ?? 'Новая глава',
    levelXp, untilNext: XP_PER_LEVEL - levelXp, levelPercent: Math.round(levelXp / XP_PER_LEVEL * 100),
    byCharacteristic, activeDays: byDate.size,
    daily: [...byDate.entries()].map(([date, xp]) => ({ date, xp })).sort((a, b) => b.date.localeCompare(a.date)),
  }
}

export function programDay(today: string = dateKey(new Date())) {
  if (today < PROGRAM_START) return 0
  if (today > PROGRAM_END) return 90
  const start = Date.parse(`${PROGRAM_START}T12:00:00Z`)
  const current = Date.parse(`${today}T12:00:00Z`)
  return Math.max(0, Math.min(90, Math.round((current - start) / 86_400_000) + 1))
}
