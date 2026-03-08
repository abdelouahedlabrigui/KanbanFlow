import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, MoreHorizontal, AlertTriangle } from 'lucide-react';
import type { Column, Card } from '../../types';
import { KanbanCard } from '../Card/KanbanCard';
import clsx from 'clsx';

interface Props {
  column: Column;
  cards: Card[];
  onCardClick: (card: Card) => void;
  onAddCard: (columnId: string) => void;
  isBottleneck: boolean;
}

export function KanbanColumn({ column, cards, onCardClick, onAddCard, isBottleneck }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${column.ID}`,
    data: { columnId: column.ID },
  });

  const atLimit = column.WIP_LIMIT != null && cards.length >= column.WIP_LIMIT;

  return (
    <div className={clsx('kanban-column-wrap', { 'col-bottleneck': isBottleneck })}>
      <div
        className="kanban-column-header"
        style={{ borderBottomColor: column.COLOR }}
      >
        <div className="col-header-title" style={{ color: column.COLOR }}>
          {column.TITLE}
        </div>

        {isBottleneck && <AlertTriangle size={13} color="var(--accent-red)" />}

        <div className={clsx('col-wip-badge', { 'at-limit': atLimit })}>
          {cards.length}{column.WIP_LIMIT != null ? `/${column.WIP_LIMIT}` : ''}
        </div>

        <button className="btn-icon" style={{ opacity: 0.5 }}>
          <MoreHorizontal size={14} />
        </button>
      </div>

      <SortableContext items={cards.map((c) => c.ID)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={clsx('column-cards', { 'drag-over': isOver })}
        >
          {cards.map((card) => (
            <KanbanCard key={card.ID} card={card} onClick={onCardClick} />
          ))}
        </div>
      </SortableContext>

      <button className="add-card-btn" onClick={() => onAddCard(column.ID)}>
        <Plus size={13} /> Add card
      </button>
    </div>
  );
}
