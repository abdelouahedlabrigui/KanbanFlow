import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { LayoutDashboard, Github } from 'lucide-react';
import { ToastProvider } from './hooks/useToast';
import { BoardsListPage } from './components/Board/BoardsListPage';
import { BoardPage } from './components/Board/BoardPage';
import './styles/global.css';

function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" style={{ textDecoration: 'none' }}>
        <div className="navbar-logo">
          <LayoutDashboard size={18} />
          <span>Kanban<span style={{ color: 'var(--text-1)' }}>Flow</span></span>
        </div>
      </Link>

      <div style={{ height: 20, width: 1, background: 'var(--border)', margin: '0 4px' }} />

      <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        Oracle · React · qwen3:0.6b
      </span>

      <div className="navbar-actions">
        <a href="https://github.com" className="btn-icon" style={{ color: 'var(--text-2)' }}>
          <Github size={16} />
        </a>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="app-shell">
          <Navbar />
          <div className="main-content">
            <Routes>
              <Route path="/" element={<BoardsListPage />} />
              <Route path="/board/:boardId" element={<BoardPage />} />
            </Routes>
          </div>
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}
