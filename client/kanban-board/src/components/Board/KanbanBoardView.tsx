import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Board, Card, Column } from '../../types';
import { KanbanColumn } from '../Column/KanbanColumn';
import { KanbanCard } from '../Card/KanbanCard';
import { cardsApi } from '../../utils/api';
import { useToast } from '../../hooks/useToast';

interface Props {
  board: Board;
  bottleneckColumns: string[];
  onCardClick: (card: Card) => void;
  onAddCard: (columnId: string) => void;
  onRefresh: () => void;
}

export function KanbanBoardView({ board, bottleneckColumns, onCardClick, onAddCard, onRefresh }: Props) {
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columns = useMemo(() => [...(board.columns ?? [])].sort((a, b) => a.POSITION - b.POSITION), [board.columns]);
  const swimlanes = useMemo(() => [...(board.swimlanes ?? [])].sort((a, b) => a.POSITION - b.POSITION), [board.swimlanes]);
  const cards = board.cards ?? [];

  const getColumnCards = (columnId: string, swimlaneId?: string) =>
    cards
      .filter((c) => c.COLUMN_ID === columnId && (swimlaneId === undefined || c.SWIMLANE_ID === swimlaneId || (!c.SWIMLANE_ID && swimlaneId === null)))
      .sort((a, b) => a.POSITION - b.POSITION);

  const handleDragStart = (event: DragStartEvent) => {
    const card = event.active.data.current?.card as Card;
    setActiveCard(card ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const draggedCard = active.data.current?.card as Card;
    if (!draggedCard) return;

    // Determine target column
    let targetColId: string | undefined;

    // If dropped over a column droppable
    if ((over.id as string).startsWith('col-')) {
      targetColId = (over.id as string).replace('col-', '');
    } else {
      // Dropped over another card
      const targetCard = cards.find((c) => c.ID === over.id);
      if (targetCard) targetColId = targetCard.COLUMN_ID;
    }

    if (!targetColId || targetColId === draggedCard.COLUMN_ID) return;

    try {
      await cardsApi.move(draggedCard.ID, { toColumnId: targetColId });
      onRefresh();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data: { error: string; message: string } } };
      const data = axiosErr.response?.data;
      if (data?.error === 'WIP_LIMIT_EXCEEDED') {
        toast(`⚠️ WIP Limit: ${data.message}`, 'warning');
      } else if (data?.error === 'DOD_NOT_MET') {
        toast(`✗ Definition of Done: ${data.message}`, 'error');
      } else {
        toast(`Move failed: ${data?.message ?? 'Unknown error'}`, 'error');
      }
    }
  };

  // Swimlane layout
  if (swimlanes.length > 0) {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="kanban-grid">
          {/* Column headers */}
          <div className="column-header-row">
            {columns.map((col) => (
              <div key={col.ID} className="kanban-column-wrap" style={{ borderRight: '1px solid var(--border)', padding: 0 }}>
                <div className="kanban-column-header" style={{ borderBottomColor: col.COLOR }}>
                  <span className="col-header-title" style={{ color: col.COLOR }}>{col.TITLE}</span>
                  {col.WIP_LIMIT != null && (
                    <span className={`col-wip-badge ${bottleneckColumns.includes(col.ID) ? 'at-limit' : ''}`}>
                      {getColumnCards(col.ID).length}/{col.WIP_LIMIT}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Swimlane rows */}
          {swimlanes.map((lane) => (
            <div key={lane.ID} className="swimlane-row">
              <div className="swimlane-label">
                <span className="swimlane-dot" style={{ background: lane.COLOR }} />
                {lane.TITLE}
              </div>
              <div className="swimlane-cells">
                {columns.map((col) => {
                  const laneCards = cards
                    .filter((c) => c.COLUMN_ID === col.ID && c.SWIMLANE_ID === lane.ID)
                    .sort((a, b) => a.POSITION - b.POSITION);

                  return (
                    <KanbanColumn
                      key={`${col.ID}-${lane.ID}`}
                      column={col}
                      cards={laneCards}
                      onCardClick={onCardClick}
                      onAddCard={onAddCard}
                      isBottleneck={bottleneckColumns.includes(col.ID)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="drag-overlay-card">
              <KanbanCard card={activeCard} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }

  // No swimlanes — flat layout
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="kanban-scroll-area">
        {columns.map((col) => (
          <KanbanColumn
            key={col.ID}
            column={col}
            cards={getColumnCards(col.ID)}
            onCardClick={onCardClick}
            onAddCard={onAddCard}
            isBottleneck={bottleneckColumns.includes(col.ID)}
          />
        ))}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="drag-overlay-card">
            <KanbanCard card={activeCard} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
