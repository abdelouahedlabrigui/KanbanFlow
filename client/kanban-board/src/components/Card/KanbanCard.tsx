import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { User, Clock, CheckSquare } from 'lucide-react';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';
import type { Card } from '../../types';
import clsx from 'clsx';

interface Props {
  card: Card;
  onClick: (card: Card) => void;
}

export function KanbanCard({ card, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.ID,
    data: { card, type: 'card' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dueDate = card.DUE_DATE ? new Date(card.DUE_DATE) : null;
  const isOverdue = dueDate && isPast(dueDate) && card.STATUS !== 'DONE';
  const isSoon = dueDate && !isOverdue && isWithinInterval(dueDate, { start: new Date(), end: addDays(new Date(), 3) });

  const priorityClass = `priority-${card.PRIORITY.toLowerCase()}`;

  const hasChecklist = card.checklist && card.checklist.total > 0;
  const checklistPct = hasChecklist ? Math.round((card.checklist!.done / card.checklist!.total) * 100) : 0;

  const tags = card.TAGS ? card.TAGS.split(',').map((t) => t.trim()).filter(Boolean) : [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={clsx('kanban-card', priorityClass, { dragging: isDragging })}
      onClick={() => onClick(card)}
    >
      <div className="card-title">{card.TITLE}</div>

      {tags.length > 0 && (
        <div className="tags-wrap">
          {tags.slice(0, 3).map((tag) => <span key={tag} className="tag">{tag}</span>)}
        </div>
      )}

      <div className="card-meta" style={{ marginTop: 8 }}>
        <span className="card-priority-badge">{card.PRIORITY}</span>

        {card.OWNER && (
          <span className="card-owner">
            <User size={11} />
            {card.OWNER}
          </span>
        )}

        {card.STORY_POINTS != null && (
          <span className="card-owner" style={{ marginLeft: 'auto' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent-violet)' }}>
              {card.STORY_POINTS}pt
            </span>
          </span>
        )}

        {dueDate && (
          <span className={clsx('card-due', { overdue: isOverdue, soon: isSoon })}>
            <Clock size={10} style={{ marginRight: 2, display: 'inline' }} />
            {format(dueDate, 'MMM d')}
          </span>
        )}
      </div>

      {hasChecklist && (
        <div className="card-checklist-progress">
          <CheckSquare size={11} color="var(--text-3)" />
          <div className="checklist-bar">
            <div className="checklist-fill" style={{ width: `${checklistPct}%` }} />
          </div>
          <span className="checklist-text">{card.checklist!.done}/{card.checklist!.total}</span>
        </div>
      )}
    </div>
  );
}
