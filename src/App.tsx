import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight, BookOpen, CalendarDays, Check, Download, House,
  LayoutList, Moon, NotebookPen, RotateCcw, Settings2, ShieldCheck,
  Sparkles, Trash2, TrendingUp, Upload, X,
} from 'lucide-react'
import { dateKey, defaultGroups, localDate, type GroupItem, type OccurrenceItem, type TaskItem } from './demo'
import { defaultCollections, linkedTask, setEntryDone, setTaskDone, type CollectionItem, type ListEntry } from './collections'
import { sleepHours, type DailyReport, type JournalEntry, type TaskMove } from './journal'
import { XP_PER_LEVEL, QUESTS, experience, questRecordId, type QuestCompletion, type QuestId } from './rpg'
import { occurrenceId, recurrenceOf, scheduledForDate, type ScheduledTask } from './schedule'
import { createBackup, parseBackup, readAllData, replaceAllData, writeCollection, writeCollectionEntry, writeDailyReport, writeEntryPair, writeGroup, writeJournal, writeLinkedTaskAndEntry, writeOccurrence, writeQuestCompletion, writeTask, writeTaskAndMove, type AppData } from './storage'
import Planner, { type TaskDraft } from './Planner'
import type { GroupDraft } from './GroupManager'
import Lists, { type CollectionDraft, type EntryDraft } from './Lists'
import Journal from './Journal'
import Progress from './Progress'

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

function dayCount(count: number) {
  const end = count % 10 === 1 && count % 100 !== 11 ? 'день'
    : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'дня' : 'дней'
  return `${count} ${end}`
}

function taskMove(task: TaskItem, oldDate: string, movedAt: string): TaskMove {
  return { id: crypto.randomUUID?.() ?? `move-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    taskId: task.id, taskTitle: task.text, fromDate: oldDate, toDate: task.date, movedAt }
}

function Home({ onToday, onJournal, tasks, occurrences, journals, questCompletions, today, ready }: { onToday: () => void; onJournal: () => void; tasks: TaskItem[]; occurrences: OccurrenceItem[]; journals: JournalEntry[]; questCompletions: QuestCompletion[]; today: string; ready: boolean }) {
  const daily = scheduledForDate(tasks, occurrences, today)
  const done = daily.filter(row => row.done).length
  const total = daily.length
  const journal = journals.find(item => item.date === today)
  const sleep = sleepHours(journal?.sleepAt ?? null, journal?.wakeAt ?? null)
  const xp = experience(questCompletions)
  return <div className="page home-page">
    <div className="page-intro"><p className="eyebrow">ГЛАВА {String(Math.min(xp.level,10)).padStart(2,'0')} <span className="eyebrow-dot">·</span> {xp.title.toUpperCase()}</p><h1>Твоя база<span className="mint-period">.</span></h1><p className="lead">Маленькие действия. Настоящая жизнь.</p></div>
    <section className="room-card" aria-label="Комната и персонаж Дмитрия по утверждённому изображению"><div className="room-topline"><span><span className="room-light" /> ЛИЧНОЕ ПРОСТРАНСТВО</span><span>01 / 01</span></div><div className="room-art"><img className="room-image" src={`${import.meta.env.BASE_URL}images/base-room-photo-v2.jpeg`} alt="Дмитрий в комнате с бетонными стенами, деревянным столом, креслами и видом на море в Батуми" /></div><div className="room-caption"><span>ДМИТРИЙ <i /> LVL {String(xp.level).padStart(2,'0')}</span><span className="room-chapter">BASE / ROOM</span></div></section>
    <section className="level-card"><div className="level-top"><div><p className="small-label">ТЕКУЩИЙ УРОВЕНЬ</p><div className="level-name"><span className="level-number">{String(xp.level).padStart(2,'0')}</span><div><strong>{xp.title}</strong><small>{xp.activeDays ? `${dayCount(xp.activeDays)} с выполненными квестами` : 'Начало пути'}</small></div></div></div><div className="level-xp"><strong>{xp.levelXp} <span>XP</span></strong><small>из {XP_PER_LEVEL}</small></div></div><div className="progress-track" role="progressbar" aria-valuenow={xp.levelXp} aria-valuemin={0} aria-valuemax={XP_PER_LEVEL}><div className="progress-fill" style={{ width: `${xp.levelPercent}%` }}/></div></section>
    <div className="section-title home-section-title"><h2>Твой день</h2><span>{localDate(today, { day: 'numeric', month: 'long' })}</span></div>
    <div className="daily-metrics"><div className="metric-card"><span className="metric-icon"><Sparkles size={17} strokeWidth={1.6} /></span><small>Энергия</small><strong>{journal?.energy ?? '—'} <span>/ 10</span></strong><em>{journal?.energy == null ? 'Нет записи' : 'Из дневника'}</em></div><div className="metric-card"><span className="metric-icon"><Moon size={17} strokeWidth={1.6} /></span><small>Сон</small><strong>{sleep == null ? '—' : sleep.toLocaleString('ru-RU')} <span>ч</span></strong><em>{sleep == null ? 'Нет расчёта' : 'По времени сна'}</em></div><div className="metric-card"><span className="metric-icon"><Check size={17} strokeWidth={1.6} /></span><small>Задачи</small><strong>{ready ? done : '—'} <span>/ {ready ? total : '—'}</span></strong><em>{ready ? 'Мой план' : 'Загрузка'}</em></div></div>
    <button className="today-preview" onClick={onToday}><div className="today-preview-icon"><CalendarDays size={20} strokeWidth={1.7} /></div><div className="today-preview-text"><strong>Открыть план на сегодня</strong><span>{ready ? (total ? `${taskCount(total)} · ${done} выполнено` : 'Пока нет задач. Начни с одной.') : 'Загружаем твой план…'}</span></div><ArrowUpRight size={19} /></button>
    <button className="today-preview" onClick={onJournal}><div className="today-preview-icon"><NotebookPen size={20} strokeWidth={1.7}/></div><div className="today-preview-text"><strong>Дневник и итоги дня</strong><span>Записать состояние и подготовить отчёт</span></div><ArrowUpRight size={19}/></button>
  </div>
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [today, setToday] = useState(() => dateKey(new Date()))
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [groups, setGroups] = useState<GroupItem[]>(defaultGroups)
  const [occurrences, setOccurrences] = useState<OccurrenceItem[]>([])
  const [collections, setCollections] = useState<CollectionItem[]>(defaultCollections)
  const [collectionEntries, setCollectionEntries] = useState<ListEntry[]>([])
  const [journals, setJournals] = useState<JournalEntry[]>([])
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([])
  const [taskMoves, setTaskMoves] = useState<TaskMove[]>([])
  const [questCompletions, setQuestCompletions] = useState<QuestCompletion[]>([])
  const [questSavingId, setQuestSavingId] = useState<string | null>(null)
  const questWriteLock = useRef(false)
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
      setCollections(data.collections)
      setCollectionEntries(data.collectionEntries)
      setJournals(data.journals)
      setDailyReports(data.dailyReports)
      setTaskMoves(data.taskMoves)
      setQuestCompletions(data.questCompletions)
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
    if (existing?.collectionItemId && repeat !== 'none') throw new Error('Связанная с коллекцией задача не может повторяться.')
    const task: TaskItem = {
      id: existing?.id ?? (crypto.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      text: draft.text.trim(), group: draft.group, date: draft.date, time: draft.time || null,
      notes: draft.notes, priority: draft.priority, repeat, repeatUntil: repeat === 'none' ? null : draft.repeatUntil || null,
      done: repeat === 'none' ? existing?.done ?? false : false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      completedAt: repeat === 'none' ? existing?.completedAt ?? null : null, deletedAt: null,
      collectionItemId: existing?.collectionItemId ?? null,
    }
    setSaving(true)
    try {
      const move = existing && existing.date !== task.date ? taskMove(task, existing.date, timestamp) : null
      if (move) { await writeTaskAndMove(task, move); setTaskMoves(old => [...old, move]) }
      else await writeTask(task)
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
        const changed = setTaskDone(scheduled.task, !scheduled.done, timestamp)
        const entry = collectionEntries.find(item => item.id === changed.collectionItemId)
        if (entry && !entry.deletedAt) {
          const linked = setEntryDone(entry, changed.done, timestamp)
          await writeLinkedTaskAndEntry(changed, linked)
          setCollectionEntries(old => old.map(item => item.id === linked.id ? linked : item))
        } else await writeTask(changed)
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

  async function saveCollection(draft: CollectionDraft, existing?: CollectionItem) {
    if (storage !== 'ready' || saving) throw new Error('Хранилище недоступно.')
    const name = draft.name.trim()
    if (!name) throw new Error('Введи название коллекции.')
    if (collections.some(item => item.id !== existing?.id && item.name.trim().toLowerCase() === name.toLowerCase())) throw new Error('Коллекция с таким названием уже существует.')
    const collection: CollectionItem = {
      id: existing?.id ?? (crypto.randomUUID?.() ?? `collection-${Date.now()}`),
      name: name.slice(0, 70), emoji: draft.emoji.trim().slice(0, 8) || '✳', note: draft.note.trim().slice(0, 200),
      order: existing?.order ?? Math.max(-1, ...collections.map(item => item.order)) + 1,
      archived: draft.archived ?? existing?.archived ?? false,
    }
    setSaving(true)
    try {
      await writeCollection(collection)
      setCollections(old => [...old.filter(item => item.id !== collection.id), collection].sort((a, b) => a.order - b.order))
      setNotice(existing ? 'Коллекция обновлена' : 'Коллекция создана')
    } finally { setSaving(false) }
  }

  async function saveEntry(draft: EntryDraft, existing?: ListEntry) {
    if (storage !== 'ready' || saving) throw new Error('Хранилище недоступно.')
    if (!collections.some(item => item.id === draft.collectionId && !item.archived)) throw new Error('Коллекция недоступна.')
    const text = draft.text.trim()
    if (!text) throw new Error('Введи название пункта.')
    const timestamp = new Date().toISOString()
    const entry: ListEntry = {
      id: existing?.id ?? (crypto.randomUUID?.() ?? `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      collectionId: existing?.collectionId ?? draft.collectionId,
      text: text.slice(0, 180), note: draft.note.trim().slice(0, 1000),
      tags: [...new Set(draft.tags.map(tag => tag.trim()).filter(Boolean))].slice(0, 12).map(tag => tag.slice(0, 35)),
      done: existing?.done ?? false,
      order: existing?.order ?? Math.max(-1, ...collectionEntries.filter(item => item.collectionId === draft.collectionId).map(item => item.order)) + 1,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      completedAt: existing?.completedAt ?? null, deletedAt: null,
    }
    setSaving(true)
    try {
      const linked = existing && linkedTask(tasks, existing.id)
      const changedTask = linked && (linked.text === existing.text || linked.notes === existing.note)
        ? { ...linked, text: linked.text === existing.text ? entry.text : linked.text, notes: linked.notes === existing.note ? entry.note : linked.notes, updatedAt: timestamp }
        : null
      if (changedTask) {
        await writeLinkedTaskAndEntry(changedTask, entry)
        setTasks(old => old.map(item => item.id === changedTask.id ? changedTask : item))
      } else await writeCollectionEntry(entry)
      setCollectionEntries(old => [...old.filter(item => item.id !== entry.id), entry])
      setNotice(existing ? 'Пункт обновлён' : 'Пункт добавлен в коллекцию')
    } finally { setSaving(false) }
  }

  async function toggleEntry(entry: ListEntry) {
    if (storage !== 'ready' || saving) return
    const timestamp = new Date().toISOString()
    const changed = setEntryDone(entry, !entry.done, timestamp)
    const task = linkedTask(tasks, entry.id)
    setSaving(true)
    try {
      if (task) {
        const changedTask = setTaskDone(task, changed.done, timestamp)
        await writeLinkedTaskAndEntry(changedTask, changed)
        setTasks(old => old.map(item => item.id === changedTask.id ? changedTask : item))
      } else await writeCollectionEntry(changed)
      setCollectionEntries(old => old.map(item => item.id === changed.id ? changed : item))
    } catch { setNotice('Не удалось сохранить отметку коллекции.') }
    finally { setSaving(false) }
  }

  async function deleteEntry(entry: ListEntry) {
    if (storage !== 'ready' || saving) throw new Error('Хранилище недоступно.')
    const timestamp = new Date().toISOString()
    const changed = { ...entry, deletedAt: timestamp, updatedAt: timestamp }
    setSaving(true)
    try { await writeCollectionEntry(changed); setCollectionEntries(old => old.map(item => item.id === changed.id ? changed : item)); setNotice('Пункт перемещён в удалённые') }
    finally { setSaving(false) }
  }

  async function restoreEntry(entry: ListEntry) {
    if (storage !== 'ready' || saving) return
    const task = linkedTask(tasks, entry.id)
    const changed = { ...entry, deletedAt: null, done: task?.done ?? entry.done, completedAt: task?.completedAt ?? entry.completedAt, updatedAt: new Date().toISOString() }
    setSaving(true)
    try { await writeCollectionEntry(changed); setCollectionEntries(old => old.map(item => item.id === changed.id ? changed : item)); setNotice('Пункт восстановлен') }
    catch { setNotice('Не удалось восстановить пункт.') }
    finally { setSaving(false) }
  }

  async function moveEntry(entry: ListEntry, other: ListEntry) {
    if (storage !== 'ready' || saving || !other || entry.collectionId !== other.collectionId) return
    const timestamp = new Date().toISOString()
    const first = { ...entry, order: other.order, updatedAt: timestamp }
    const second = { ...other, order: entry.order, updatedAt: timestamp }
    setSaving(true)
    try {
      await writeEntryPair(first, second)
      setCollectionEntries(old => old.map(item => item.id === first.id ? first : item.id === second.id ? second : item))
    } catch { setNotice('Не удалось изменить порядок.') }
    finally { setSaving(false) }
  }

  async function planEntry(entry: ListEntry, date: string, groupId: string) {
    if (storage !== 'ready' || saving) throw new Error('Хранилище недоступно.')
    if (entry.done || entry.deletedAt) throw new Error('Сначала верни пункт в список невыполненных.')
    if (!groups.some(group => group.id === groupId && !group.archived)) throw new Error('Выбери активную группу планера.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) throw new Error('Укажи корректную дату.')
    const timestamp = new Date().toISOString()
    // A deleted linked task is reactivated instead of creating a duplicate.
    const existing = tasks.find(task => task.collectionItemId === entry.id && !task.deletedAt) ?? tasks.find(task => task.collectionItemId === entry.id)
    const changed: TaskItem = existing ? { ...existing, text: entry.text, date, group: groupId, repeat: 'none', repeatUntil: null, done: false, completedAt: null, deletedAt: null, updatedAt: timestamp }
      : { id: crypto.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: entry.text, group: groupId, date, time: null,
        notes: entry.note, priority: 'normal', repeat: 'none', repeatUntil: null, collectionItemId: entry.id,
        done: false, createdAt: timestamp, updatedAt: timestamp, completedAt: null, deletedAt: null }
    setSaving(true)
    try {
      const move = existing && existing.date !== date && !existing.deletedAt ? taskMove(changed, existing.date, timestamp) : null
      if (move) { await writeTaskAndMove(changed, move); setTaskMoves(old => [...old, move]) }
      else await writeTask(changed)
      setTasks(old => [...old.filter(task => task.id !== changed.id), changed])
      setNotice(existing ? 'Задача перенесена, дубликата нет' : 'Пункт добавлен в планер')
    } finally { setSaving(false) }
  }

  function updateJournal(entry: JournalEntry) {
    if (storage !== 'ready') return
    // The state updates immediately; each IndexedDB put overwrites this date, not a new row.
    setJournals(old => [...old.filter(item => item.date !== entry.date), entry])
    void writeJournal(entry).catch(() => setNotice('Не удалось сохранить дневник. Сделай резервную копию и попробуй снова.'))
  }

  async function saveReport(date: string, comment: string) {
    if (storage !== 'ready') throw new Error('Хранилище дневника недоступно.')
    const timestamp = new Date().toISOString()
    const old = dailyReports.find(item => item.date === date)
    const report: DailyReport = { date, comment: comment.slice(0, 12000), completedAt: old?.completedAt ?? timestamp, updatedAt: timestamp }
    await writeDailyReport(report)
    setDailyReports(items => [...items.filter(item => item.date !== date), report])
  }

  async function toggleQuest(date: string, questId: QuestId) {
    if (storage !== 'ready' || date > today || questWriteLock.current) return
    questWriteLock.current = true
    const id = questRecordId(date, questId)
    setQuestSavingId(id)
    const timestamp = new Date().toISOString()
    const old = questCompletions.find(record => record.id === id)
    const done = !old?.done
    const completion: QuestCompletion = { id, date, questId, done, completedAt: done ? timestamp : null, updatedAt: timestamp }
    try {
      await writeQuestCompletion(completion)
      setQuestCompletions(items => [...items.filter(item => item.id !== id), completion])
      const quest = QUESTS.find(item => item.id === questId)!
      setNotice(done ? `Квест отмечен: +${quest.xp} XP` : 'Ошибочная отметка отменена, опыт пересчитан')
    } catch { setNotice('Не удалось сохранить квест. Проверь локальное хранилище.') }
    finally { questWriteLock.current = false; setQuestSavingId(null) }
  }

  function exportBackup() {
    if (storage !== 'ready') return
    const file = new File([JSON.stringify(createBackup({ tasks, groups, occurrences, collections, collectionEntries, journals, dailyReports, taskMoves, questCompletions }), null, 2)], `BASE-backup-${dateKey(new Date())}.json`, { type: 'application/json' })
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
      setCollections(pendingImport.collections); setCollectionEntries(pendingImport.collectionEntries)
      setJournals(pendingImport.journals); setDailyReports(pendingImport.dailyReports); setTaskMoves(pendingImport.taskMoves)
      setQuestCompletions(pendingImport.questCompletions)
      setPendingImport(null); setImportError(''); setNotice('Данные восстановлены из резервной копии')
      setInfoOpen(false)
    } catch (error) { setImportError(error instanceof Error ? error.message : 'Не удалось восстановить данные.') }
    finally { setSaving(false) }
  }

  const deleted = tasks.filter(task => task.deletedAt)
  return <div className="app-shell">
    <header className="app-header"><button className="brand" onClick={() => setTab('home')} aria-label="BASE: REBUILD, перейти домой"><span className="brand-mark">B<span>·</span></span><span className="brand-words">BASE<span>REBUILD / 0.8</span></span></button><div className="header-right"><span className="demo-chip"><i /> {storage === 'ready' ? 'ЛОКАЛЬНО' : storage === 'loading' ? 'ЗАГРУЗКА' : 'ОШИБКА'}</span><button className="header-settings" onClick={() => setInfoOpen(true)} aria-label="Данные и резервные копии"><Settings2 size={19} strokeWidth={1.7} /></button></div></header>
    {storage === 'error' && <div className="storage-alert" role="alert"><strong>Данные недоступны</strong><span>{storageError} Новые задачи не будут записываться.</span></div>}
    <main className="app-main">{tab === 'home' ? <Home today={today} tasks={tasks} occurrences={occurrences} journals={journals} questCompletions={questCompletions} ready={storage === 'ready'} onToday={() => setTab('today')} onJournal={() => setTab('journal')} /> : tab === 'today' ? <Planner today={today} tasks={tasks} groups={groups} occurrences={occurrences} questCompletions={questCompletions} questSavingId={questSavingId} onToggleQuest={toggleQuest} storage={storage} saving={saving} onSave={save} onToggle={toggle} onDelete={remove} onSaveGroup={saveGroup} /> : tab === 'lists' ? <Lists collections={collections} entries={collectionEntries} tasks={tasks} groups={groups} today={today} ready={storage === 'ready'} saving={saving} onSaveCollection={saveCollection} onSaveEntry={saveEntry} onToggleEntry={toggleEntry} onDeleteEntry={deleteEntry} onRestoreEntry={restoreEntry} onMoveEntry={moveEntry} onPlanEntry={planEntry} /> : tab === 'journal' ? <Journal today={today} ready={storage === 'ready'} journals={journals} reports={dailyReports} taskMoves={taskMoves} questCompletions={questCompletions} tasks={tasks} groups={groups} occurrences={occurrences} onUpdate={updateJournal} onSaveReport={saveReport} /> : <Progress today={today} records={questCompletions} ready={storage === 'ready'}/>}</main>
    <nav className="bottom-nav" aria-label="Основная навигация">{nav.map(({ id, name, Icon }) => <button key={id} className={tab === id ? 'current' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon size={21} strokeWidth={tab === id ? 2 : 1.7} /><span>{name}</span>{tab === id && <i />}</button>)}</nav>
    {!!notice && <div className="app-notice" role="status"><span>{notice}</span><button aria-label="Закрыть уведомление" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {infoOpen && <div className="modal-backdrop info-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setInfoOpen(false) }}>
      <div className="info-dialog data-dialog"><button aria-label="Закрыть" className="close-button" onClick={() => setInfoOpen(false)} disabled={saving}><X size={22} /></button>
        <span className="info-icon"><ShieldCheck size={31} /></span><h2>Данные BASE v0.8</h2>
        <p>Задачи, коллекции, дневник, RPG-квесты, опыт и история отчётов сохраняются в IndexedDB на этом устройстве. Они остаются после перезагрузки, но не синхронизируются с другими устройствами или ChatGPT. Очистка данных Safari может их удалить.</p>
        <div className="data-status"><span>Активных задач и серий</span><strong>{tasks.filter(task => !task.deletedAt).length}</strong></div>
        <div className="data-status"><span>Пунктов в коллекциях</span><strong>{collectionEntries.filter(entry => !entry.deletedAt).length}</strong></div>
        <div className="data-status"><span>Дней в дневнике / отчётов</span><strong>{journals.length} / {dailyReports.length}</strong></div>
        <div className="data-status"><span>Общий опыт / уровень</span><strong>{experience(questCompletions).totalXp} XP / LVL {experience(questCompletions).level}</strong></div>
        <button className="data-action" onClick={exportBackup} disabled={storage !== 'ready' || saving}><Download size={18} /> Сохранить резервную копию JSON</button>
        <button className="data-action secondary" onClick={() => fileInput.current?.click()} disabled={storage !== 'ready' || saving}><Upload size={18} /> Восстановить из JSON</button>
        <input ref={fileInput} type="file" accept=".json,application/json" className="hidden-input" onChange={event => void onBackupFile(event)} aria-label="Выбрать резервную копию" />
        {!!importError && <p className="form-error" role="alert">{importError}</p>}
        {pendingImport && <div className="import-warning" role="alert"><strong>Найдено {pendingImport.tasks.filter(task => !task.deletedAt).length} задач, {pendingImport.collectionEntries.filter(entry => !entry.deletedAt).length} пунктов коллекций, {pendingImport.journals.length} дней дневника и {pendingImport.questCompletions.filter(item => item.done).length} квестов</strong><p>Восстановление заменит все текущие локальные задачи, группы, коллекции, дневник, RPG-квесты, историю отчётов и корзину. Перед этим сохрани свою резервную копию.</p><button onClick={() => void confirmImport()} disabled={saving}>{saving ? 'Восстанавливаем…' : 'Подтвердить замену'}</button><button onClick={() => setPendingImport(null)} disabled={saving}>Отмена</button></div>}
        {deleted.length > 0 && <div className="trash-list"><h3><Trash2 size={15} /> Корзина · {deleted.length}</h3>{deleted.map(task => <div key={task.id}><span>{task.text}</span><button onClick={() => void restore(task)} disabled={saving} aria-label={`Вернуть задачу: ${task.text}`}><RotateCcw size={17} /></button></div>)}</div>}
        <p className="data-footnote">Резервные копии v0.3–0.7 поддерживаются. За обычные задачи и пункты коллекций XP не начисляется; максимум за семь ежедневных квестов — 100 XP. Экспорт отчёта в ChatGPT выполняется только вручную.</p>
      </div>
    </div>}
    <div className="desktop-side-note">BASE: REBUILD <span>PERSONAL LIFE SIMULATOR · LOCAL PLANNER</span></div>
  </div>
}
