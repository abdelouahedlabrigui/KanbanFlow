import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BarChart2, Bot, ArrowLeft, Plus, RefreshCw, Settings } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import { KanbanBoardView } from './KanbanBoardView';
import { AnalyticsView } from '../Analytics/AnalyticsView';
import { AIPanel } from '../AI/AIPanel';
import { CardDetailModal } from '../Card/CardDetailModal';
import { CreateCardModal } from '../Card/CreateCardModal';
import { cardsApi } from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import type { Card } from '../../types';

type Tab = 'board' | 'analytics';

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { currentBoard, loading, fetchBoard, fetchAnalytics } = useBoardStore();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('board');
  const [aiOpen, setAiOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [createColId, setCreateColId] = useState<string | null>(null);

  const load = () => {
    if (boardId) {
      fetchBoard(boardId);
      fetchAnalytics(boardId);
    }
  };

  useEffect(() => { load(); }, [boardId]);

  const handleCardClick = (card: Card) => setSelectedCardId(card.ID);
  const handleAddCard = (columnId: string) => setCreateColId(columnId);

  const handleMoveCard = async (cardId: string, toColumnId: string, reason?: string) => {
    try {
      await cardsApi.move(cardId, { toColumnId, reason });
      await load();
      toast('Card moved', 'success');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data: { error: string; message: string } } };
      const data = axiosErr.response?.data;
      if (data?.error === 'WIP_LIMIT_EXCEEDED') {
        toast(`⚠️ WIP Limit: ${data.message}`, 'warning');
      } else if (data?.error === 'DOD_NOT_MET') {
        toast(`✗ DoD: ${data.message}`, 'error');
      } else {
        toast(`Error: ${data?.message ?? 'Move failed'}`, 'error');
      }
      throw err;
    }
  };

  if (loading && !currentBoard) {
    return <div className="loading-full"><div className="spinner" /></div>;
  }

  if (!currentBoard) {
    return <div className="empty-state"><div>Board not found</div></div>;
  }

  const bottleneckCols = (currentBoard.columns ?? [])
    .filter((c) => c.WIP_LIMIT != null && (c.CARD_COUNT ?? 0) >= c.WIP_LIMIT)
    .map((c) => c.ID);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div className="board-toolbar">
        <button className="btn-icon" onClick={() => navigate('/')} title="All Boards">
          <ArrowLeft size={16} />
        </button>

        <div className="board-title-wrap">
          <div className="board-title">{currentBoard.TITLE}</div>
          {bottleneckCols.length > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              ⚠ {bottleneckCols.length} bottleneck{bottleneckCols.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button className="btn-icon" onClick={load} title="Refresh">
          <RefreshCw size={14} />
        </button>

        <div className="board-tabs">
          <button className={`board-tab ${tab === 'board' ? 'active' : ''}`} onClick={() => setTab('board')}>
            <LayoutDashboard size={13} /> Board
          </button>
          <button className={`board-tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>
            <BarChart2 size={13} /> Analytics
          </button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setCreateColId(currentBoard.columns?.[0]?.ID ?? '')}>
            <Plus size={13} /> Add Card
          </button>
          <button
            className={`btn btn-sm ${aiOpen ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setAiOpen(!aiOpen)}
          >
            <Bot size={13} /> AI Coach
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="main-content" style={{ position: 'relative', overflow: 'hidden', display: 'flex' }}>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'margin-right 0.3s', marginRight: aiOpen ? 380 : 0 }}>
          {tab === 'board' && (
            <div className="kanban-container">
              <KanbanBoardView
                board={currentBoard}
                bottleneckColumns={bottleneckCols}
                onCardClick={handleCardClick}
                onAddCard={handleAddCard}
                onRefresh={load}
              />
            </div>
          )}

          {tab === 'analytics' && <AnalyticsView boardId={currentBoard.ID} />}
        </div>

        <AIPanel boardId={currentBoard.ID} open={aiOpen} onClose={() => setAiOpen(false)} />
      </div>

      {/* Card Detail Modal */}
      {selectedCardId && (
        <CardDetailModal
          cardId={selectedCardId}
          columns={currentBoard.columns ?? []}
          onClose={() => setSelectedCardId(null)}
          onCardUpdated={load}
          onMoveCard={handleMoveCard}
        />
      )}

      {/* Create Card Modal */}
      {createColId !== null && (
        <CreateCardModal
          boardId={currentBoard.ID}
          defaultColumnId={createColId}
          columns={currentBoard.columns ?? []}
          swimlanes={currentBoard.swimlanes ?? []}
          onClose={() => setCreateColId(null)}
          onCreated={load}
        />
      )}
    </div>
  );
}
