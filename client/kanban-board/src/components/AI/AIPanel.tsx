import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Sparkles, RefreshCw } from 'lucide-react';
import type { AIMessage } from '../../types';
import { aiApi } from '../../utils/api';

interface Props {
  boardId?: string;
  open: boolean;
  onClose: () => void;
}

const STARTERS = [
  'What are the bottlenecks on this board?',
  'How can I improve our cycle time?',
  'Which cards are at risk?',
  'Summarize our team workload',
  'Suggest how to reduce WIP',
];

export function AIPanel({ boardId, open, onClose }: Props) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: AIMessage = { role: 'user', content, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await aiApi.chat([...messages, userMsg], boardId);
      setMessages((prev) => [...prev, { role: 'assistant', content: response.message, timestamp: Date.now() }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠ AI service unavailable. Make sure Ollama is running:\n`ollama serve && ollama pull qwen3:0.6b`', timestamp: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getSuggestions = async () => {
    if (!boardId || loadingSuggest) return;
    setLoadingSuggest(true);
    try {
      const res = await aiApi.suggest(boardId);
      setSuggestions(res.suggestions);
    } catch {
      setSuggestions('AI service unavailable.');
    } finally {
      setLoadingSuggest(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSuggestions(null);
  };

  return (
    <div className={`ai-panel ${open ? 'open' : ''}`}>
      <div className="ai-panel-header">
        <Bot size={16} color="var(--accent-cyan)" />
        <span className="ai-panel-title">KanbanAI</span>
        <span className="ai-model-badge">qwen3:0.6b</span>
        <button className="btn-icon" onClick={clearChat} title="Clear chat"><RefreshCw size={13} /></button>
        <button className="btn-icon" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="ai-messages">
        {messages.length === 0 && !suggestions && (
          <div style={{ padding: '12px 0' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
              I'm your Agile coach. Ask me about your board health, bottlenecks, metrics, or best practices.
            </div>

            {boardId && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginBottom: 12, width: '100%' }}
                onClick={getSuggestions}
                disabled={loadingSuggest}
              >
                <Sparkles size={12} />
                {loadingSuggest ? 'Analyzing...' : 'Get AI Suggestions'}
              </button>
            )}

            {suggestions && (
              <div style={{
                background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                padding: '10px 12px', fontSize: '0.82rem', lineHeight: 1.65, color: 'var(--text-1)',
                marginBottom: 12, whiteSpace: 'pre-wrap'
              }}>
                {suggestions}
              </div>
            )}

            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Quick questions
            </div>
            {STARTERS.map((s) => (
              <button key={s} className="btn btn-ghost btn-sm" style={{ display: 'block', width: '100%', marginBottom: 5, textAlign: 'left' }} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`ai-message ${msg.role}`}>
            <div className="ai-bubble">{msg.content}</div>
          </div>
        ))}

        {loading && (
          <div className="ai-message assistant">
            <div className="ai-bubble">
              <div className="ai-typing">
                <div className="ai-typing-dot" />
                <div className="ai-typing-dot" />
                <div className="ai-typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="ai-input-area">
        <textarea
          className="ai-input"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask about your board..."
          disabled={loading}
        />
        <button
          className="btn btn-primary"
          style={{ padding: '8px 12px', alignSelf: 'flex-end' }}
          onClick={() => send()}
          disabled={!input.trim() || loading}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
