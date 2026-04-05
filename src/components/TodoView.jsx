import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, X, Brain, Zap, Users, LayoutList, LayoutGrid, Trash2, RotateCcw } from 'lucide-react';
import { getTodoTasks, addTodoTask, updateTodoTask, removeTodoTask, calculateTodoScore } from '../utils/storage';

const MODE_CONFIG = {
  quick: { label: 'Hemen Hallet', icon: Zap, emoji: '⚡', color: '#00d4ff' },
  focus: { label: 'Odaklan', icon: Brain, emoji: '🧠', color: '#00d4ff' },
  delegate: { label: 'Takip Et', icon: Users, emoji: '👥', color: '#00d4ff' },
};

export default function TodoView({ selectedDateStr, onDataChange }) {
  const [activeMode, setActiveMode] = useState(null); // null = tüm görevler
  const [viewType, setViewType] = useState('list');
  const [fabOpen, setFabOpen] = useState(false);
  const [fabMode, setFabMode] = useState(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [delegateName, setDelegateName] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const inputRef = useRef(null);

  // Focus input when creation form appears
  useEffect(() => {
    if (fabMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [fabMode]);

  // Close FAB when clicking outside
  useEffect(() => {
    if (!fabOpen) return;
    const handleClickOutside = (e) => {
      const fabContainer = document.querySelector('.todo-fab-container');
      if (fabContainer && !fabContainer.contains(e.target)) {
        setFabOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [fabOpen]);

  const tasks = useMemo(() => {
    return getTodoTasks(selectedDateStr);
  }, [selectedDateStr, onDataChange]);

  const filteredTasks = useMemo(() => {
    if (activeMode === null) return tasks; // Tüm görevler
    return tasks.filter(t => t.size === activeMode);
  }, [tasks, activeMode]);

  const todoScore = useMemo(() => calculateTodoScore(selectedDateStr), [selectedDateStr, onDataChange]);

  // ======= Handlers =======

  const handleModeClick = (key) => {
    // Aynı moda tekrar basılırsa seçimi kaldır
    setActiveMode(prev => prev === key ? null : key);
  };

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      txt: newTaskText.trim(),
      done: false,
      pri: 1,
      size: fabMode,
      who: fabMode === 'delegate' ? delegateName.trim() : undefined,
    };
    addTodoTask(selectedDateStr, task);
    setNewTaskText('');
    setDelegateName('');
    setFabMode(null);
    setFabOpen(false);
    onDataChange?.();
  };

  const handleToggle = (task) => {
    if (task.done) {
      setConfirmModal({ dateStr: selectedDateStr, taskId: task.id, task });
      return;
    }
    updateTodoTask(selectedDateStr, task.id, { done: true });
    onDataChange?.();
  };

  const confirmUncheck = () => {
    if (!confirmModal) return;
    updateTodoTask(confirmModal.dateStr, confirmModal.taskId, { done: false });
    setConfirmModal(null);
    onDataChange?.();
  };

  const handleDelete = (taskId) => {
    removeTodoTask(selectedDateStr, taskId);
    onDataChange?.();
  };

  const handleFabSelect = (mode) => {
    setFabMode(mode);
    setFabOpen(false);
  };

  // ======= Progress Bar =======
  const doneCount = tasks.filter(t => t.done).length;
  const progressPercent = Math.min((doneCount / 3) * 100, 100);

  // ======= Render =======
  return (
    <div className="fade-in" style={{ position: 'relative', minHeight: '60vh' }}>
      {/* Mode Buttons */}
      <div className="glass-card" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {Object.entries(MODE_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => handleModeClick(key)}
              className={`todo-mode-btn ${activeMode === key ? 'active' : ''}`}
            >
              <span>{cfg.emoji}</span>
              <span>{cfg.label}</span>
            </button>
          ))}

          {/* View Toggle */}
          <button
            onClick={() => setViewType(v => v === 'list' ? 'card' : 'list')}
            className="todo-view-toggle"
            title={viewType === 'list' ? 'Kart Görünümü' : 'Liste Görünümü'}
          >
            {viewType === 'list' ? <LayoutGrid size={18} /> : <LayoutList size={18} />}
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              GÜN İLERLEME ({doneCount}/3 görev)
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#00d4ff' }}>
              {Math.round(progressPercent)}%
            </span>
          </div>
          <div className="todo-progress-bar">
            <div className="todo-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Task List / Card View */}
      {filteredTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
          <p>{activeMode ? 'Bu kategoride görev yok.' : 'Henüz görev eklenmedi.'}</p>
          <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Sağ alttaki + butonuna tıklayarak ekle.</p>
        </div>
      ) : (
        <div className={viewType === 'card' ? 'todo-card-grid' : 'todo-list'}>
          {filteredTasks.map(task => {
            const taskEmoji = MODE_CONFIG[task.size]?.emoji || '';
            return (
              <div
                key={task.id}
                className={`todo-item ${viewType === 'card' ? 'todo-card' : 'todo-list-item'} ${task.done ? 'done' : ''} ${task.rolledFrom ? 'rolled' : ''}`}
              >
                {/* Rolled indicator */}
                {task.rolledFrom && !task.done && (
                  <div className="todo-rolled-badge">
                    <RotateCcw size={10} />
                    <span>Devretti</span>
                  </div>
                )}

                <div className="todo-item-content" onClick={() => handleToggle(task)}>
                  {/* Checkbox */}
                  <div className={`todo-checkbox ${task.done ? 'checked' : ''}`}>
                    {task.done && <span>✓</span>}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className={`todo-text ${task.done ? 'done-text' : ''}`}>
                      {taskEmoji} {task.txt}
                    </span>
                    {task.who && (
                      <div className="todo-delegate-label">
                        <Users size={12} />
                        <span>{task.who}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button className="todo-delete-btn" onClick={() => handleDelete(task.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ========== FAB (Floating Action Button) ========== */}
      <div className="todo-fab-container">
        {/* Expanded category buttons — order: Quick, Focus, Delegate (bottom to top) */}
        {fabOpen && (
          <div className="todo-fab-options">
            <button
              className="todo-fab-option"
              style={{ '--fab-delay': '0.05s' }}
              onClick={() => handleFabSelect('delegate')}
              title="Takip Et"
            >
              <Users size={22} />
            </button>
            <button
              className="todo-fab-option"
              style={{ '--fab-delay': '0.1s' }}
              onClick={() => handleFabSelect('focus')}
              title="Odaklan"
            >
              <Brain size={22} />
            </button>
            <button
              className="todo-fab-option"
              style={{ '--fab-delay': '0.15s' }}
              onClick={() => handleFabSelect('quick')}
              title="Hemen Hallet"
            >
              <Zap size={22} />
            </button>
          </div>
        )}

        {/* Main FAB */}
        <button
          className={`todo-fab-main ${fabOpen ? 'open' : ''}`}
          onClick={() => { setFabOpen(!fabOpen); setFabMode(null); }}
        >
          {fabOpen ? <X size={28} /> : <Plus size={28} />}
        </button>
      </div>

      {/* ========== Task Creation Modal ========== */}
      {fabMode && (
        <div className="modal-overlay" onClick={() => { setFabMode(null); setNewTaskText(''); setDelegateName(''); }}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.5rem' }}>{MODE_CONFIG[fabMode].emoji}</span>
              <h3 style={{ color: '#00d4ff', margin: 0 }}>{MODE_CONFIG[fabMode].label} Görevi Ekle</h3>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              placeholder="Görev adını yaz..."
              className="todo-input"
              onKeyDown={e => { if (e.key === 'Enter' && fabMode !== 'delegate') handleAddTask(); }}
            />

            {fabMode === 'delegate' && (
              <input
                type="text"
                value={delegateName}
                onChange={e => setDelegateName(e.target.value)}
                placeholder="Kime delege edilecek?"
                className="todo-input"
                style={{ marginTop: '10px' }}
                onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); }}
              />
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn-cancel" onClick={() => { setFabMode(null); setNewTaskText(''); setDelegateName(''); }}>İptal</button>
              <button className="btn-save" style={{ background: '#00d4ff' }} onClick={handleAddTask} disabled={!newTaskText.trim()}>Ekle</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Uncheck Confirmation Modal ========== */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '12px', color: '#00d4ff' }}>Emin misiniz?</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
              <strong>"{confirmModal.task.txt}"</strong> görevinin tamamlanma durumunu kaldırmak istediğinize emin misiniz?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-cancel" onClick={() => setConfirmModal(null)}>Vazgeç</button>
              <button className="btn-save" style={{ background: 'var(--error-color)' }} onClick={confirmUncheck}>Evet, Kaldır</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
