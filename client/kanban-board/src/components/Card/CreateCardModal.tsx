import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Column, Swimlane } from '../../types';
import { cardsApi } from '../../utils/api';
import { useToast } from '../../hooks/useToast';

interface Props {
  boardId: string;
  defaultColumnId: string;
  columns: Column[];
  swimlanes: Swimlane[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateCardModal({ boardId, defaultColumnId, columns, swimlanes, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [priority, setPriority] = useState<'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState('');
  const [storyPoints, setStoryPoints] = useState('');
  const [columnId, setColumnId] = useState(defaultColumnId);
  const [swimlaneId, setSwimlaneId] = useState(swimlanes[0]?.ID ?? '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await cardsApi.create({
        boardId,
        columnId,
        swimlaneId: swimlaneId || undefined,
        title: title.trim(),
        TITLE: title.trim(),
        description: description || undefined,
        owner: owner || undefined,
        priority,
        dueDate: dueDate || undefined,
        tags: tags || undefined,
        storyPoints: storyPoints ? Number(storyPoints) : undefined,
      } as never);
      toast('Card created', 'success');
      onCreated();
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">New Card</span>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add details..." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Column</label>
                <select className="form-input" value={columnId} onChange={(e) => setColumnId(e.target.value)}>
                  {columns.map((c) => <option key={c.ID} value={c.ID}>{c.TITLE}</option>)}
                </select>
              </div>

              {swimlanes.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Swimlane</label>
                  <select className="form-input" value={swimlaneId} onChange={(e) => setSwimlaneId(e.target.value)}>
                    <option value="">None</option>
                    {swimlanes.map((s) => <option key={s.ID} value={s.ID}>{s.TITLE}</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Owner</label>
                <input className="form-input" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Assignee" />
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-input" value={priority} onChange={(e) => setPriority(e.target.value as never)}>
                  {['LOW','MEDIUM','HIGH','CRITICAL'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input className="form-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Story Points</label>
                <input className="form-input" type="number" min={0} value={storyPoints} onChange={(e) => setStoryPoints(e.target.value)} placeholder="0" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tags (comma separated)</label>
              <input className="form-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="backend, bug, feature" />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !title.trim()}>
              {loading ? 'Creating...' : 'Create Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
