import { Check, CalendarDays, Sparkles, TrendingUp } from 'lucide-react'
import { localDate } from './demo'
import { CHARACTERISTICS, MAX_DAILY_XP, PROGRAM_END, PROGRAM_START, XP_PER_LEVEL, dailyQuestXp, experience, programDay, type QuestCompletion } from './rpg'

export default function Progress({ today, records, ready }: { today: string; records: QuestCompletion[]; ready: boolean }) {
  const xp = experience(records)
  const day = programDay(today)
  const todayXp = dailyQuestXp(records, today)
  const maxStat = Math.max(1, ...Object.values(xp.byCharacteristic))
  return <div className="page rpg-progress-page">
    <p className="eyebrow">BASE / RPG-ПРОГРЕСС</p><h1>Прогресс<span className="mint-period">.</span></h1><p className="lead">Опыт за реальные действия. Ни одного штрафа за отдых.</p>
    <section className="rpg-level-panel"><div className="rpg-level-top"><span>ПЕРСОНАЖ · ДМИТРИЙ</span><span>{xp.totalXp.toLocaleString('ru-RU')} XP</span></div>
      <div className="rpg-big-level"><strong>LVL {String(xp.level).padStart(2,'0')}</strong><span>{xp.title}</span></div>
      <div className="rpg-progress-numbers"><span>Опыт уровня {xp.levelXp} / {XP_PER_LEVEL}</span><span>До следующего: {xp.untilNext} XP</span></div>
      <div className="rpg-level-track" role="progressbar" aria-valuemin={0} aria-valuemax={XP_PER_LEVEL} aria-valuenow={xp.levelXp}><div style={{width:`${xp.levelPercent}%`}}/></div>
    </section>
    <div className="rpg-stats-summary"><div><Sparkles size={18}/><strong>{todayXp} <small>/ {MAX_DAILY_XP} XP</small></strong><span>За сегодня</span></div><div><Check size={18}/><strong>{xp.activeDays}</strong><span>Дней с квестами</span></div></div>
    <section className="rpg-characteristics"><h2>Шесть характеристик</h2><p>Каждая получает опыт только за связанные с ней квесты.</p>
      {CHARACTERISTICS.map(stat => <div className="rpg-characteristic" key={stat.id}><div className="rpg-stat-top"><span className="rpg-stat-icon">{stat.symbol}</span><span className="rpg-stat-name"><strong>{stat.name}</strong><small>{stat.description}</small></span><b>{xp.byCharacteristic[stat.id]} XP</b></div><div className="rpg-stat-track"><div style={{width:`${xp.byCharacteristic[stat.id] / maxStat * 100}%`}}/></div></div>)}
    </section>
    <section className="rpg-program"><div className="rpg-program-head"><CalendarDays size={18}/><strong>90 дней: 23.10.2026 — 20.01.2027</strong></div><div className="rpg-program-detail"><span>{day === 0 ? 'Программа ещё не началась' : day >= 90 ? '90 дней пройдены' : `День ${day} из 90`}</span><small>{Math.round(day / 90 * 100)}%</small></div><div className="rpg-level-track"><div style={{width:`${day / 90 * 100}%`}}/></div><p>Календарное время идёт своим ходом. Никаких обязательных серий, обнулений и наказаний за пропуски.</p></section>
    <section className="rpg-history"><h2><TrendingUp size={19}/> История XP</h2>{!ready ? <p>Загружаем данные…</p> : xp.daily.length ? xp.daily.slice(0,21).map(item => <div className="rpg-history-day" key={item.date}><span>{localDate(item.date,{day:'numeric',month:'long',year:'numeric'})}</span><strong>+{item.xp} XP</strong></div>) : <p>История появится после первого отмеченного квеста. Никаких тестовых достижений здесь нет.</p>}</section>
    <p className="rpg-future-note">Старт программы: {localDate(PROGRAM_START,{day:'numeric',month:'long',year:'numeric'})}. Финальная дата: {localDate(PROGRAM_END,{day:'numeric',month:'long',year:'numeric'})}. Финансовые квесты и достижения добавим отдельно.</p>
  </div>
}
