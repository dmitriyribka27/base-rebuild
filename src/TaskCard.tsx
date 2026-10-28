import type { CSSProperties } from 'react'
import { Check, ChevronDown, Clock3, Pencil, Repeat2 } from 'lucide-react'
import type { GroupItem } from './demo'
import { paymentLabel } from './payments'
import type { ScheduledTask } from './schedule'
import { durationLabel } from './taskDetails'

const accents = ['#78b8ff', '#8eabd9', '#ac99e7', '#70c5b5', '#f1b67e', '#99c8ee', '#bf9ddc', '#84baaa']

export default function TaskCard({ row, group, expanded, saving, onExpand, onToggle, onToggleSubtask, onEdit }: {
  row: ScheduledTask
  group: GroupItem
  expanded: boolean
  saving: boolean
  onExpand: () => void
  onToggle: () => void
  onToggleSubtask: (id: string) => void
  onEdit: () => void
}) {
  const parts = row.task.subtasks ?? []
  const hasParts = parts.length > 0
  const progress = row.checkedSubtaskIds.length
  const progressPercent = hasParts ? progress / parts.length * 100 : row.done ? 100 : 0
  const duration = durationLabel(row.task.time, row.task.endTime)
  const accent = accents[(Math.max(0, group.order)) % accents.length]
  const style = { '--task-accent': accent, '--task-progress': `${progressPercent}%` } as CSSProperties

  return <article className={`boo-task-card${row.done ? ' is-complete' : ''}`} style={style}>
    <div className="boo-card-main">
      <span className="boo-card-icon" aria-hidden="true">{group.emoji}</span>
      <div className="boo-card-body">
        <span className="boo-card-category">{group.name}</span>
        <button type="button" className="boo-card-title" onClick={hasParts ? onExpand : onEdit} aria-expanded={hasParts ? expanded : undefined}>
          <span>{row.task.text}{row.task.payment && <b className="boo-card-payment"> · {paymentLabel(row.task.payment)}</b>}</span>
          {hasParts && <><small>{progress}/{parts.length}</small><ChevronDown className={expanded ? 'expanded' : ''} size={17}/></>}
        </button>
        <div className="boo-card-meta">
          {row.task.time && <span><Clock3 size={14}/>{row.task.time}{row.task.endTime ? `–${row.task.endTime}` : ''}{duration ? ` · ${duration}` : ''}</span>}
          {row.recurring && <span><Repeat2 size={13}/> Повтор</span>}
          {row.task.priority === 'high' && <span>Важное</span>}
          {row.task.collectionItemId && <span>Из списка</span>}
        </div>
      </div>
      <button type="button" className="boo-card-check" aria-label={`${row.done ? 'Отменить выполнение' : 'Выполнить'}: ${row.task.text}`} aria-pressed={row.done} onClick={onToggle} disabled={saving}><Check size={22} strokeWidth={2.5}/></button>
    </div>
    {hasParts && expanded && <div className="boo-card-parts" aria-label={`Подзадачи: ${row.task.text}`}>
      {parts.map(part => {
        const done = row.checkedSubtaskIds.includes(part.id)
        return <button type="button" key={part.id} className={`boo-card-part${done ? ' part-done' : ''}`} aria-pressed={done} disabled={saving} onClick={() => onToggleSubtask(part.id)}>
          <span className="boo-part-check">{done && <Check size={15} strokeWidth={2.5}/>}</span><span>{part.text}</span>
        </button>
      })}
    </div>}
    <div className="boo-card-foot"><button type="button" disabled={saving} onClick={onEdit}><Pencil size={13}/> Изменить</button>{hasParts && <span>{row.done ? 'Все подзадачи выполнены' : `Подзадачи: ${progress} из ${parts.length}`}</span>}</div>
    <div className="boo-card-progress" aria-hidden="true"><span /></div>
  </article>
}
