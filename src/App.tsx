import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, Download, House,
  LayoutList, Moon, NotebookPen, RotateCcw, Settings2, ShieldCheck,
  Sparkles, Trash2, TrendingUp, Upload, X,
} from 'lucide-react'
import { dateKey, defaultGroups, localDate, type GroupItem, type OccurrenceItem, type TaskItem } from './demo'
import { occurrenceId, recurrenceOf, scheduledForDate, type ScheduledTask } from './schedule'
import { createBackup, parseBackup, readAllData, replaceAllData, writeGroup, writeOccurrence, writeTask, type AppData } from './storage'
import Planner, { type TaskDraft } from './Planner'
import type { GroupDraft } from './GroupManager'

type Tab = 'home' | 'today' | 'lists' | 'journal' | 'progress'
type StorageState = 'loading' | 'ready' | 'error'

const nav = [
  { id: 'home' as Tab, name: 'Дом', Icon: House },
  { id: 'today' as Tab, name: 'Сегодня', Icon: LayoutList },
  { id: 'lists' as Tab, name: 'Списки', Icon: BookOpen },
  { id: 'journal' as Tab, name: 'Дневник', Icon: NotebookPen },
  { id: 'progress' as Tab, name: 'Прогресс', Icon: TrendingUp },
]

function taskCount(count: number) {
  const ending = count % 10 === 1 && count % 100 !== 11 ? 'задача'
    : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'задачи' : 'задач'
  return `${count} ${ending}`
}

function Home({ onToday, tasks, occurrences, today, ready }: { onToday: () => void; tasks: TaskItem[]; occurrences: OccurrenceItem[]; today: string; ready: boolean }) {
  const daily = scheduledForDate(tasks, occurrences, today)
  const done = daily.filter(row => row.done).length
  const total = daily.length
  return <div className="page home-page">
    <div className="page-intro"><p className="eyebrow">ГЛАВА 01 <span className="eyebrow-dot">·</span> ПРОБУЖДЕНИЕ</p><h1>Твоя база<span className="mint-period">.</span></h1><p className="lead">Маленькие действия. Настоящая жизнь.</p></div>
    <section className="room-card" aria-label="Комната и персонаж Дмитрия по утверждённому изображению"><div className="room-topline"><span><span className="room-light" /> ЛИЧНОЕ ПРОСТРАНСТВО</span><span>01 / 01</span></div><div className="room-art"><img className="room-image" src={`${import.meta.env.BASE_URL}images/base-room-photo-v2.jpeg`} alt="Дмитрий в комнате с бетонными стенами, деревянным столом, креслами и видом на море в Батуми" /></div><div className="room-caption"><span>ДМИТРИЙ <i /> LVL 01</span><span className="room-chapter">BASE / ROOM</span></div></section>
    <section className="level-card"><div className="level-top"><div><p className="small-label">ТЕКУЩИЙ УРОВЕНЬ</p><div className="level-name"><span className="level-number">01</span><div><strong>Пробуждение</strong><small>Начало пути</small></div></div></div><div className="level-xp"><strong>0 <span>XP</span></strong><small>из 700</small></div></div><div className="progress-track" role="progressbar" aria-valuenow={0} aria-valuemin={0} aria-valuemax={700}><div className="progress-fill" style={{ width: '0%' }}/></div></section>
    <div className="section-title home-section-title"><h2>Твой день</h2><span>{localDate(today, { day: 'numeric', month: 'long' })}</span></div>
    <div className="daily-metrics"><div className="metric-card"><span className="metric-icon"><Sparkles size={17} strokeWidth={1.6} /></span><small>Энергия</small><strong>— <span>/ 10</span></strong><em>Нет записи</em></div><div className="metric-card"><span className="metric-icon"><Moon size={17} strokeWidth={1.6} /></span><small>Сон</small><strong>— <span>ч</span></strong><em>Нет записи</em></div><div className="metric-card"><span className="metric-icon"><Check size={17} strokeWidth={1.6} /></span><small>Задачи</small><strong>{ready ? done : '—'} <span>/ {ready ? total : '—'}</span></strong><em>{ready ? 'Мой план' : 'Загрузка'}</em></div></div>
    <button className="today-preview" onClick={onToday}><div className="today-preview-icon"><CalendarDays size={20} strokeWidth={1.7} /></div><div className="today-preview-text"><strong>Открыть план на сегодня</strong><span>{ready ? (total ? `${taskCount(total)} · ${done} выполнено` : 'Пока нет задач. Начни с одной.') : 'Загружаем твой план…'}</span></div><ArrowUpRight size={19} /></button>
  </div>
}

function FutureScreen({ tab, onToday }: { tab: Tab; onToday: () => void }) {
  const label = nav.find(item => item.id === tab)?.name ?? 'Раздел'
  const notes: Record<string, string> = {
    lists: 'Коллекции книг, фильмов, мест и идей появятся на следующем этапе.',
    journal: 'Сон, энергия, настроение, дневные записи и вечерний отчёт появятся на следующем этапе.',
    progress: 'Здесь будут шесть характеристик, реальные XP, уровни и достижения.',
  }
  return <div className="page future-screen"><p className="eyebrow">BASE / В РАЗРАБОТКЕ</p><h1>{label}<span className="mint-period">.</span></h1><div className="future-placeholder"><span className="future-symbol">✳</span><h2>Следующий этап</h2><p>{notes[tab]}</p><button onClick={onToday}>Вернуться в планер <ArrowRight size={17} /></button></div></div>
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [today, setToday] = useState(() => dateKey(new Date()))
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [groups, setGroups] = useState<GroupItem[]>(defaultGroups)
  const [occurrences, setOccurrences] = useState<OccurrenceItem[]>([])
  const [storage, setStorage] = useState<StorageState>('loading')
  const [storageError, setStorageError] = useState('')
  const [saving, setSaving] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [pendingImport, setPendingImport] = useState<AppData | null>(null)
  const [importError, setImportError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    function apply(data: AppData) {
      if (!active) return
      setTasks(data.tasks)
      setGroups(data.groups)
      setOccurrences(data.occurrences)
      setStorage('ready')
    }
    readAllData().then(apply).catch(error => { if (active) { setStorage('error'); setStorageError(error instanceof Error ? error.message : 'Хранилище недоступно.') } })
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      setToday(dateKey(new Date()))
      readAllData().then(apply).catch(() => { if (active) { setStorage('error'); setStorageError('Не удалось перечитать записи.') } })
    }
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; document.removeEventListener('visibilitychange', refresh) }
  }, [])
  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  async function save(draft: TaskDraft, existing?: TaskItem) {
    if (storage !== 'ready' || saving) throw new Error('Хранилище пока недоступно.')
    if (!groups.some(group => group.id === draft.group)) throw new Error('Выбранная группа не найдена.')
    if (draft.repeatUntil && draft.repeatUntil < draft.date) throw new Error('Дата окончания не может быть раньше начала.')
    const timestamp = new Date().toISOString()
    const repeat = draft.repeat
    const task: TaskItem = {
      id: existing?.id ?? (crypto.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      text: draft.text.trim(), group: draft.group, date: draft.date, time: draft.time || null,
      notes: draft.notes, priority: draft.priority, repeat, repeatUntil: repeat === 'none' ? null : draft.repeatUntil || null,
      done: repeat === 'none' ? existing?.done ?? false : false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      completedAt: repeat === 'none' ? existing?.completedAt ?? null : null, deletedAt: null,
    }
    setSaving(true)
    try {
      await writeTask(task)
      setTasks(old => [...old.filter(row => row.id !== task.id), task])
      setNotice(existing ? 'Изменения сохранены' : 'Задача сохранена на устройстве')
    } finally { setSaving(false) }
  }

  async function toggle(scheduled: ScheduledTask) {
    if (saving || storage !== 'ready') return
    const timestamp = new Date().toISOString()
    setSaving(true)
    try {
      if (scheduled.recurring) {
        const changed: OccurrenceItem = {
          id: occurrenceId(scheduled.task.id, scheduled.date), taskId: scheduled.task.id, date: scheduled.date,
          done: !scheduled.done, updatedAt: timestamp, completedAt: !scheduled.done ? timestamp : null,
        }
        await writeOccurrence(changed)
        setOccurrences(old => [...old.filter(record => record.id !== changed.id), changed])
      } else {
        const changed = { ...scheduled.task, done: !scheduled.done, updatedAt: timestamp, completedAt: !scheduled.done ? timestamp : null }
        await writeTask(changed)
        setTasks(old => old.map(task => task.id === changed.id ? changed : task))
      }
    } catch { setNotice('Не удалось сохранить отметку. Попробуй снова.') }
    finally { setSaving(false) }
  }

  async function remove(task: TaskItem) {
    if (saving || storage !== 'ready') throw new Error('Хранилище недоступно.')
    const timestamp = new Date().toISOString()
    const changed = { ...task, deletedAt: timestamp, updatedAt: timestamp }
    setSaving(true)
    try {
      await writeTask(changed)
      setTasks(old => old.map(row => row.id === task.id ? changed : row))
      setNotice(recurrenceOf(task) === 'none' ? 'Задача перемещена в корзину' : 'Серия повторов перемещена в корзину')
    } finally { setSaving(false) }
  }

  async function restore(task: TaskItem) {
    if (saving) return
    const changed = { ...task, deletedAt: null, updatedAt: new Date().toISOString() }
    setSaving(true)
    try { await writeTask(changed); setTasks(old => old.map(row => row.id === task.id ? changed : row)); setNotice('Задача восстановлена') }
    catch { setNotice('Не удалось восстановить задачу.') }
    finally { setSaving(false) }
  }

  async function saveGroup(draft: GroupDraft, existing?: GroupItem) {
    if (storage !== 'ready' || saving) throw new Error('Хранилище недоступно.')
    const name = draft.name.trim()
    if (!name) throw new Error('Введи название группы.')
    if (groups.some(group => group.id !== existing?.id && group.name.trim().toLowerCase() === name.toLowerCase())) throw new Error('Группа с таким названием уже существует.')
    if (draft.archived && !existing?.archived && tasks.some(task => task.group === existing?.id && !task.deletedAt)) throw new Error('Сначала перенеси активные задачи в другие группы.')
    const group: GroupItem = {
      id: existing?.id ?? (crypto.randomUUID?.() ?? `group-${Date.now()}`),
      name, emoji: draft.emoji.trim() || '✳', note: draft.note.trim(),
      order: existing?.order ?? Math.max(-1, ...groups.map(item => item.order)) + 1,
      archived: draft.archived ?? false,
    }
    setSaving(true)
    try {
      await writeGroup(group)
      setGroups(old => [...old.filter(item => item.id !== group.id), group].sort((a, b) => a.order - b.order))
      setNotice(existing ? 'Группа обновлена' : 'Группа создана')
    } finally { setSaving(false) }
  }

  function exportBackup() {
    if (storage !== 'ready') return
    const file = new File([JSON.stringify(createBackup({ tasks, groups, occurrences }), null, 2)], `BASE-backup-${dateKey(new Date())}.json`, { type: 'application/json' })
    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      void navigator.share({ title: 'Резервная копия BASE: REBUILD', files: [file] }).catch(error => {
        if (error instanceof Error && error.name !== 'AbortError') setNotice('Не удалось поделиться файлом. Попробуй ещё раз.')
      })
    } else {
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = file.name; document.body.appendChild(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
      setNotice('Файл резервной копии подготовлен')
    }
  }

  async function onBackupFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPendingImport(null); setImportError('')
    if (file.size > 10_000_000) { setImportError('Файл слишком большой (больше 10 МБ).'); return }
    try { setPendingImport(parseBackup(JSON.parse(await file.text()))) }
    catch (error) { setImportError(error instanceof Error ? error.message : 'Не удалось прочитать JSON.') }
  }
  async function confirmImport() {
    if (!pendingImport || saving) return
    setSaving(true)
    try {
      await replaceAllData(pendingImport)
      setTasks(pendingImport.tasks); setGroups(pendingImport.groups); setOccurrences(pendingImport.occurrences)
      setPendingImport(null); setImportError(''); setNotice('Данные восстановлены из резервной копии')
      setInfoOpen(false)
    } catch (error) { setImportError(error instanceof Error ? error.message : 'Не удалось восстановить данные.') }
    finally { setSaving(false) }
  }

  const deleted = tasks.filter(task => task.deletedAt)
  return <div className="app-shell">
    <header className="app-header"><button className="brand" onClick={() => setTab('home')} aria-label="BASE: REBUILD, перейти домой"><span className="brand-mark">B<span>·</span></span><span className="brand-words">BASE<span>REBUILD / 0.5</span></span></button><div className="header-right"><span className="demo-chip"><i /> {storage === 'ready' ? 'ЛОКАЛЬНО' : storage === 'loading' ? 'ЗАГРУЗКА' : 'ОШИБКА'}</span><button className="header-settings" onClick={() => setInfoOpen(true)} aria-label="Данные и резервные копии"><Settings2 size={19} strokeWidth={1.7} /></button></div></header>
    {storage === 'error' && <div className="storage-alert" role="alert"><strong>Данные недоступны</strong><span>{storageError} Новые задачи не будут записываться.</span></div>}
    <main className="app-main">{tab === 'home' ? <Home today={today} tasks={tasks} occurrences={occurrences} ready={storage === 'ready'} onToday={() => setTab('today')} /> : tab === 'today' ? <Planner today={today} tasks={tasks} groups={groups} occurrences={occurrences} storage={storage} saving={saving} onSave={save} onToggle={toggle} onDelete={remove} onSaveGroup={saveGroup} /> : <FutureScreen tab={tab} onToday={() => setTab('today')} />}</main>
    <nav className="bottom-nav" aria-label="Основная навигация">{nav.map(({ id, name, Icon }) => <button key={id} className={tab === id ? 'current' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon size={21} strokeWidth={tab === id ? 2 : 1.7} /><span>{name}</span>{tab === id && <i />}</button>)}</nav>
    {!!notice && <div className="app-notice" role="status"><span>{notice}</span><button aria-label="Закрыть уведомление" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {infoOpen && <div className="modal-backdrop info-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setInfoOpen(false) }}>
      <div className="info-dialog data-dialog"><button aria-label="Закрыть" className="close-button" onClick={() => setInfoOpen(false)} disabled={saving}><X size={22} /></button>
        <span className="info-icon"><ShieldCheck size={31} /></span><h2>Данные BASE v0.5</h2>
        <p>Все задачи, группы и отметки повторов сохраняются в IndexedDB на этом устройстве. Они остаются после перезагрузки, но не синхронизируются с другими устройствами или ChatGPT. Очистка данных Safari может их удалить.</p>
        <div className="data-status"><span>Активных задач и серий</span><strong>{tasks.filter(task => !task.deletedAt).length}</strong></div>
        <button className="data-action" onClick={exportBackup} disabled={storage !== 'ready' || saving}><Download size={18} /> Сохранить резервную копию JSON</button>
        <button className="data-action secondary" onClick={() => fileInput.current?.click()} disabled={storage !== 'ready' || saving}><Upload size={18} /> Восстановить из JSON</button>
        <input ref={fileInput} type="file" accept=".json,application/json" className="hidden-input" onChange={event => void onBackupFile(event)} aria-label="Выбрать резервную копию" />
        {!!importError && <p className="form-error" role="alert">{importError}</p>}
        {pendingImport && <div className="import-warning" role="alert"><strong>Найдено {pendingImport.tasks.filter(task => !task.deletedAt).length} задач и серий</strong><p>Восстановление заменит все текущие локальные задачи, группы, отметки повторов и корзину. Перед этим сохрани свою резервную копию.</p><button onClick={() => void confirmImport()} disabled={saving}>{saving ? 'Восстанавливаем…' : 'Подтвердить замену'}</button><button onClick={() => setPendingImport(null)} disabled={saving}>Отмена</button></div>}
        {deleted.length > 0 && <div className="trash-list"><h3><Trash2 size={15} /> Корзина · {deleted.length}</h3>{deleted.map(task => <div key={task.id}><span>{task.text}</span><button onClick={() => void restore(task)} disabled={saving} aria-label={`Вернуть задачу: ${task.text}`}><RotateCcw size={17} /></button></div>)}</div>}
        <p className="data-footnote">Резервные копии версии 0.3 также поддерживаются. Дневник, коллекции и RPG-прогресс подключим отдельно. За обычные задачи XP пока не начисляется.</p>
      </div>
    </div>}
    <div className="desktop-side-note">BASE: REBUILD <span>PERSONAL LIFE SIMULATOR · LOCAL PLANNER</span></div>
  </div>
}
