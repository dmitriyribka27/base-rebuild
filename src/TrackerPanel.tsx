import { useState, type FormEvent } from 'react'
import { Archive, ChevronDown, ChevronUp, CirclePlus, Pencil, RotateCcw, Save, X } from 'lucide-react'
import { readingForDate, trackingValue, type TrackerDefinition, type TrackerReading, type TrackerType } from './trackers'

export type TrackerDraft = { title: string; type: TrackerType; unit: string; archived: boolean }

function Reading({ date, tracker, readings, ready, busy, onRecord }: {
  date: string; tracker: TrackerDefinition; readings: TrackerReading[]; ready: boolean; busy: boolean
  onRecord: (tracker: TrackerDefinition, date: string, value: boolean | number | null) => Promise<void>
}) {
  const record = readingForDate(readings, date, tracker.id)
  const value = record?.value ?? null
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = draft.trim().replace(',', '.')
    if (!trimmed) { await onRecord(tracker, date, null); setError(''); return }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000_000) { setError('Нужно число от 0 до 1 000 000 000.'); return }
    setError('')
    await onRecord(tracker, date, parsed)
  }
  return <div className="tracker-reading">
    <div className="tracker-reading-title"><strong>{tracker.title}</strong><small>{value === null ? 'нет записи' : trackingValue(tracker, value)}</small></div>
    {tracker.type === 'boolean' && <div className="tracker-boolean">
      <button type="button" className={value === true ? 'selected' : ''} disabled={!ready || busy} onClick={() => void onRecord(tracker, date, value === true ? null : true)} aria-pressed={value === true}>Да</button>
      <button type="button" className={value === false ? 'selected' : ''} disabled={!ready || busy} onClick={() => void onRecord(tracker, date, value === false ? null : false)} aria-pressed={value === false}>Нет</button>
    </div>}
    {tracker.type === 'scale' && <div className="tracker-scale" aria-label={`${tracker.title}: значение от 1 до 10`}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(score => <button type="button" key={score} aria-pressed={value === score} className={value === score ? 'selected' : ''} disabled={!ready || busy} onClick={() => void onRecord(tracker, date, value === score ? null : score)}>{score}</button>)}
    </div>}
    {tracker.type === 'number' && <form className="tracker-number" onSubmit={event => void submit(event)}>
      <input type="text" inputMode="decimal" value={draft} onChange={event => { setDraft(event.target.value); setError('') }} placeholder={tracker.unit ? `Число (${tracker.unit})` : 'Введите число'} aria-label={`Значение: ${tracker.title}`} maxLength={18} disabled={!ready || busy} />
      <button type="submit" disabled={!ready || busy} aria-label={`Сохранить: ${tracker.title}`}><Save size={17}/></button>
      {error && <small className="tracker-error" role="alert">{error}</small>}
    </form>}
  </div>
}

export default function TrackerPanel({ date, trackers, readings, ready, saving, onSave, onRecord }: {
  date: string; trackers: TrackerDefinition[]; readings: TrackerReading[]; ready: boolean; saving: boolean
  onSave: (draft: TrackerDraft, existing?: TrackerDefinition) => Promise<void>
  onRecord: (tracker: TrackerDefinition, date: string, value: boolean | number | null) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState<TrackerDefinition | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [formError, setFormError] = useState('')
  const [draft, setDraft] = useState<TrackerDraft>({ title: '', type: 'boolean', unit: '', archived: false })
  const active = trackers.filter(item => !item.archived).sort((a, b) => a.order - b.order)
  const archive = trackers.filter(item => item.archived)
  const recorded = active.filter(item => readingForDate(readings, date, item.id)?.value != null).length

  function openForm(item?: TrackerDefinition) {
    setEditing(item ?? null); setDraft(item ? { title: item.title, type: item.type, unit: item.unit, archived: item.archived } : { title: '', type: 'boolean', unit: '', archived: false }); setFormError(''); setFormOpen(true)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      await onSave(draft, editing ?? undefined)
      setFormOpen(false)
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Не удалось сохранить трекер.') }
  }
  return <section className="trackers-card" aria-label="Мои дополнительные трекеры">
    <button type="button" className="trackers-heading" onClick={() => setExpanded(old => !old)} aria-expanded={expanded}>
      <span className="trackers-symbol">◈</span><span className="trackers-heading-text"><strong>Мои трекеры</strong><small>{active.length ? `${recorded} из ${active.length} записано` : 'Привычки и показатели без XP'}</small></span>
      {expanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
    </button>
    {expanded && <div className="trackers-body">
      {!active.length && <p className="trackers-empty">Здесь пока пусто. Добавь свой показатель: английский, зарядка, вода или что-то другое.</p>}
      {active.map(tracker => <div className="tracker-entry" key={tracker.id}>
        <button type="button" className="tracker-edit" onClick={() => openForm(tracker)} aria-label={`Настроить трекер ${tracker.title}`} disabled={!ready || saving}><Pencil size={15}/></button>
        <Reading key={`${date}:${tracker.id}`} date={date} tracker={tracker} readings={readings} ready={ready} busy={saving} onRecord={onRecord}/>
      </div>)}
      <button type="button" className="tracker-create" disabled={!ready || saving} onClick={() => openForm()}><CirclePlus size={18}/> Добавить трекер</button>
      {archive.length > 0 && <div className="tracker-archive"><button type="button" onClick={() => setShowArchive(old => !old)}>{showArchive ? 'Скрыть архив' : `Архив (${archive.length})`}</button>{showArchive && archive.map(item => <div className="tracker-archive-row" key={item.id}><span>{item.title}</span><button type="button" disabled={!ready || saving} onClick={() => void onSave({ title: item.title, type: item.type, unit: item.unit, archived: false }, item)}><RotateCcw size={15}/> Вернуть</button></div>)}</div>}
      <p className="trackers-note">Энергия, настроение и сигареты уже есть в «Дневнике». Здесь дополнительные показатели. За их заполнение XP не начисляется.</p>
    </div>}
    {formOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setFormOpen(false) }}>
      <form className="task-modal tracker-modal" onSubmit={event => void submit(event)}><div className="modal-handle"/>
        <div className="modal-heading"><div><p className="eyebrow">BASE / НАСТРОЙКА</p><h2>{editing ? 'Изменить трекер' : 'Новый трекер'}</h2></div><button type="button" className="close-button" onClick={() => setFormOpen(false)} disabled={saving} aria-label="Закрыть"><X size={20}/></button></div>
        <label className="form-label" htmlFor="tracker-name">Название</label><input id="tracker-name" required maxLength={70} autoFocus value={draft.title} onChange={event => setDraft(old => ({ ...old, title: event.target.value }))} placeholder="Например, английский"/>
        <label className="form-label" htmlFor="tracker-type">Тип значения</label><select id="tracker-type" value={draft.type} disabled={!!editing && readings.some(row => row.trackerId === editing.id && row.value !== null)} onChange={event => setDraft(old => ({ ...old, type: event.target.value as TrackerType, unit: '' }))}><option value="boolean">Да / нет</option><option value="number">Число</option><option value="scale">Шкала 1–10</option></select>
        {editing && readings.some(row => row.trackerId === editing.id && row.value !== null) && <p className="trackers-note">Тип нельзя менять после первой записи, чтобы сохранить историю.</p>}
        {draft.type === 'number' && <><label className="form-label" htmlFor="tracker-unit">Единица измерения (необязательно)</label><input id="tracker-unit" maxLength={20} placeholder="мин, стаканов, км…" value={draft.unit} onChange={event => setDraft(old => ({ ...old, unit: event.target.value }))}/></>}
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button type="submit" className="submit-task" disabled={saving || !draft.title.trim()}>{saving ? 'Сохраняем…' : 'Сохранить трекер'}</button>
        {editing && !editing.archived && <button type="button" className="tracker-archive-action" disabled={saving} onClick={() => void onSave({ ...draft, archived: true }, editing).then(() => setFormOpen(false)).catch(error => setFormError(error instanceof Error ? error.message : 'Ошибка'))}><Archive size={16}/> Архивировать без удаления записей</button>}
      </form>
    </div>}
  </section>
}
