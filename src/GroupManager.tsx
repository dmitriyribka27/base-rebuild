import { useState, type FormEvent } from 'react'
import { ArrowLeft, Check, FolderPlus, Pencil, X } from 'lucide-react'
import type { GroupItem, TaskItem } from './demo'

export type GroupDraft = { name: string; emoji: string; note: string; archived?: boolean }

function countLabel(count: number) {
  const ending = count % 10 === 1 && count % 100 !== 11 ? 'задача'
    : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'задачи' : 'задач'
  return `${count} ${ending}`
}

export default function GroupManager({ groups, tasks, saving, onSave, onClose }: {
  groups: GroupItem[]
  tasks: TaskItem[]
  saving: boolean
  onSave: (draft: GroupDraft, existing?: GroupItem) => Promise<void>
  onClose: () => void
}) {
  const [editing, setEditing] = useState<GroupItem | null | 'new'>(null)
  const [draft, setDraft] = useState<GroupDraft>({ name: '', emoji: '✳', note: '' })
  const [error, setError] = useState('')

  function edit(group: GroupItem | 'new') {
    setEditing(group)
    setDraft(group === 'new' ? { name: '', emoji: '✳', note: '' }
      : { name: group.name, emoji: group.emoji, note: group.note, archived: group.archived })
    setError('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      await onSave({ ...draft, name: draft.name.trim(), emoji: draft.emoji.trim() || '✳' }, editing === 'new' ? undefined : editing ?? undefined)
      setEditing(null); setError('')
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'Не получилось сохранить группу.') }
  }
  async function toggleArchived(group: GroupItem) {
    try {
      await onSave({ name: group.name, note: group.note, emoji: group.emoji, archived: !group.archived }, group)
      setError('')
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'Не получилось изменить группу.') }
  }

  return <div className="modal-backdrop info-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <div className="info-dialog group-manager">
      <button className="close-button" aria-label="Закрыть группы" onClick={onClose} disabled={saving}><X size={21} /></button>
      <p className="eyebrow">BASE / КАТЕГОРИИ</p>
      <h2>Мои группы</h2>
      {editing === null ? <>
        <p>Создавай свои группы и переименовывай существующие. Задачи сохранят связь с группой после переименования.</p>
        <div className="manage-groups-list">{groups.map(group => {
          const count = tasks.filter(task => task.group === group.id && !task.deletedAt).length
          return <div key={group.id} className={group.archived ? 'archived' : ''}>
            <span className="manage-group-emoji">{group.emoji}</span>
            <span className="manage-group-name"><strong>{group.name}</strong><small>{group.archived ? 'Скрыта' : countLabel(count)}</small></span>
            <button className="group-edit-button" aria-label={`Изменить группу: ${group.name}`} onClick={() => edit(group)}><Pencil size={16} /></button>
            <button className="group-archive-button" onClick={() => void toggleArchived(group)} disabled={saving || (!group.archived && count > 0)} title={!group.archived && count > 0 ? 'Сначала перенеси задачи в другие группы' : undefined}>{group.archived ? 'Вернуть' : 'Скрыть'}</button>
          </div>
        })}
        </div>
        <button className="data-action" onClick={() => edit('new')}><FolderPlus size={18} /> Создать группу</button>
        <p className="data-footnote">Группу с активными задачами нельзя скрыть, пока дела не перенесены. Скрытые группы можно вернуть в любой момент.</p>
      </> : <form onSubmit={event => void submit(event)} className="group-editor">
        <button type="button" className="group-back" onClick={() => { setEditing(null); setError('') }}><ArrowLeft size={16} /> Все группы</button>
        <div className="group-name-fields"><div><label className="form-label" htmlFor="group-emoji">Значок</label><input id="group-emoji" value={draft.emoji} onChange={event => setDraft(old => ({ ...old, emoji: event.target.value }))} maxLength={8} /></div><div><label className="form-label" htmlFor="group-name">Название</label><input id="group-name" autoFocus required value={draft.name} onChange={event => setDraft(old => ({ ...old, name: event.target.value }))} maxLength={50} placeholder="Например, Учёба" /></div></div>
        <label className="form-label" htmlFor="group-note">Подпись</label><input id="group-note" value={draft.note} onChange={event => setDraft(old => ({ ...old, note: event.target.value }))} maxLength={140} placeholder="Необязательно" />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="submit-task" disabled={saving || !draft.name.trim()}>{saving ? 'Сохраняем…' : 'Сохранить группу'} <Check size={18} /></button>
      </form>}
      {!editing && error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </div>
}
