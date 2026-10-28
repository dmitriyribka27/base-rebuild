import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CalendarPlus, Check, ChevronRight, CirclePlus, Pencil, Plus, RotateCcw, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { collectionProgress, linkedTask, type CollectionItem, type ListEntry } from './collections'
import { localDate, type GroupItem, type TaskItem } from './demo'

export type CollectionDraft = { name: string; emoji: string; note: string; archived?: boolean }
export type EntryDraft = { collectionId: string; text: string; note: string; tags: string[] }
type ListFilter = 'all' | 'open' | 'done'

function tidyTags(input: string) {
  return [...new Set(input.split(',').map(tag => tag.trim().replace(/^#/, '')).filter(Boolean))].slice(0, 12)
}

export default function Lists({ collections, entries, tasks, groups, today, ready, saving, onSaveCollection, onSaveEntry, onToggleEntry, onDeleteEntry, onRestoreEntry, onMoveEntry, onPlanEntry }: {
  collections: CollectionItem[]
  entries: ListEntry[]
  tasks: TaskItem[]
  groups: GroupItem[]
  today: string
  ready: boolean
  saving: boolean
  onSaveCollection: (draft: CollectionDraft, existing?: CollectionItem) => Promise<void>
  onSaveEntry: (draft: EntryDraft, existing?: ListEntry) => Promise<void>
  onToggleEntry: (entry: ListEntry) => Promise<void>
  onDeleteEntry: (entry: ListEntry) => Promise<void>
  onRestoreEntry: (entry: ListEntry) => Promise<void>
  onMoveEntry: (entry: ListEntry, other: ListEntry) => Promise<void>
  onPlanEntry: (entry: ListEntry, date: string, groupId: string) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<ListFilter>('all')
  const [tag, setTag] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [collectionDialog, setCollectionDialog] = useState(false)
  const [editingCollection, setEditingCollection] = useState<CollectionItem | undefined>()
  const [collectionDraft, setCollectionDraft] = useState<CollectionDraft>({ name: '', emoji: '✳', note: '' })
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [entryDialog, setEntryDialog] = useState(false)
  const [editingEntry, setEditingEntry] = useState<ListEntry | undefined>()
  const [entryDraft, setEntryDraft] = useState<EntryDraft>({ collectionId: '', text: '', note: '', tags: [] })
  const [tagsInput, setTagsInput] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [planEntry, setPlanEntry] = useState<ListEntry | null>(null)
  const [planDate, setPlanDate] = useState(today)
  const [planGroup, setPlanGroup] = useState('personal')
  const [modalError, setModalError] = useState('')

  const activeCollections = collections.filter(collection => !collection.archived)
  const archivedCollections = collections.filter(collection => collection.archived)
  const selected = collections.find(collection => collection.id === selectedId && !collection.archived) ?? null
  const currentEntries = useMemo(() => entries.filter(entry => entry.collectionId === selectedId && !entry.deletedAt).sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)), [entries, selectedId])
  const deletedEntries = entries.filter(entry => entry.collectionId === selectedId && entry.deletedAt)
  const allTags = [...new Set(currentEntries.flatMap(entry => entry.tags))].sort((a, b) => a.localeCompare(b, 'ru'))
  const shown = currentEntries.filter(entry => (filter === 'all' || entry.done === (filter === 'done')) && (tag === 'all' || entry.tags.includes(tag)))
  const currentProgress = selected ? collectionProgress(entries, selected.id) : { done: 0, total: 0, percent: 0 }
  const summary = activeCollections.reduce((total, collection) => {
    const progress = collectionProgress(entries, collection.id)
    return { done: total.done + progress.done, total: total.total + progress.total }
  }, { done: 0, total: 0 })

  function openCollection(collection: CollectionItem) { setSelectedId(collection.id); setFilter('all'); setTag('all'); setShowDeleted(false) }
  function openCollectionEditor(collection?: CollectionItem) {
    setEditingCollection(collection)
    setCollectionDraft(collection ? { name: collection.name, emoji: collection.emoji, note: collection.note, archived: collection.archived } : { name: '', emoji: '✳', note: '' })
    setConfirmArchive(false); setModalError(''); setCollectionDialog(true)
  }
  function openEntryEditor(entry?: ListEntry) {
    if (!selected) return
    setEditingEntry(entry)
    setEntryDraft(entry ? { collectionId: entry.collectionId, text: entry.text, note: entry.note, tags: entry.tags } : { collectionId: selected.id, text: '', note: '', tags: [] })
    setTagsInput(entry?.tags.join(', ') ?? '')
    setConfirmDelete(false); setModalError(''); setEntryDialog(true)
  }
  function openPlan(entry: ListEntry) {
    const existing = linkedTask(tasks, entry.id)
    setPlanEntry(entry)
    setPlanDate(existing?.date ?? today)
    setPlanGroup(existing?.group ?? (groups.some(group => group.id === 'personal' && !group.archived) ? 'personal' : groups.find(group => !group.archived)?.id ?? 'work'))
    setModalError('')
  }
  async function submitCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await onSaveCollection(collectionDraft, editingCollection)
      if (collectionDraft.archived && editingCollection) setSelectedId(null)
      setCollectionDialog(false)
    } catch (error) { setModalError(error instanceof Error ? error.message : 'Не удалось сохранить коллекцию.') }
  }
  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try { await onSaveEntry({ ...entryDraft, tags: tidyTags(tagsInput) }, editingEntry); setEntryDialog(false) }
    catch (error) { setModalError(error instanceof Error ? error.message : 'Не удалось сохранить пункт.') }
  }
  async function deleteEntry() {
    if (!editingEntry) return
    try { await onDeleteEntry(editingEntry); setEntryDialog(false) }
    catch (error) { setModalError(error instanceof Error ? error.message : 'Не удалось удалить пункт.') }
  }
  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!planEntry) return
    try { await onPlanEntry(planEntry, planDate, planGroup); setPlanEntry(null) }
    catch (error) { setModalError(error instanceof Error ? error.message : 'Не удалось добавить пункт в план.') }
  }

  return <div className="page lists-page">
    {!selected ? <>
      <div className="lists-header"><div><p className="eyebrow">BASE <span className="eyebrow-dot">/</span> МОИ КОЛЛЕКЦИИ</p><h1>Списки<span className="mint-period">.</span></h1><p className="lead">Книги, фильмы, места и идеи. Без дедлайнов.</p></div><button className="square-action" aria-label="Создать коллекцию" title="Новая коллекция" disabled={!ready || saving} onClick={() => openCollectionEditor()}><Plus size={21} /></button></div>
      <section className="lists-summary"><span className="caps-label">ТВОЯ КОЛЛЕКЦИЯ ВПЕЧАТЛЕНИЙ</span><div><strong>{summary.done}<span> / {summary.total}</span></strong><small>{activeCollections.length} коллекций</small></div><div className="progress-track" role="progressbar" aria-valuenow={summary.done} aria-valuemin={0} aria-valuemax={summary.total || 1}><div className="progress-fill" style={{ width: `${summary.total ? Math.round(summary.done / summary.total * 100) : 0}%` }}/></div></section>
      {!ready && <div className="lists-empty">Загружаем коллекции…</div>}
      {ready && <div className="collection-grid">{activeCollections.map(collection => {
        const progress = collectionProgress(entries, collection.id)
        return <button className="collection-card" key={collection.id} onClick={() => openCollection(collection)}>
          <div className="collection-card-top"><span className="collection-symbol" aria-hidden="true">{collection.emoji}</span><ChevronRight size={18} /></div>
          <strong>{collection.name}</strong><small>{collection.note}</small>
          <div className="collection-card-bottom"><span>{progress.done} / {progress.total}</span><span>{progress.percent}%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${progress.percent}%` }}/></div>
        </button>
      })}</div>}
      <button className="lists-add-collection" disabled={!ready || saving} onClick={() => openCollectionEditor()}><CirclePlus size={20} /> Новая коллекция <ArrowRight size={17} /></button>
      {!!archivedCollections.length && <div className="lists-archived"><button className="lists-subtle-button" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Скрыть архив' : `Архив коллекций · ${archivedCollections.length}`}</button>{showArchived && archivedCollections.map(collection => <div className="archived-collection" key={collection.id}><span>{collection.emoji} {collection.name}</span><button disabled={saving} onClick={() => void onSaveCollection({ name: collection.name, emoji: collection.emoji, note: collection.note, archived: false }, collection)}>Вернуть</button></div>)}</div>}
    </> : <>
      <button className="lists-back" onClick={() => setSelectedId(null)}><ArrowLeft size={18} /> Все коллекции</button>
      <div className="list-detail-heading"><span className="list-detail-emoji" aria-hidden="true">{selected.emoji}</span><button aria-label={`Изменить коллекцию ${selected.name}`} className="square-action" onClick={() => openCollectionEditor(selected)} disabled={saving}><Pencil size={17} /></button></div>
      <p className="eyebrow">КОЛЛЕКЦИЯ / {String(collections.indexOf(selected) + 1).padStart(2, '0')}</p><h1 className="list-detail-name">{selected.name}<span className="mint-period">.</span></h1><p className="lead">{selected.note || 'Твои идеи и желания'}</p>
      <section className="list-detail-progress"><div><span className="caps-label">ВЫПОЛНЕНО</span><strong>{currentProgress.done} <span>из {currentProgress.total}</span></strong></div><strong className="progress-percent">{currentProgress.percent}%</strong><div className="progress-track"><div className="progress-fill" style={{ width: `${currentProgress.percent}%` }} /></div></section>
      <div className="list-filters"><div className="filter-pills">{([{ id: 'all', text: 'Все' }, { id: 'open', text: 'В планах' }, { id: 'done', text: 'Готово' }] as { id: ListFilter; text: string }[]).map(item => <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.text}</button>)}</div>{!!allTags.length && <div className="list-tag-filter"><SlidersHorizontal size={15} /><select value={tag} aria-label="Фильтр по тегу" onChange={event => setTag(event.target.value)}><option value="all">Все теги</option>{allTags.map(value => <option key={value} value={value}>#{value}</option>)}</select></div>}</div>
      <div className="collection-entry-list">{shown.map(entry => {
        const linked = linkedTask(tasks, entry.id)
        const index = currentEntries.findIndex(item => item.id === entry.id)
        return <article className={`collection-entry ${entry.done ? 'is-done' : ''}`} key={entry.id}>
          <div className="collection-entry-main"><button className="entry-check" disabled={saving} aria-pressed={entry.done} aria-label={`${entry.done ? 'Отменить' : 'Выполнить'}: ${entry.text}`} onClick={() => void onToggleEntry(entry)}>{entry.done && <Check size={17} strokeWidth={2.5} />}</button><div className="entry-content"><strong>{entry.text}</strong>{!!entry.note && <p>{entry.note}</p>}{!!entry.tags.length && <div className="entry-tags">{entry.tags.map(value => <span key={value}>#{value}</span>)}</div>}{linked && <span className="entry-linked">{linked.done ? '✓ Выполнено в планере' : `◷ В плане · ${localDate(linked.date, { day: 'numeric', month: 'short' })}`}</span>}</div><button className="entry-edit" onClick={() => openEntryEditor(entry)} aria-label={`Изменить ${entry.text}`} disabled={saving}><Pencil size={16} /></button></div>
          <div className="collection-entry-actions"><button onClick={() => openPlan(entry)} disabled={saving || entry.done}><CalendarPlus size={15} /> {linked ? 'Перенести' : 'В план'}</button><div className="entry-reorder"><button aria-label={`Выше: ${entry.text}`} disabled={saving || index === 0} onClick={() => void onMoveEntry(entry, currentEntries[index - 1])}><ArrowUp size={15} /></button><button aria-label={`Ниже: ${entry.text}`} disabled={saving || index === currentEntries.length - 1} onClick={() => void onMoveEntry(entry, currentEntries[index + 1])}><ArrowDown size={15} /></button></div></div>
        </article>
      })}</div>
      {shown.length === 0 && <div className="lists-empty"><span>✳</span><strong>{currentEntries.length ? 'По фильтру ничего нет' : 'Здесь пока пусто'}</strong><small>{currentEntries.length ? 'Попробуй другой фильтр.' : 'Добавь первую книгу, фильм или идею.'}</small></div>}
      <button className="lists-add-entry" onClick={() => openEntryEditor()} disabled={saving}><Plus size={21} /> Добавить пункт <ArrowRight size={17} /></button>
      {!!deletedEntries.length && <div className="lists-archived"><button className="lists-subtle-button" onClick={() => setShowDeleted(!showDeleted)}>{showDeleted ? 'Скрыть удалённые' : `Удалённые пункты · ${deletedEntries.length}`}</button>{showDeleted && deletedEntries.map(entry => <div className="archived-collection" key={entry.id}><span>{entry.text}</span><button disabled={saving} onClick={() => void onRestoreEntry(entry)}><RotateCcw size={14} /> Вернуть</button></div>)}</div>}
    </>}

    {collectionDialog && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setCollectionDialog(false) }}><form className="task-modal list-modal" onSubmit={event => void submitCollection(event)}><div className="modal-handle"/><div className="modal-heading"><div><p className="eyebrow">{editingCollection ? 'НАСТРОЙКИ КОЛЛЕКЦИИ' : 'НОВАЯ КОЛЛЕКЦИЯ'}</p><h2>{editingCollection ? 'Изменить коллекцию' : 'Создать коллекцию'}</h2></div><button type="button" className="close-button" onClick={() => setCollectionDialog(false)} disabled={saving} aria-label="Закрыть"><X size={21}/></button></div>
      <div className="list-form-name"><div><label className="form-label" htmlFor="collection-emoji">Значок</label><input id="collection-emoji" value={collectionDraft.emoji} maxLength={8} onChange={event => setCollectionDraft(old => ({ ...old, emoji: event.target.value }))}/></div><div><label className="form-label" htmlFor="collection-name">Название</label><input id="collection-name" autoFocus required maxLength={70} placeholder="Например, Места в Батуми" value={collectionDraft.name} onChange={event => setCollectionDraft(old => ({ ...old, name: event.target.value }))}/></div></div>
      <label className="form-label" htmlFor="collection-note">Описание</label><input id="collection-note" value={collectionDraft.note} maxLength={200} placeholder="Необязательно" onChange={event => setCollectionDraft(old => ({ ...old, note: event.target.value }))}/>
      {!!modalError && <p className="form-error" role="alert">{modalError}</p>}
      <button className="submit-task" disabled={saving || !collectionDraft.name.trim()}>{saving ? 'Сохраняем…' : 'Сохранить коллекцию'} <ArrowRight size={17}/></button>
      {editingCollection && !editingCollection.archived && <div className="delete-zone">{confirmArchive ? <><span>Скрыть коллекцию? Пункты сохранятся в архиве.</span><button type="button" className="delete-confirm" disabled={saving} onClick={() => { setCollectionDraft(old => ({ ...old, archived: true })); void onSaveCollection({ ...collectionDraft, archived: true }, editingCollection).then(() => { setCollectionDialog(false); setSelectedId(null) }).catch(error => setModalError(error instanceof Error ? error.message : 'Ошибка архивации.')) }}>Да, в архив</button><button type="button" onClick={() => setConfirmArchive(false)}>Отмена</button></> : <button type="button" onClick={() => setConfirmArchive(true)}><Trash2 size={15}/> Удалить в архив</button>}</div>}
    </form></div>}

    {entryDialog && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setEntryDialog(false) }}><form className="task-modal list-modal" onSubmit={event => void submitEntry(event)}><div className="modal-handle"/><div className="modal-heading"><div><p className="eyebrow">{editingEntry ? 'РЕДАКТИРОВАНИЕ ПУНКТА' : 'НОВЫЙ ПУНКТ'}</p><h2>{editingEntry ? 'Изменить идею' : 'Новая идея'}</h2></div><button type="button" className="close-button" onClick={() => setEntryDialog(false)} disabled={saving} aria-label="Закрыть"><X size={21}/></button></div>
      <label className="form-label" htmlFor="entry-title">Название</label><input id="entry-title" autoFocus required maxLength={180} placeholder="Что хочется прочитать, посмотреть, сделать?" value={entryDraft.text} onChange={event => setEntryDraft(old => ({ ...old, text: event.target.value }))}/>
      <label className="form-label" htmlFor="entry-tags">Теги через запятую</label><input id="entry-tags" value={tagsInput} maxLength={400} placeholder="например: вместе, выходные" onChange={event => setTagsInput(event.target.value)}/>
      <label className="form-label" htmlFor="entry-note">Заметка</label><textarea id="entry-note" rows={3} maxLength={1000} value={entryDraft.note} onChange={event => setEntryDraft(old => ({ ...old, note: event.target.value }))} placeholder="Ссылка, автор или причина, почему заинтересовало…"/>
      {!!modalError && <p className="form-error" role="alert">{modalError}</p>}
      <button className="submit-task" disabled={saving || !entryDraft.text.trim()}>{saving ? 'Сохраняем…' : editingEntry ? 'Сохранить изменения' : 'Добавить в коллекцию'} <ArrowRight size={17}/></button>
      {editingEntry && <div className="delete-zone">{confirmDelete ? <><span>Убрать пункт из коллекции? Его можно восстановить.</span><button type="button" className="delete-confirm" onClick={() => void deleteEntry()} disabled={saving}>Да, удалить</button><button type="button" onClick={() => setConfirmDelete(false)}>Отмена</button></> : <button type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={15}/> Удалить пункт</button>}</div>}
    </form></div>}

    {planEntry && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setPlanEntry(null) }}><form className="task-modal list-modal" onSubmit={event => void submitPlan(event)}><div className="modal-handle"/><div className="modal-heading"><div><p className="eyebrow">КОЛЛЕКЦИЯ <span className="eyebrow-dot">→</span> ПЛАНЕР</p><h2>{linkedTask(tasks, planEntry.id) ? 'Изменить дату' : 'Добавить в план'}</h2></div><button className="close-button" type="button" aria-label="Закрыть" onClick={() => setPlanEntry(null)} disabled={saving}><X size={21}/></button></div><div className="plan-entry-title">{planEntry.text}</div>
      <label className="form-label" htmlFor="collection-plan-date">На какую дату?</label><input id="collection-plan-date" type="date" required value={planDate} onChange={event => setPlanDate(event.target.value)}/>
      <label className="form-label" htmlFor="collection-plan-group">Группа планера</label><select id="collection-plan-group" value={planGroup} onChange={event => setPlanGroup(event.target.value)}>{groups.filter(group => !group.archived || group.id === planGroup).map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
      <p className="list-plan-hint">Создаётся одна связанная задача. Если она уже есть, мы перенесём её, не создавая дубль. Выполнение в планере обновит эту коллекцию.</p>
      {!!modalError && <p className="form-error" role="alert">{modalError}</p>}
      <button className="submit-task" disabled={saving || !planDate || !planGroup || planEntry.done}>{saving ? 'Сохраняем…' : 'Сохранить в планере'} <ArrowRight size={17}/></button>
    </form></div>}
  </div>
}
