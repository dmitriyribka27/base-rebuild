import { useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { journalInsight, insightDates, insightPeriodLabel, shiftInsightPeriod, trackerInsight, type InsightPeriod } from './insights'
import { localDate } from './demo'
import { trackingValue, type TrackerDefinition, type TrackerReading } from './trackers'
import type { JournalEntry } from './journal'

const format = (value: number | null, unit = '') => value === null ? '—' : `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}${unit}`
const recordsLabel = (count: number) => {
  if (count === 0) return 'Нет записей'
  const mod100 = count % 100
  const mod10 = count % 10
  const noun = mod10 === 1 && mod100 !== 11 ? 'запись' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'записи' : 'записей'
  return `${count} ${noun} · среднее`
}

function Bar({ date, value, tracker, max }: { date: string; value: boolean | number | null; tracker: TrackerDefinition; max: number | null }) {
  const recorded = value !== null
  const percent = !recorded ? 0 : typeof value === 'boolean' ? (value ? 100 : 13)
    : tracker.type === 'scale' ? Math.max(10, value * 10) : Math.max(10, max && max > 0 ? value / max * 100 : 10)
  const label = `${localDate(date, { day: 'numeric', month: 'short' })}: ${trackingValue(tracker, value)}`
  return <span className={`insight-slot${recorded ? ' recorded' : ' missing'}${value === false ? ' negative' : ''}`} title={label} aria-label={label}>
    {recorded && <span className="insight-slot-fill" style={{ height: `${percent}%` }} />}
  </span>
}

export default function TrackerInsights({ today, trackers, readings, journals }: {
  today: string; trackers: TrackerDefinition[]; readings: TrackerReading[]; journals: JournalEntry[]
}) {
  const [period, setPeriod] = useState<InsightPeriod>('week')
  const [anchor, setAnchor] = useState(today)
  const dates = insightDates(anchor, period)
  const current = insightDates(today, period)
  const journal = journalInsight(journals, dates)
  const active = trackers.filter(tracker => !tracker.archived).sort((a, b) => a.order - b.order)
  const atCurrent = dates[0] === current[0]

  return <section className="insights-section" aria-label="Статистика за неделю и месяц">
    <div className="insights-title"><div><h2>Аналитика жизни</h2><p>Только твои записи. Пропуски не считаются нулями.</p></div></div>
    <div className="insights-controls" role="group" aria-label="Период статистики"><button aria-pressed={period === 'week'} className={period === 'week' ? 'active' : ''} onClick={() => setPeriod('week')}>Неделя</button><button aria-pressed={period === 'month'} className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>Месяц</button></div>
    <div className="insights-period"><button aria-label="Предыдущий период статистики" onClick={() => setAnchor(old => shiftInsightPeriod(old, period, -1))}><ChevronLeft size={20}/></button><strong>{insightPeriodLabel(dates, period)}</strong><button aria-label="Следующий период статистики" disabled={atCurrent} onClick={() => setAnchor(old => shiftInsightPeriod(old, period, 1))}><ChevronRight size={20}/></button></div>
    {!atCurrent && <button className="insights-reset" onClick={() => setAnchor(today)}><RotateCcw size={14}/> К текущему периоду</button>}
    <div className="insights-subtitle">Самочувствие</div>
    <div className="insights-health-grid">
      <div><small>Сон</small><strong>{format(journal.sleep.average, ' ч')}</strong><span>{recordsLabel(journal.sleep.count)}</span></div>
      <div><small>Энергия</small><strong>{format(journal.energy.average, '/10')}</strong><span>{recordsLabel(journal.energy.count)}</span></div>
      <div><small>Настроение</small><strong>{format(journal.mood.average, '/10')}</strong><span>{recordsLabel(journal.mood.count)}</span></div>
      <div><small>Сигареты</small><strong>{format(journal.cigarettes.average)}</strong><span>{recordsLabel(journal.cigarettes.count)}</span></div>
    </div>
    <div className="insights-subtitle">Мои трекеры</div>
    {!active.length ? <div className="insights-empty">Создай первый трекер во вкладке «Сегодня», чтобы увидеть здесь историю. Демонстрационные значения не добавляются.</div> : active.map(tracker => {
      const insight = trackerInsight(tracker, readings, dates)
      const summary = insight.count === 0 ? 'Нет записей за этот период' : tracker.type === 'boolean'
        ? `Да: ${insight.yesCount} · Нет: ${insight.noCount}`
        : `Среднее: ${format(insight.average, tracker.type === 'scale' ? '/10' : tracker.unit ? ` ${tracker.unit}` : '')}`
      return <article className="insights-tracker" key={tracker.id}>
        <div className="insights-tracker-head"><strong>{tracker.title}</strong><span>{insight.count} из {dates.length} дней с записью</span></div>
        <p>{summary}</p>
        <div className={`insight-bars ${period === 'month' ? 'monthly' : 'weekly'}`} style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }} role="group" aria-label={`История трекера ${tracker.title}`}>
          {insight.points.map(point => <Bar key={point.date} date={point.date} value={point.value} tracker={tracker} max={insight.maximum}/>)}
        </div>
        <div className="insights-axis"><small>{localDate(dates[0], { day: 'numeric', month: 'short' })}</small><small>{localDate(dates[dates.length - 1], { day: 'numeric', month: 'short' })}</small></div>
      </article>
    })}
    <p className="insights-footnote">Числа и средние рассчитываются только по внесённым значениям, включая 0. Для «да/нет» учитываются оба ответа. Записи из будущего не создаются автоматически.</p>
  </section>
}
