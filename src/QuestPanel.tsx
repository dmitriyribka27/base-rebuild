import { Check, ChevronDown, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { CHARACTERISTICS, QUESTS, MAX_DAILY_XP, completedQuestCount, dailyQuestXp, hasCompletedQuest, type QuestCompletion, type QuestId } from './rpg'

const lightQuestIds = new Set<QuestId>(['recovery', 'nicotine', 'joy'])

export default function QuestPanel({ date, today, records, ready, savingId, lightEnabled, lightSaving, onToggle, onToggleLight }: {
  date: string
  today: string
  records: QuestCompletion[]
  ready: boolean
  savingId: string | null
  lightEnabled: boolean
  lightSaving: boolean
  onToggle: (date: string, questId: QuestId) => Promise<void>
  onToggleLight: (date: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(true)
  const [showOthers, setShowOthers] = useState(false)
  const earned = dailyQuestXp(records, date)
  const completed = completedQuestCount(records, date)
  const isFuture = date > today
  return <section className="quests-card" aria-label="Ежедневные RPG-квесты">
    <button className="quests-heading" type="button" aria-expanded={expanded} onClick={() => setExpanded(old => !old)}>
      <span className="quests-symbol"><Sparkles size={19}/></span>
      <span className="quests-heading-text"><strong>Ежедневные квесты</strong><small>{completed} из {QUESTS.length} · без штрафов и серий</small></span>
      <span className="quests-heading-xp">{earned} <small>/ {MAX_DAILY_XP} XP</small></span>
      <ChevronDown className={expanded ? 'quests-chevron expanded' : 'quests-chevron'} size={19}/>
    </button>
    <div className="quests-track" role="progressbar" aria-label="XP за выбранный день" aria-valuenow={earned} aria-valuemin={0} aria-valuemax={MAX_DAILY_XP}><div style={{ width: `${earned / MAX_DAILY_XP * 100}%` }}/></div>
    {expanded && <div className="quests-body">
      {isFuture && <p className="quests-help">Будущие квесты можно просмотреть, но отметить только после наступления даты.</p>}
      <div className="quests-light-row"><span className="quests-light-description"><strong>☾ Облегчённый день</strong><small>Показываем три мягких квеста. Остальные доступны, XP и максимум не меняются.</small></span><button type="button" className={`quests-light-toggle${lightEnabled ? ' on' : ''}`} aria-pressed={lightEnabled} disabled={!ready || lightSaving || isFuture} onClick={() => void onToggleLight(date)}>{lightEnabled ? 'Включён' : 'Включить'}</button></div>
      {QUESTS.filter(quest => !lightEnabled || showOthers || lightQuestIds.has(quest.id)).map(quest => {
        const checked = hasCompletedQuest(records, date, quest.id)
        const stat = CHARACTERISTICS.find(item => item.id === quest.characteristic)!
        const id = `${date}:${quest.id}`
        return <button key={quest.id} type="button" className={`quest-row${checked ? ' checked' : ''}`} aria-pressed={checked}
          aria-label={`${quest.title}: ${checked ? 'снять отметку' : 'отметить выполнение'}, ${quest.xp} XP`}
          disabled={!ready || isFuture || savingId !== null}
          onClick={() => void onToggle(date, quest.id)}>
          <span className="quest-check">{checked && <Check size={16} strokeWidth={2.7}/>}</span>
          <span className="quest-info"><strong>{quest.title}</strong><small>{quest.detail}</small><em>{stat.name}</em></span>
          <span className="quest-xp">+{quest.xp}</span>
          {savingId === id && <span className="sr-only">Сохраняем</span>}
        </button>
      })}
      {lightEnabled && <button type="button" className="quests-show-more" onClick={() => setShowOthers(old => !old)}>{showOthers ? 'Скрыть дополнительные квесты' : 'Показать остальные четыре квеста'}</button>}
      <p className="quests-help">Это отметки по твоим словам. Обычные задачи и коллекции не дают дополнительных XP. Отменить ошибочную отметку можно в любой момент.</p>
    </div>}
  </section>
}
