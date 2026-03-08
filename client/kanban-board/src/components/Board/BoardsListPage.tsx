import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LayoutDashboard, Trash2 } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import { boardsApi } from '../../utils/api';
import { useToast } from '../../hooks/useToast';

export function BoardsListPage() {
  const navigate = useNavigate();
  const { boards, fetchBoards, loading } = useBoardStore();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchBoards(); }, []);

  const createBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const { id } = await boardsApi.create({ title: newTitle.trim(), description: newDesc });
      toast('Board created!', 'success');
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      navigate(`/board/${id}`);
    } catch {
      toast('Failed to create board', 'error');
    } finally {
      setCreating(false);
    }
  };

  const deleteBoard = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this board and all its data?')) return;
    try {
      await boardsApi.delete(id);
      fetchBoards();
      toast('Board deleted', 'info');
    } catch {
      toast('Failed to delete', 'error');
    }
  };

  return (
    <div className="boards-page">
      <div className="boards-header">
        <div>
          <div className="boards-heading">Your Boards</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginTop: 3 }}>
            {boards.length} board{boards.length !== 1 ? 's' : ''} · Powered by Oracle DB + qwen3:0.6b
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
            <Plus size={15} /> New Board
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={createBoard} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, marginBottom: 24 }}>
          <div className="form-group">
            <label className="form-label">Board Title *</label>
            <input className="form-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Marketing Q1" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional description" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={creating || !newTitle.trim()}>
              {creating ? 'Creating...' : 'Create Board'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading && boards.length === 0 ? (
        <div className="loading-full" style={{ height: 200 }}><div className="spinner" /></div>
      ) : boards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><LayoutDashboard size={48} color="var(--text-3)" /></div>
          <div className="empty-state-title">No boards yet</div>
          <div className="empty-state-sub">Create your first Kanban board to get started</div>
        </div>
      ) : (
        <div className="boards-grid">
          {boards.map((board) => (
            <div key={board.ID} className="board-card" onClick={() => navigate(`/board/${board.ID}`)}>
              <div className="board-card-title">{board.TITLE}</div>
              {board.DESCRIPTION && <div className="board-card-desc">{board.DESCRIPTION}</div>}
              <div className="board-card-stats">
                <span className="board-stat"><strong>{board.card_count ?? 0}</strong> cards</span>
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-icon" onClick={(e) => deleteBoard(e, board.ID)} style={{ opacity: 0.4, color: 'var(--accent-red)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
