import { useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarCheck2, Check, ChevronLeft, ChevronRight, Clipboard, Clock3, FileText, Moon, Save, Sparkles } from 'lucide-react'
import { localDate, shiftDay, type GroupItem, type OccurrenceItem, type TaskItem } from './demo'
import { emptyJournal, makeDailyReport, sleepHours, type DailyReport, type JournalEntry, type TaskMove } from './journal'
import type { QuestCompletion } from './rpg'

type JournalField = Exclude<keyof JournalEntry, 'date' | 'updatedAt'>

function ScoreControl({ name, value, onChange }: { name: string; value: number | null; onChange: (value: number | null) => void }) {
  return <div className="journal-score"><div className="journal-score-heading"><strong>{name}</strong><span>{value == null ? 'не указано' : `${value} / 10`}</span></div><div className="journal-score-options">{Array.from({ length: 10 }, (_, index) => index + 1).map(number => <button type="button" aria-label={`${name}: ${number} из 10`} aria-pressed={value === number} key={number} className={value === number ? 'selected' : ''} onClick={() => onChange(value === number ? null : number)}>{number}</button>)}</div></div>
}

function TextField({ id, title, placeholder, value, rows = 3, onChange }: { id: string; title: string; placeholder: string; value: string; rows?: number; onChange: (value: string) => void }) {
  return <div className="journal-text-field"><label htmlFor={id}>{title}</label><textarea id={id} placeholder={placeholder} rows={rows} maxLength={12000} value={value} onChange={event => onChange(event.target.value)}/></div>
}

export default function Journal({ today, ready, journals, reports, taskMoves, questCompletions, tasks, groups, occurrences, onUpdate, onSaveReport }: {
  today: string
  ready: boolean
  journals: JournalEntry[]
  reports: DailyReport[]
  taskMoves: TaskMove[]
  questCompletions: QuestCompletion[]
  tasks: TaskItem[]
  groups: GroupItem[]
  occurrences: OccurrenceItem[]
  onUpdate: (entry: JournalEntry) => void
  onSaveReport: (date: string, comment: string) => Promise<void>
}) {
  const [selected, setSelected] = useState(today)
  const [reportOpen, setReportOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [reportSaving, setReportSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const entry = journals.find(item => item.date === selected) ?? emptyJournal(selected)
  const savedReport = reports.find(item => item.date === selected)
  const duration = sleepHours(entry.sleepAt, entry.wakeAt)
  const reportText = makeDailyReport({ date: selected, journal: journals.find(item => item.date === selected), tasks, groups, occurrences, taskMoves, questCompletions, comment })
  const history = [...reports].sort((a, b) => b.date.localeCompare(a.date))

  function update(field: JournalField, value: string | number | null) {
    onUpdate({ ...entry, [field]: value, updatedAt: new Date().toISOString() })
  }
  function changeDate(date: string) { setSelected(date); setFeedback('') }
  function openReport(date = selected) {
    setSelected(date)
    setComment(reports.find(item => item.date === date)?.comment ?? '')
    setReportOpen(true)
    setFeedback('')
  }
  async function saveReport() {
    if (reportSaving) return
    setReportSaving(true)
    try { await onSaveReport(selected, comment); setFeedback('Отчёт сохранён в истории. Его можно открыть и отредактировать позже.') }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Не удалось сохранить отчёт.') }
    finally { setReportSaving(false) }
  }
  function legacyCopy(text: string): boolean {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;'
    document.body.appendChild(area)
    area.focus(); area.select(); area.setSelectionRange(0, area.value.length)
    let copied = false
    try { copied = document.execCommand('copy') } catch { copied = false }
    area.remove()
    return copied
  }
  async function copyReport() {
    if (reportSaving) return
    setReportSaving(true)
    let copied = false
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(reportText); copied = true }
    } catch { copied = false }
    if (!copied) copied = legacyCopy(reportText)
    if (!copied) { setFeedback('Копирование недоступно. Выдели текст в предварительном просмотре или используй «Поделиться».'); setReportSaving(false); return }
    try { await onSaveReport(selected, comment); setFeedback('✓ Отчёт скопирован и сохранён в истории. Вставь его в чат ChatGPT.') }
    catch { setFeedback('✓ Текст скопирован, но сохранить историю не удалось. Проверь хранилище.') }
    finally { setReportSaving(false) }
  }
  async function shareReport() {
    if (!navigator.share) { setFeedback('На этом устройстве нет системного меню «Поделиться». Используй копирование текста.'); return }
    try { await navigator.share({ title: `BASE: REBUILD — ${selected}`, text: reportText }); await onSaveReport(selected, comment); setFeedback('Отчёт передан в выбранное приложение и сохранён в истории.') }
    catch (error) { if (!(error instanceof Error) || error.name !== 'AbortError') setFeedback('Не получилось поделиться отчётом. Попробуй копирование.') }
  }

  if (reportOpen) return <div className="page journal-page journal-report-page">
    <button className="lists-back" onClick={() => setReportOpen(false)}><ArrowLeft size={18}/> Вернуться в дневник</button>
    <p className="eyebrow">BASE / ВЕЧЕРНИЙ ОТЧЁТ</p><h1>Итоги дня<span className="mint-period">.</span></h1><p className="lead">{localDate(selected, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <div className="journal-report-guide"><FileText size={21}/><p>Отчёт собран из актуальных записей дневника и планера. ChatGPT ничего не получает, пока ты сам не вставишь текст в чат.</p></div>
    <div className="journal-text-field"><label htmlFor="report-comment">Дополнить своими словами</label><textarea id="report-comment" value={comment} maxLength={12000} rows={4} placeholder="Что важного произошло и что мне нужно учесть при анализе?" onChange={event => setComment(event.target.value)}/></div>
    <div className="journal-report-heading"><strong>Предварительный просмотр</strong><span>{reportText.length.toLocaleString('ru-RU')} символов</span></div>
    <textarea className="journal-report-preview" readOnly aria-label="Текст отчёта для ChatGPT" value={reportText} rows={21}/>
    {!!feedback && <div className="journal-feedback" role="status">{feedback}</div>}
    <button className="journal-copy" disabled={!ready || reportSaving} onClick={() => void copyReport()}><Clipboard size={19}/>{reportSaving ? 'Подожди…' : 'Скопировать для ChatGPT'}<ArrowRight size={18}/></button>
    <div className="journal-report-secondary"><button disabled={!ready || reportSaving} onClick={() => void saveReport()}><Save size={17}/> Сохранить отчёт</button><button disabled={!ready || reportSaving} onClick={() => void shareReport()}><ArrowRight size={17}/> Поделиться</button></div>
    {savedReport && <p className="journal-save-hint"><Check size={14}/> Последнее сохранение отчёта: {new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tbilisi', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(savedReport.updatedAt))}</p>}
  </div>

  return <div className="page journal-page">
    <p className="eyebrow">BASE / ЛИЧНЫЙ ДНЕВНИК</p><h1>Дневник<span className="mint-period">.</span></h1><p className="lead">Замечать жизнь — уже часть восстановления.</p>
    <div className="journal-date-panel"><button aria-label="Предыдущий день" onClick={() => changeDate(shiftDay(selected, -1))}><ChevronLeft size={19}/></button><div><span>ЗАПИСЬ ЗА ДЕНЬ</span><strong>{localDate(selected, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</strong></div><button aria-label="Следующий день" onClick={() => changeDate(shiftDay(selected, 1))}><ChevronRight size={19}/></button></div>
    <div className="journal-date-tools"><label htmlFor="journal-date">Выбрать дату</label><input id="journal-date" type="date" value={selected} onChange={event => event.target.value && changeDate(event.target.value)}/><button onClick={() => changeDate(today)} disabled={selected === today}>Сегодня</button></div>
    {!ready && <div className="lists-empty">Загружаем дневник…</div>}
    {ready && <>
      <section className="journal-section"><div className="journal-section-heading"><Moon size={19}/><div><span>01 / СОСТОЯНИЕ</span><h2>Сон и самочувствие</h2></div></div>
        <div className="journal-time-grid"><div><label htmlFor="journal-sleep">Время сна</label><div className="journal-time-picker"><span aria-hidden="true">{entry.sleepAt ?? '—:—'}</span><Clock3 size={16} aria-hidden="true"/><input type="time" id="journal-sleep" aria-label="Время сна" value={entry.sleepAt ?? ''} onChange={event => update('sleepAt', event.target.value || null)}/></div></div><div><label htmlFor="journal-wake">Пробуждение</label><div className="journal-time-picker"><span aria-hidden="true">{entry.wakeAt ?? '—:—'}</span><Clock3 size={16} aria-hidden="true"/><input type="time" id="journal-wake" aria-label="Пробуждение" value={entry.wakeAt ?? ''} onChange={event => update('wakeAt', event.target.value || null)}/></div></div></div>
        <div className="journal-sleep-summary"><Clock3 size={15}/>{duration == null ? 'Продолжительность не рассчитана' : `Около ${duration.toLocaleString('ru-RU')} ч по указанному времени`}</div>
        <ScoreControl name="Энергия" value={entry.energy} onChange={value => update('energy', value)}/>
        <ScoreControl name="Настроение" value={entry.mood} onChange={value => update('mood', value)}/>
        <div className="journal-number-field"><div><label htmlFor="journal-cigarettes">Сигареты за день</label><span>Пустое поле ≠ ноль</span></div><input type="number" inputMode="numeric" id="journal-cigarettes" min="0" max="999" step="1" placeholder="—" value={entry.cigarettes ?? ''} onChange={event => update('cigarettes', event.target.value === '' ? null : Math.max(0, Math.min(999, Math.trunc(Number(event.target.value) || 0))))}/></div>
        <TextField id="journal-activity" title="Физическая активность" rows={2} placeholder="Прогулка, лестница, тренировка — если была" value={entry.activity} onChange={value => update('activity', value)}/>
      </section>
      <section className="journal-section"><div className="journal-section-heading"><Sparkles size={19}/><div><span>02 / СОБЫТИЯ</span><h2>Каким был день</h2></div></div>
        <TextField id="journal-thoughts" title="Короткая запись о дне" placeholder="Как прошёл день на самом деле?" value={entry.thoughts} onChange={value => update('thoughts', value)}/>
        <TextField id="journal-good" title="Хорошие события" placeholder="Что удалось, порадовало, согрело?" value={entry.goodEvents} onChange={value => update('goodEvents', value)}/>
        <TextField id="journal-difficulties" title="Сложности" placeholder="Что было непростым?" value={entry.difficulties} onChange={value => update('difficulties', value)}/>
        <TextField id="journal-conclusions" title="Выводы" placeholder="Что стоит учесть, не ругая себя?" value={entry.conclusions} onChange={value => update('conclusions', value)}/>
      </section>
      <section className="journal-section"><div className="journal-section-heading"><CalendarCheck2 size={19}/><div><span>03 / КОНТЕКСТ</span><h2>Работа, близкие и планы</h2></div></div>
        <TextField id="journal-work" title="Рабочие события" rows={2} placeholder="Фактические результаты и ситуации" value={entry.workEvents} onChange={value => update('workEvents', value)}/>
        <TextField id="journal-family" title="Дом, Белла и семья" rows={2} placeholder="Что происходило дома и вместе" value={entry.familyEvents} onChange={value => update('familyEvents', value)}/>
        <TextField id="journal-finance" title="Финансовые заметки" rows={2} placeholder="Необязательно. Только то, что хочешь указать" value={entry.financeNotes} onChange={value => update('financeNotes', value)}/>
        <TextField id="journal-tomorrow" title="Планы на завтра" rows={2} placeholder="Главные ориентиры без перегруза" value={entry.tomorrowPlans} onChange={value => update('tomorrowPlans', value)}/>
      </section>
      <div className="journal-autosave"><Check size={15}/> Изменения сохраняются локально при вводе. Пустые поля остаются пустыми.</div>
      <button className="journal-finish" onClick={() => openReport()}><FileText size={20}/><span><strong>Завершить день</strong><small>Посмотреть отчёт и скопировать для ChatGPT</small></span><ArrowRight size={19}/></button>
      {!!history.length && <section className="journal-history"><h2>История отчётов</h2><p>Сохранённые итоги можно открыть и обновить.</p>{history.slice(0, 40).map(report => <button key={report.date} onClick={() => openReport(report.date)}><span><FileText size={17}/>{localDate(report.date, { day: 'numeric', month: 'long', year: 'numeric' })}</span><Check size={17}/></button>)}</section>}
    </>}
  </div>
}
