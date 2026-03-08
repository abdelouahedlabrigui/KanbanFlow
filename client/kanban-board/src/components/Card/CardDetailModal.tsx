import React, { useEffect, useState } from 'react';
import { X, User, Tag, Calendar, Hash, ArrowRight, RotateCcw, MessageSquare, Plus, Trash2, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import type { CardDetail, Column } from '../../types';
import { cardsApi } from '../../utils/api';
import { useToast } from '../../hooks/useToast';

interface Props {
  cardId: string;
  columns: Column[];
  onClose: () => void;
  onCardUpdated: () => void;
  onMoveCard: (cardId: string, toColumnId: string, reason?: string) => void;
}

export function CardDetailModal({ cardId, columns, onClose, onCardUpdated, onMoveCard }: Props) {
  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [newCheckItem, setNewCheckItem] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('Me');
  const [moveToCol, setMoveToCol] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [showMoveForm, setShowMoveForm] = useState(false);
  const { toast } = useToast();

  const loadCard = async () => {
    try {
      const data = await cardsApi.get(cardId);
      setCard(data);
      setTitle(data.TITLE);
      setDesc(data.DESCRIPTION ?? '');
    } catch {
      toast('Failed to load card', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCard(); }, [cardId]);

  const saveTitle = async () => {
    if (!title.trim()) return;
    await cardsApi.update(cardId, { TITLE: title } as never);
    setEditTitle(false);
    onCardUpdated();
    loadCard();
  };

  const saveDesc = async () => {
    await cardsApi.update(cardId, { DESCRIPTION: desc } as never);
    toast('Description saved', 'success');
    onCardUpdated();
  };

  const toggleCheck = async (itemId: string) => {
    await cardsApi.toggleChecklist(cardId, itemId);
    loadCard();
    onCardUpdated();
  };

  const addCheckItem = async () => {
    if (!newCheckItem.trim()) return;
    await cardsApi.addChecklist(cardId, newCheckItem.trim());
    setNewCheckItem('');
    loadCard();
    onCardUpdated();
  };

  const deleteCheckItem = async (itemId: string) => {
    await cardsApi.deleteChecklist(cardId, itemId);
    loadCard();
    onCardUpdated();
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    await cardsApi.addComment(cardId, commentAuthor, newComment.trim());
    setNewComment('');
    loadCard();
  };

  const handleMove = async () => {
    if (!moveToCol) return;
    try {
      await onMoveCard(cardId, moveToCol, moveReason);
      setShowMoveForm(false);
      setMoveToCol('');
      setMoveReason('');
      await loadCard();
    } catch {
      // parent handles error
    }
  };

  const updateField = async (field: string, value: unknown) => {
    await cardsApi.update(cardId, { [field]: value } as never);
    loadCard();
    onCardUpdated();
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
          <div className="loading-full" style={{ height: 300 }}><div className="spinner" /></div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const checkTotal = Array.isArray(card.checklist) ? card.checklist.length : 0;
  const checkDone = Array.isArray(card.checklist) ? card.checklist.filter((i) => i.IS_DONE).length : 0;

  const currentColIdx = columns.findIndex((c) => c.ID === card.COLUMN_ID);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ flex: 1 }}>
            {editTitle ? (
              <input
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                autoFocus
              />
            ) : (
              <div className="card-detail-title" onClick={() => setEditTitle(true)} style={{ cursor: 'text' }}>
                {card.TITLE}
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: 4 }}>
              Created {format(new Date(card.CREATED_AT), 'MMM d, yyyy HH:mm')}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="card-detail-grid">
          {/* Main */}
          <div className="card-detail-main">
            {/* Description */}
            <div style={{ marginBottom: 20 }}>
              <div className="section-title">Description</div>
              <textarea
                className="form-input"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onBlur={saveDesc}
                placeholder="Add description..."
                rows={4}
              />
            </div>

            {/* Checklist */}
            <div style={{ marginBottom: 20 }}>
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckSquare size={13} />
                Definition of Done ({checkDone}/{checkTotal})
                {checkTotal > 0 && (
                  <div style={{ flex: 1, height: 4, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden', marginLeft: 8 }}>
                    <div style={{ width: `${Math.round((checkDone / checkTotal) * 100)}%`, height: '100%', background: 'var(--accent-green)', transition: 'width 0.3s' }} />
                  </div>
                )}
              </div>

              {Array.isArray(card.checklist) && card.checklist.map((item) => (
                <div key={item.ID} className="checklist-item">
                  <div
                    className={`checklist-check ${item.IS_DONE ? 'checked' : ''}`}
                    onClick={() => toggleCheck(item.ID)}
                  >
                    {item.IS_DONE ? <span style={{ color: '#000', fontSize: 10, fontWeight: 700 }}>✓</span> : null}
                  </div>
                  <span className={`checklist-text ${item.IS_DONE ? 'done' : ''}`}>{item.TITLE}</span>
                  <button className="btn-icon" onClick={() => deleteCheckItem(item.ID)} style={{ opacity: 0.4 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
                <input
                  className="form-input"
                  placeholder="Add checklist item..."
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCheckItem()}
                />
                <button className="btn btn-ghost btn-sm" onClick={addCheckItem}><Plus size={14} /></button>
              </div>
            </div>

            {/* Move card */}
            <div style={{ marginBottom: 20 }}>
              <div className="section-title">Move Card</div>
              {!showMoveForm ? (
                <button className="btn btn-ghost btn-sm" onClick={() => setShowMoveForm(true)}>
                  <ArrowRight size={13} /> Move to column
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {currentColIdx > -1 && columns.findIndex((c) => c.ID === moveToCol) < currentColIdx && (
                    <div className="recycle-warning">
                      <RotateCcw size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                      Moving backwards (recycle). A reason will be logged.
                    </div>
                  )}
                  <select className="form-input" value={moveToCol} onChange={(e) => setMoveToCol(e.target.value)}>
                    <option value="">Select column...</option>
                    {columns.filter((c) => c.ID !== card.COLUMN_ID).map((c) => (
                      <option key={c.ID} value={c.ID}>{c.TITLE}</option>
                    ))}
                  </select>
                  <input
                    className="form-input"
                    placeholder="Reason (optional)"
                    value={moveReason}
                    onChange={(e) => setMoveReason(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button className="btn btn-primary btn-sm" onClick={handleMove}>Move</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowMoveForm(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* Move history */}
            {card.moves?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="section-title">Move History</div>
                {card.moves.map((m) => (
                  <div key={m.ID} style={{ fontSize: '0.78rem', color: 'var(--text-2)', padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {m.IS_RECYCLE === 1 && <RotateCcw size={11} color="var(--accent-amber)" />}
                    <span>{m.FROM_COL_TITLE ?? '?'} → {m.TO_COL_TITLE ?? '?'}</span>
                    {m.REASON && <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>"{m.REASON}"</span>}
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                      {format(new Date(m.MOVED_AT), 'MMM d HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Comments */}
            <div>
              <div className="section-title"><MessageSquare size={13} style={{ display: 'inline', marginRight: 5 }} />Comments</div>
              {card.comments?.map((c) => (
                <div key={c.ID} style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: 4 }}>
                    {c.AUTHOR} · {format(new Date(c.CREATED_AT), 'MMM d HH:mm')}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-0)' }}>{c.CONTENT}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
                <input
                  className="form-input"
                  style={{ width: 90 }}
                  value={commentAuthor}
                  onChange={(e) => setCommentAuthor(e.target.value)}
                  placeholder="Author"
                />
                <input
                  className="form-input"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addComment()}
                  placeholder="Add comment..."
                />
                <button className="btn btn-ghost btn-sm" onClick={addComment}><Plus size={14} /></button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="card-detail-sidebar">
            <div className="sidebar-field">
              <label className="form-label"><User size={11} style={{ display: 'inline', marginRight: 4 }} />Owner</label>
              <input
                className="form-input"
                defaultValue={card.OWNER ?? ''}
                onBlur={(e) => updateField('OWNER', e.target.value || null)}
                placeholder="Unassigned"
              />
            </div>

            <div className="sidebar-field">
              <label className="form-label">Priority</label>
              <select
                className="form-input"
                defaultValue={card.PRIORITY}
                onChange={(e) => updateField('PRIORITY', e.target.value)}
              >
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="sidebar-field">
              <label className="form-label"><Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />Due Date</label>
              <input
                className="form-input"
                type="date"
                defaultValue={card.DUE_DATE ? format(new Date(card.DUE_DATE), 'yyyy-MM-dd') : ''}
                onChange={(e) => updateField('DUE_DATE', e.target.value || null)}
              />
            </div>

            <div className="sidebar-field">
              <label className="form-label"><Hash size={11} style={{ display: 'inline', marginRight: 4 }} />Story Points</label>
              <input
                className="form-input"
                type="number"
                min={0}
                defaultValue={card.STORY_POINTS ?? ''}
                onBlur={(e) => updateField('STORY_POINTS', e.target.value ? Number(e.target.value) : null)}
                placeholder="0"
              />
            </div>

            <div className="sidebar-field">
              <label className="form-label"><Tag size={11} style={{ display: 'inline', marginRight: 4 }} />Tags</label>
              <input
                className="form-input"
                defaultValue={card.TAGS ?? ''}
                onBlur={(e) => updateField('TAGS', e.target.value || null)}
                placeholder="tag1, tag2"
              />
            </div>

            <div className="sidebar-field">
              <label className="form-label">Status</label>
              <div className="sidebar-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>
                {card.STATUS}
              </div>
            </div>

            {card.STARTED_AT && (
              <div className="sidebar-field">
                <label className="form-label">Started</label>
                <div className="sidebar-value">{format(new Date(card.STARTED_AT), 'MMM d, HH:mm')}</div>
              </div>
            )}

            {card.COMPLETED_AT && (
              <div className="sidebar-field">
                <label className="form-label">Completed</label>
                <div className="sidebar-value" style={{ color: 'var(--accent-green)' }}>
                  {format(new Date(card.COMPLETED_AT), 'MMM d, HH:mm')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
