import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CirclePlus, Clock3, ListFilter, Pencil, Plus, Repeat2, Settings2, Sparkles, Trash2, Wallet, X } from 'lucide-react'
import { localDate, shiftDay, type GroupItem, type OccurrenceItem, type PaymentCurrency, type RepeatRule, type TaskItem, type TaskPriority } from './demo'
import { periodDates, recurrenceOf, scheduledForDate, sortedTasks, type ScheduledTask, type SortMode, type StatusFilter } from './schedule'
import { paymentLabel } from './payments'
import { SAMPLE_TASK_COUNT } from './sampleTasks'
import GroupManager, { type GroupDraft } from './GroupManager'
import QuestPanel from './QuestPanel'
import TrackerPanel, { type TrackerDraft } from './TrackerPanel'
import type { QuestCompletion, QuestId } from './rpg'
import { lightDay, type DayMode, type TrackerDefinition, type TrackerReading } from './trackers'

export type TaskDraft = { text: string; group: string; date: string; time: string; notes: string; priority: TaskPriority; repeat: RepeatRule; repeatUntil: string; kind: 'task' | 'payment'; paymentAmount: string; paymentCurrency: PaymentCurrency }
type CalendarMode = 'day' | 'week' | 'month'
type StorageState = 'loading' | 'ready' | 'error'

const repeatLabels: Record<RepeatRule, string> = {
  none: 'Не повторять', daily: 'Каждый день', weekdays: 'По будням',
  weekly: 'Раз в неделю', monthly: 'Раз в месяц',
}

function DateStrip({ selected, today, onSelect }: { selected: string; today: string; onSelect: (date: string) => void }) {
  const keys = Array.from({ length: 7 }, (_, index) => shiftDay(selected, index - 3))
  return <div className="date-strip">{keys.map(key => <button key={key} className={`date-pill${key === selected ? ' selected' : ''}`} onClick={() => onSelect(key)} aria-pressed={key === selected}><span>{localDate(key, { weekday: 'short' }).replace('.', '')}</span><strong>{localDate(key, { day: 'numeric' })}</strong><i className={key === today ? 'visible' : ''} /></button>)}</div>
}

function MonthPicker({ selected, today, counts, onSelect }: { selected: string; today: string; counts: Map<string, number>; onSelect: (date: string) => void }) {
  const [year, month] = selected.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return <div className="month-picker"><div className="month-label">{localDate(selected, { month: 'long', year: 'numeric' })}</div><div className="month-grid">
    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <span className="month-weekday" key={day}>{day}</span>)}
    {Array.from({ length: offset }, (_, i) => <span key={`empty-${i}`} />)}
    {Array.from({ length: days }, (_, i) => {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
      const count = counts.get(key) ?? 0
      return <button key={key} className={`${key === selected ? 'chosen' : ''} ${key === today ? 'today-dot' : ''}`} onClick={() => onSelect(key)} aria-label={`${i + 1} ${localDate(key, { month: 'long' })}, задач: ${count}`}><span>{i + 1}</span>{count > 0 && <small>{count > 9 ? '9+' : count}</small>}</button>
    })}
  </div></div>
}

function shiftView(key: string, mode: CalendarMode, direction: number): string {
  if (mode === 'day') return shiftDay(key, direction)
  if (mode === 'week') return shiftDay(key, direction * 7)
  const [year, month, day] = key.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1 + direction, 1))
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
  return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

function filterRows(rows: ScheduledTask[], status: StatusFilter, group: string) {
  return rows.filter(row => (status === 'all' || row.done === (status === 'done')) && (group === 'all' || row.task.group === group))
}

export default function Planner({ tasks, groups, occurrences, questCompletions, questSavingId, onToggleQuest, dayModes, onToggleLight, trackers, trackerReadings, onSaveTracker, onRecordTracker, today, storage, saving, onSave, onToggle, onDelete, onSaveGroup, onAddSamples }: {
  tasks: TaskItem[]
  groups: GroupItem[]
  occurrences: OccurrenceItem[]
  questCompletions: QuestCompletion[]
  questSavingId: string | null
  onToggleQuest: (date: string, questId: QuestId) => Promise<void>
  dayModes: DayMode[]
  onToggleLight: (date: string) => Promise<void>
  trackers: TrackerDefinition[]
  trackerReadings: TrackerReading[]
  onSaveTracker: (draft: TrackerDraft, existing?: TrackerDefinition) => Promise<void>
  onRecordTracker: (tracker: TrackerDefinition, date: string, value: boolean | number | null) => Promise<void>
  today: string
  storage: StorageState
  saving: boolean
  onSave: (draft: TaskDraft, existing?: TaskItem) => Promise<void>
  onToggle: (scheduled: ScheduledTask) => Promise<void>
  onDelete: (task: TaskItem) => Promise<void>
  onSaveGroup: (draft: GroupDraft, existing?: GroupItem) => Promise<void>
  onAddSamples: (date: string) => Promise<number>
}) {
  const [selected, setSelected] = useState(today)
  const [mode, setMode] = useState<CalendarMode>('day')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [sortMode, setSortMode] = useState<SortMode>('time')
  const [openGroups, setOpenGroups] = useState<string[]>(groups.map(group => group.id))
  const [managingGroups, setManagingGroups] = useState(false)
  const [resumeTaskAfterGroups, setResumeTaskAfterGroups] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<TaskItem | undefined>()
  const [draft, setDraft] = useState<TaskDraft>({ text: '', group: 'work', date: today, time: '', notes: '', priority: 'normal', repeat: 'none', repeatUntil: '', kind: 'task', paymentAmount: '', paymentCurrency: 'USD' })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [modalError, setModalError] = useState('')
  const [samplesError, setSamplesError] = useState('')

  const dates = useMemo(() => periodDates(selected, mode), [selected, mode])
  const period = useMemo(() => dates.map(date => {
    const all = scheduledForDate(tasks, occurrences, date)
    return { date, all, filtered: sortedTasks(filterRows(all, statusFilter, groupFilter), sortMode) }
  }), [dates, tasks, occurrences, statusFilter, groupFilter, sortMode])
  const totals = useMemo(() => period.reduce((acc, day) => ({
    count: acc.count + day.all.length,
    done: acc.done + day.all.filter(row => row.done).length,
  }), { count: 0, done: 0 }), [period])
  const counts = useMemo(() => new Map(period.map(day => [day.date, day.all.length])), [period])
  const percentage = totals.count ? Math.round(totals.done / totals.count * 100) : 0
  const shownDay = period[0]?.filtered ?? []
  const dailyAll = period[0]?.all ?? []
  const paymentsOnSelectedDate = scheduledForDate(tasks.filter(task => task.kind === 'payment'), occurrences, selected)
  const canAddSamples = selected === today && !tasks.some(task => task.id.startsWith('sample-'))

  function add(kind: 'task' | 'payment' = 'task') {
    if (storage !== 'ready') return
    const fallback = kind === 'payment' && groups.some(group => group.id === 'finance' && !group.archived)
      ? 'finance' : groups.find(group => !group.archived)?.id ?? groups[0]?.id ?? 'work'
    setEditing(undefined)
    setDraft({ text: '', group: fallback, date: selected, time: '', notes: '', priority: 'normal', repeat: kind === 'payment' ? 'monthly' : 'none', repeatUntil: '', kind, paymentAmount: '', paymentCurrency: 'USD' })
    setConfirmDelete(false); setModalError(''); setDialog(true)
  }
  function edit(task: TaskItem) {
    setEditing(task)
    setDraft({ text: task.text, group: task.group, date: task.date, time: task.time ?? '', notes: task.notes, priority: task.priority, repeat: recurrenceOf(task), repeatUntil: task.repeatUntil ?? '', kind: task.kind === 'payment' ? 'payment' : 'task', paymentAmount: task.payment?.amount.toString() ?? '', paymentCurrency: task.payment?.currency ?? 'USD' })
    setConfirmDelete(false); setModalError(''); setDialog(true)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fieldValue = (id: string, fallback: string) => (form.elements.namedItem(id) as HTMLInputElement | null)?.value ?? fallback
    // Safari's native date/time picker can update the rendered field before React state flushes.
    const submitted: TaskDraft = { ...draft,
      date: fieldValue('task-date', draft.date), time: fieldValue('task-time', draft.time),
      repeatUntil: fieldValue('task-repeat-until', draft.repeatUntil),
      paymentAmount: fieldValue('payment-amount', draft.paymentAmount),
    }
    if (!submitted.text.trim() || !submitted.date || submitted.repeatUntil && submitted.repeatUntil < submitted.date || saving) return
    try {
      await onSave(submitted, editing)
      setDialog(false)
      if (!editing || recurrenceOf(editing) === 'none') setSelected(submitted.date)
      setOpenGroups(old => old.includes(submitted.group) ? old : [...old, submitted.group])
    } catch (error) { setModalError(error instanceof Error ? error.message : 'Не удалось сохранить задачу.') }
  }
  async function remove() {
    if (!editing || saving) return
    try { await onDelete(editing); setDialog(false) }
    catch (error) { setModalError(error instanceof Error ? error.message : 'Не удалось удалить задачу.') }
  }
  function chooseDate(date: string) { setSelected(date); setMode('day') }
  function manageGroups(fromTask = false) { setResumeTaskAfterGroups(fromTask); if (fromTask) setDialog(false); setManagingGroups(true) }
  function closeGroupManager() { setManagingGroups(false); if (resumeTaskAfterGroups) setDialog(true); setResumeTaskAfterGroups(false) }
  async function addSamples() {
    setSamplesError('')
    try { await onAddSamples(today) }
    catch (error) { setSamplesError(error instanceof Error ? error.message : 'Не удалось добавить примеры.') }
  }

  return <div className="page today-page">
    <div className="today-heading"><div><p className="eyebrow">ПЛАНЕР <span className="eyebrow-dot">/</span> {mode === 'day' ? 'ДЕНЬ' : mode === 'week' ? 'НЕДЕЛЯ' : 'МЕСЯЦ'}</p><h1>{selected === today && mode === 'day' ? 'Сегодня' : mode === 'day' ? 'План дня' : mode === 'week' ? 'Неделя' : 'Месяц'}<span className="mint-period">.</span></h1></div><button className="square-action" aria-label="Вернуться к сегодняшней дате" onClick={() => { setSelected(today); setMode('day') }}><CalendarDays size={19} strokeWidth={1.7} /></button></div>
    <div className="date-navigation"><button aria-label="Предыдущий период" onClick={() => setSelected(old => shiftView(old, mode, -1))}><ChevronLeft size={20} /></button><span>{localDate(selected, { month: 'long', year: 'numeric' }).replace(/\s*г\.?$/, '')}</span><button aria-label="Следующий период" onClick={() => setSelected(old => shiftView(old, mode, 1))}><ChevronRight size={20} /></button></div>
    <DateStrip selected={selected} today={today} onSelect={setSelected} />
    <div className="view-toggle" role="tablist" aria-label="Режим календаря">{([{ id: 'day', label: 'День' }, { id: 'week', label: 'Неделя' }, { id: 'month', label: 'Месяц' }] as { id: CalendarMode; label: string }[]).map(item => <button role="tab" aria-selected={mode === item.id} className={mode === item.id ? 'active' : ''} key={item.id} onClick={() => setMode(item.id)}>{item.label}</button>)}</div>
    {mode === 'month' && <MonthPicker selected={selected} today={today} counts={counts} onSelect={chooseDate} />}
    <div className="task-progress"><div className="task-progress-caption"><div><span className="caps-label">ПРОГРЕСС {mode === 'day' ? 'ДНЯ' : mode === 'week' ? 'НЕДЕЛИ' : 'МЕСЯЦА'}</span><strong>{totals.done} <span>из {totals.count}</span></strong></div><span className="progress-percent">{percentage}%</span></div><div className="progress-track" role="progressbar" aria-valuenow={totals.done} aria-valuemin={0} aria-valuemax={totals.count || 1}><div className="progress-fill" style={{ width: `${percentage}%` }} /></div></div>
    <section className="payment-calendar-card"><div className="payment-calendar-heading"><span className="payment-calendar-icon"><Wallet size={20}/></span><div><strong>Платежи в календаре</strong><small>{mode === 'day' && paymentsOnSelectedDate.length ? `${paymentsOnSelectedDate.length} на выбранную дату · смотри в группах ниже` : 'Появляются только в дату оплаты'}</small></div><button disabled={storage !== 'ready'} onClick={() => add('payment')}><Plus size={16}/> Платёж</button></div></section>
    <div className="planner-tools">
      <div className="planner-filter-label"><ListFilter size={15} /> Вид задач</div>
      <div className="filter-pills">{([{ id: 'all', text: 'Все' }, { id: 'open', text: 'Открытые' }, { id: 'done', text: 'Готово' }] as { id: StatusFilter; text: string }[]).map(item => <button key={item.id} className={statusFilter === item.id ? 'active' : ''} onClick={() => setStatusFilter(item.id)}>{item.text}</button>)}</div>
      <div className="filter-selects"><select aria-label="Фильтр по группе" value={groupFilter} onChange={event => setGroupFilter(event.target.value)}><option value="all">Все группы</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select><select aria-label="Сортировка задач" value={sortMode} onChange={event => setSortMode(event.target.value as SortMode)}><option value="time">По времени</option><option value="priority">По важности</option><option value="newest">Сначала новые</option></select></div>
    </div>

    <div className="section-title tasks-title"><h2>{mode === 'day' ? 'Мои группы' : mode === 'week' ? 'Дни недели' : 'Дела месяца'}</h2>{mode === 'day' ? <button className="group-settings" onClick={() => manageGroups()}><Settings2 size={15} /> Настроить группы</button> : <span>{dates.length} дней</span>}</div>
    {storage === 'loading' && <div className="empty-day"><span>Загружаем сохранённые задачи…</span></div>}
    {storage === 'error' && <div className="empty-day"><strong>Хранилище недоступно</strong><span>Проверь настройки Safari или открой приложение снова.</span></div>}

    {storage === 'ready' && mode === 'day' && <div className="task-groups">
      {groups.map(group => {
        const rows = shownDay.filter(row => row.task.group === group.id)
        if (!rows.length) return null
        const groupAll = dailyAll.filter(row => row.task.group === group.id)
        const complete = groupAll.filter(row => row.done).length
        const expanded = openGroups.includes(group.id)
        return <section className="task-group" key={group.id}>
          <button className="group-heading" onClick={() => setOpenGroups(old => old.includes(group.id) ? old.filter(item => item !== group.id) : [...old, group.id])} aria-expanded={expanded}><span className="group-emoji">{group.emoji}</span><span className="group-name"><strong>{group.name}</strong><small>{group.note}</small></span><span className="group-count">{complete}/{groupAll.length}</span><ChevronDown className={expanded ? 'up' : ''} size={18} strokeWidth={1.8} /></button>
          {expanded && <div className="group-rows">{rows.map(row => <div key={row.task.id} className={`task-row ${row.done ? 'done' : ''}`}>
            <button className="task-toggle" onClick={() => void onToggle(row)} aria-label={`${row.done ? 'Отменить выполнение' : row.task.kind === 'payment' ? 'Отметить оплату' : 'Выполнить'}: ${row.task.text}`} aria-pressed={row.done} disabled={saving}><span className="task-check">{row.done && <Check size={16} strokeWidth={2.6} />}</span><span className="task-content"><span className="task-text">{row.task.kind === 'payment' && <Wallet size={14} className="payment-inline-icon"/>}{row.task.text}{row.task.payment && <span className="task-payment-amount"> · {paymentLabel(row.task.payment)}</span>}</span>{(row.task.time || row.task.priority === 'high' || row.recurring || row.task.collectionItemId) && <small>{row.task.time && `${row.task.time} · `}{row.task.priority === 'high' && 'Важное · '}{row.recurring && <><Repeat2 size={10} /> {repeatLabels[recurrenceOf(row.task)]}</>}{row.task.collectionItemId && <> · Из списка</>}</small>}</span></button>
            <button className="task-edit" onClick={() => edit(row.task)} aria-label={`Изменить задачу: ${row.task.text}`} disabled={saving}><Pencil size={16} /></button>
          </div>)}</div>}
        </section>
      })}
      {!shownDay.length && <div className="empty-day"><CalendarDays size={28} strokeWidth={1.3} /><strong>{dailyAll.length ? 'По фильтру ничего нет' : 'Этот день пока свободен'}</strong><span>{dailyAll.length ? 'Попробуй показать все задачи.' : 'Добавь первое дело. Время необязательно.'}</span></div>}
    </div>}

    {storage === 'ready' && mode !== 'day' && <div className="period-list">
      {period.filter(day => day.filtered.length > 0).map(day => <button className="period-day" key={day.date} onClick={() => chooseDate(day.date)}>
        <span className="period-day-date"><strong>{localDate(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}</strong><small>{day.all.filter(row => row.done).length}/{day.all.length} выполнено</small></span>
        <span className="period-day-tasks">{day.filtered.slice(0, 3).map(row => <span key={row.task.id} className={row.done ? 'is-done' : ''}>{row.done ? '✓' : '○'} {row.task.text}{row.task.payment ? ` · ${paymentLabel(row.task.payment)}` : ''}</span>)}{day.filtered.length > 3 && <small>+ ещё {day.filtered.length - 3}</small>}</span><ChevronRight size={17} />
      </button>)}
      {period.every(day => !day.filtered.length) && <div className="empty-day"><CalendarDays size={28} strokeWidth={1.3} /><strong>{totals.count ? 'По фильтру ничего нет' : 'На этот период нет задач'}</strong><span>Нажми «+» и добавь дело на выбранную дату.</span></div>}
    </div>}
    <button className="add-inline" onClick={() => add()} disabled={storage !== 'ready'}><CirclePlus size={20} strokeWidth={1.6} /><span>Добавить задачу</span><ArrowRight size={18} /></button>
    {storage === 'ready' && mode === 'day' && canAddSamples && <div className="sample-task-prompt"><div><Sparkles size={17}/><span>Хочешь проверить планер? Добавь {SAMPLE_TASK_COUNT} примеров на сегодня. Это не настоящие дела, их можно удалить.</span></div><button type="button" disabled={saving} onClick={() => void addSamples()}>Добавить примеры</button>{samplesError && <small role="alert">{samplesError}</small>}</div>}
    {mode === 'day' && <><QuestPanel key={selected} date={selected} today={today} records={questCompletions} ready={storage === 'ready'} savingId={questSavingId} lightEnabled={lightDay(dayModes, selected)} lightSaving={saving} onToggle={onToggleQuest} onToggleLight={onToggleLight}/>
      <TrackerPanel date={selected} trackers={trackers} readings={trackerReadings} ready={storage === 'ready'} saving={saving} onSave={onSaveTracker} onRecord={onRecordTracker}/></>}
    <button className="floating-add" aria-label="Добавить задачу" onClick={() => add()} disabled={storage !== 'ready'}><Plus size={29} strokeWidth={1.8} /></button>

    {managingGroups && <GroupManager groups={groups} tasks={tasks} saving={saving} onSave={onSaveGroup} onClose={closeGroupManager} />}

    {dialog && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setDialog(false) }}>
      <form className="task-modal" onSubmit={event => void submit(event)}>
        <div className="modal-handle" />
        <div className="modal-heading"><div><p className="eyebrow">{draft.kind === 'payment' ? 'КАЛЕНДАРЬ / ПЛАТЁЖ' : editing ? 'РЕДАКТИРОВАНИЕ' : 'НОВАЯ ЗАДАЧА'}</p><h2>{draft.kind === 'payment' ? editing ? 'Изменить платёж' : 'Новый платёж' : editing ? 'Изменить дело' : 'Добавить дело'}</h2></div><button type="button" className="close-button" aria-label="Закрыть" onClick={() => setDialog(false)} disabled={saving}><X size={21} /></button></div>
        <label className="form-label" htmlFor="task-text">Название</label><input autoFocus id="task-text" required value={draft.text} onChange={event => setDraft(old => ({ ...old, text: event.target.value }))} placeholder={draft.kind === 'payment' ? 'Например, аренда квартиры' : 'Что нужно сделать?'} maxLength={140} />
        <div className="task-group-label"><label className="form-label" htmlFor="task-group">Группа</label><button type="button" onClick={() => manageGroups(true)}><Settings2 size={14}/> Добавить / удалить</button></div><select id="task-group" value={draft.group} onChange={event => setDraft(old => ({ ...old, group: event.target.value }))}>{groups.filter(group => !group.archived || group.id === draft.group).map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
        {draft.kind === 'payment' && <div className="payment-form-amount"><div><label className="form-label" htmlFor="payment-amount">Сумма</label><input name="payment-amount" id="payment-amount" type="text" inputMode="decimal" required placeholder="Например, 800" value={draft.paymentAmount} onChange={event => setDraft(old => ({ ...old, paymentAmount: event.target.value }))}/></div><div><label className="form-label" htmlFor="payment-currency">Валюта</label><select id="payment-currency" value={draft.paymentCurrency} onChange={event => setDraft(old => ({ ...old, paymentCurrency: event.target.value as PaymentCurrency }))}><option value="USD">USD · $</option><option value="GEL">GEL · ₾</option><option value="RUB">RUB · ₽</option></select></div></div>}
        <div className="form-grid"><div><label className="form-label" htmlFor="task-date">Дата начала</label><input name="task-date" id="task-date" type="date" required value={draft.date} onChange={event => setDraft(old => ({ ...old, date: event.target.value }))} /></div><div><label className="form-label" htmlFor="task-time">Время, если нужно</label><input name="task-time" id="task-time" type="time" value={draft.time} onChange={event => setDraft(old => ({ ...old, time: event.target.value }))} /></div></div>
        <label className="form-label" htmlFor="task-repeat">Повторение</label><select id="task-repeat" value={draft.repeat} disabled={!!editing?.collectionItemId} onChange={event => setDraft(old => ({ ...old, repeat: event.target.value as RepeatRule, repeatUntil: '' }))}>{(Object.keys(repeatLabels) as RepeatRule[]).map(rule => <option key={rule} value={rule}>{repeatLabels[rule]}</option>)}</select>
        {editing?.collectionItemId && <p className="repeat-help">Эта задача связана с коллекцией. Повторы отключены, чтобы пункт не засчитывался несколько раз.</p>}
        {draft.repeat !== 'none' && <><label className="form-label" htmlFor="task-repeat-until">Повторять до (необязательно)</label><input name="task-repeat-until" id="task-repeat-until" type="date" min={draft.date} value={draft.repeatUntil} onChange={event => setDraft(old => ({ ...old, repeatUntil: event.target.value }))}/><p className="repeat-help">{draft.kind === 'payment' ? 'Для аренды 10-го числа выбери дату начала 10-го и «Раз в месяц». В коротких месяцах 29–31 число переносится на последний день.' : 'У каждого дня собственная отметка выполнения. Изменение параметров меняет всю серию.'}</p></>}
        <label className="form-label" htmlFor="task-priority">Приоритет</label><select id="task-priority" value={draft.priority} onChange={event => setDraft(old => ({ ...old, priority: event.target.value as TaskPriority }))}><option value="normal">Обычный</option><option value="high">Важный</option><option value="low">Невысокий</option></select>
        <label className="form-label" htmlFor="task-notes">Заметка, если нужна</label><textarea id="task-notes" rows={2} maxLength={4000} value={draft.notes} onChange={event => setDraft(old => ({ ...old, notes: event.target.value }))} placeholder="Детали, адрес, напоминание…" />
        <div className="modal-date"><Clock3 size={16} /> {draft.kind === 'payment' ? 'Время необязательно. Это запись в календаре, не банковский автоплатёж и не push-уведомление.' : 'Без времени — полноценная задача'}</div>
        {modalError && <p className="form-error" role="alert">{modalError}</p>}
        <button className="submit-task" type="submit" disabled={!draft.text.trim() || !draft.date || (draft.repeatUntil !== '' && draft.repeatUntil < draft.date) || (draft.kind === 'payment' && !draft.paymentAmount.trim()) || saving}>{saving ? 'Сохраняем…' : editing ? 'Сохранить изменения' : draft.kind === 'payment' ? 'Добавить платёж' : 'Добавить задачу'} <ArrowRight size={18} /></button>
        {editing && <div className="delete-zone">{confirmDelete ? <><span>{recurrenceOf(editing) === 'none' ? 'Переместить задачу в корзину?' : 'Переместить всю серию в корзину?'}</span><button type="button" className="delete-confirm" onClick={() => void remove()} disabled={saving}>Да, удалить</button><button type="button" onClick={() => setConfirmDelete(false)}>Отмена</button></> : <button type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> {recurrenceOf(editing) === 'none' ? 'Удалить задачу' : 'Удалить серию'}</button>}</div>}
      </form>
    </div>}
  </div>
}
