import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Plus, X, Brain, Zap, Users, LayoutList, LayoutGrid, Trash2, RotateCcw, Play, Pause, Timer } from 'lucide-react';
import { getTodoTasks, addTodoTask, updateTodoTask, removeTodoTask, calculateTodoScore, getActivePomodoro, setActivePomodoro, clearActivePomodoro } from '../utils/storage';
import { getActiveDateString } from '../utils/date';

const MODE_CONFIG = {
  quick: { label: 'Hemen Hallet', icon: Zap, emoji: '⚡', color: '#00d4ff' },
  focus: { label: 'Odaklan', icon: Brain, emoji: '🧠', color: '#00d4ff' },
  delegate: { label: 'Takip Et', icon: Users, emoji: '👥', color: '#00d4ff' },
};

const POMODORO_DURATION = 25 * 60;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getDaysDiff(fromDateStr, toDateStr) {
  const from = new Date(fromDateStr);
  const to = new Date(toDateStr);
  const diffMs = to.getTime() - from.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export default function TodoView({ selectedDateStr, onDataChange }) {
  const [activeMode, setActiveMode] = useState(null);
  const [viewType, setViewType] = useState('list');
  const [fabOpen, setFabOpen] = useState(false);
  const [fabMode, setFabMode] = useState(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [delegateName, setDelegateName] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [pomodoroCompleteModal, setPomodoroCompleteModal] = useState(null);
  const [editModal, setEditModal] = useState(null); // { task }
  const [editText, setEditText] = useState('');
  const [editWho, setEditWho] = useState('');
  const inputRef = useRef(null);
  const editInputRef = useRef(null);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  const todayStr = getActiveDateString();
  const isPastDay = selectedDateStr < todayStr;

  // ======= Pomodoro State =======
  const [pomodoro, setPomodoro] = useState(() => {
    const saved = getActivePomodoro();
    if (saved && saved.status === 'running') {
      const elapsed = Math.floor((Date.now() - saved.lastTimestamp) / 1000);
      const remaining = Math.max(saved.timeLeft - elapsed, 0);
      if (remaining <= 0) {
        clearActivePomodoro();
        return null;
      }
      return { ...saved, timeLeft: remaining };
    }
    return saved;
  });

  // Pomodoro active task name
  const pomoTaskName = useMemo(() => {
    if (!pomodoro) return '';
    const allTasks = getTodoTasks(pomodoro.dateStr);
    const task = allTasks.find(t => t.id === pomodoro.taskId);
    return task ? task.txt : '';
  }, [pomodoro?.taskId]);

  // Pomodoro countdown
  useEffect(() => {
    if (!pomodoro || pomodoro.status !== 'running') return;

    const interval = setInterval(() => {
      setPomodoro(prev => {
        if (!prev || prev.status !== 'running') return prev;
        const newTime = prev.timeLeft - 1;
        if (newTime <= 0) {
          clearActivePomodoro();
          setPomodoroCompleteModal({ taskId: prev.taskId, dateStr: prev.dateStr });
          return null;
        }
        const updated = { ...prev, timeLeft: newTime, lastTimestamp: Date.now() };
        setActivePomodoro(updated);
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pomodoro?.status, pomodoro?.taskId]);

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
    if (activeMode === null) return tasks;
    return tasks.filter(t => t.size === activeMode);
  }, [tasks, activeMode]);

  // ======= Pomodoro Handlers =======

  const startPomodoro = useCallback((taskId) => {
    const data = {
      taskId,
      dateStr: selectedDateStr,
      timeLeft: POMODORO_DURATION,
      status: 'running',
      lastTimestamp: Date.now()
    };
    setActivePomodoro(data);
    setPomodoro(data);
  }, [selectedDateStr]);

  const pausePomodoro = useCallback(() => {
    setPomodoro(prev => {
      if (!prev) return prev;
      const updated = { ...prev, status: 'paused', lastTimestamp: Date.now() };
      setActivePomodoro(updated);
      return updated;
    });
  }, []);

  const resumePomodoro = useCallback(() => {
    setPomodoro(prev => {
      if (!prev) return prev;
      const updated = { ...prev, status: 'running', lastTimestamp: Date.now() };
      setActivePomodoro(updated);
      return updated;
    });
  }, []);

  const cancelPomodoro = useCallback(() => {
    clearActivePomodoro();
    setPomodoro(null);
  }, []);

  // ======= Task Handlers =======

  const handleModeClick = (key) => {
    setActiveMode(prev => prev === key ? null : key);
  };

  // Long press to edit
  const handlePointerDown = (task) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setEditModal({ task });
      setEditText(task.txt);
      setEditWho(task.who || '');
    }, 500);
  };

  const handlePointerUp = () => {
    clearTimeout(longPressTimer.current);
  };

  const handlePointerLeave = () => {
    clearTimeout(longPressTimer.current);
  };

  const handleEditSave = () => {
    if (!editModal || !editText.trim()) return;
    const updates = { txt: editText.trim() };
    if (editModal.task.size === 'delegate') {
      updates.who = editWho.trim();
    }
    updateTodoTask(selectedDateStr, editModal.task.id, updates);
    setEditModal(null);
    setEditText('');
    setEditWho('');
    onDataChange?.();
  };

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      txt: newTaskText.trim(),
      done: false,
      pri: 1,
      size: fabMode,
      createdAt: selectedDateStr,
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
    if (pomodoro && pomodoro.taskId === task.id) {
      clearActivePomodoro();
      setPomodoro(null);
    }
    onDataChange?.();
  };

  const confirmUncheck = () => {
    if (!confirmModal) return;
    updateTodoTask(confirmModal.dateStr, confirmModal.taskId, { done: false });
    setConfirmModal(null);
    onDataChange?.();
  };

  const handleDelete = (taskId) => {
    if (pomodoro && pomodoro.taskId === taskId) {
      clearActivePomodoro();
      setPomodoro(null);
    }
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

  // Pomodoro progress (for circular ring)
  const pomoProgress = pomodoro ? ((POMODORO_DURATION - pomodoro.timeLeft) / POMODORO_DURATION) * 100 : 0;
  const pomoCircumference = 2 * Math.PI * 90;
  const pomoOffset = pomoCircumference - (pomoProgress / 100) * pomoCircumference;

  // ======= Render =======
  return (
    <div className="fade-in" style={{ position: 'relative', minHeight: '60vh' }}>

      {/* ========== Pomodoro Overlay Pop-up ========== */}
      {pomodoro && (
        <div className="pomo-overlay">
          <div className="pomo-popup glass-card">
            <div className="pomo-popup-header">
              <Timer size={18} className="pomo-timer-icon" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>POMODORO</span>
            </div>

            {/* Circular Timer */}
            <div className="pomo-circle-container">
              <svg className="pomo-circle-svg" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="90" className="pomo-circle-bg" />
                <circle
                  cx="100" cy="100" r="90"
                  className="pomo-circle-fill"
                  strokeDasharray={pomoCircumference}
                  strokeDashoffset={pomoOffset}
                />
              </svg>
              <div className="pomo-circle-text">
                <span className="pomo-big-time">{formatTime(pomodoro.timeLeft)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="pomo-popup-controls">
              {pomodoro.status === 'running' ? (
                <button className="pomo-popup-btn" onClick={pausePomodoro}>
                  <Pause size={20} />
                  <span>Durdur</span>
                </button>
              ) : (
                <button className="pomo-popup-btn" onClick={resumePomodoro}>
                  <Play size={20} />
                  <span>Devam</span>
                </button>
              )}
              <button className="pomo-popup-btn pomo-popup-cancel" onClick={cancelPomodoro}>
                <X size={20} />
                <span>İptal</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
          {!isPastDay && <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Sağ alttaki + butonuna tıklayarak ekle.</p>}
        </div>
      ) : (
        <div className={viewType === 'card' ? 'todo-card-grid' : 'todo-list'}>
          {filteredTasks.map(task => {
            const taskEmoji = MODE_CONFIG[task.size]?.emoji || '';
            const isPomoActive = pomodoro && pomodoro.taskId === task.id;
            const isPomoRunning = isPomoActive && pomodoro.status === 'running';

            // Dinamik rollover gün sayısı
            const rolloverDays = task.createdAt ? getDaysDiff(task.createdAt, todayStr) : 0;

            return (
              <div
                key={task.id}
                className={`todo-item ${viewType === 'card' ? 'todo-card' : 'todo-list-item'} ${task.done ? 'done' : ''} ${rolloverDays > 0 && !task.done ? 'rolled' : ''} ${isPomoRunning ? 'pomo-active' : ''}`}
              >
                {/* Rolled indicator — Dinamik Gün Sayacı */}
                {rolloverDays > 0 && !task.done && (
                  <div className="todo-rolled-badge">
                    <RotateCcw size={10} />
                    <span>{rolloverDays} Gündür Devrediyor</span>
                  </div>
                )}

                <div
                  className="todo-item-content"
                  onClick={() => { if (!longPressTriggered.current) handleToggle(task); }}
                  onPointerDown={() => handlePointerDown(task)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerLeave}
                  style={{ userSelect: 'none' }}
                >
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

                {/* Pomodoro Start Button — Sadece focus, tamamlanmamış, ve bugünün tasklarında */}
                {task.size === 'focus' && !task.done && !isPastDay && (
                  <button
                    className="pomo-start-btn"
                    onClick={(e) => { e.stopPropagation(); startPomodoro(task.id); }}
                    disabled={pomodoro !== null}
                    title="Çalışmaya Başla"
                  >
                    <Play size={14} />
                  </button>
                )}

                {/* Delete button */}
                <button className="todo-delete-btn" onClick={() => handleDelete(task.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ========== FAB — Sadece bugün ve gelecek günlerde ========== */}
      {!isPastDay && (
        <div className="todo-fab-container">
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

          <button
            className={`todo-fab-main ${fabOpen ? 'open' : ''}`}
            onClick={() => { setFabOpen(!fabOpen); setFabMode(null); }}
          >
            {fabOpen ? <X size={28} /> : <Plus size={28} />}
          </button>
        </div>
      )}

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

      {/* ========== Pomodoro Complete Modal ========== */}
      {pomodoroCompleteModal && (
        <div className="modal-overlay" onClick={() => setPomodoroCompleteModal(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🎉</div>
              <h3 style={{ color: '#00d4ff', marginBottom: '8px' }}>Pomodoro Tamamlandı!</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>
                25 dakikalık çalışma süreniz doldu.<br />
                Görevi tamamladıysanız kutucuğu işaretleyin.
              </p>
            </div>
            <button
              className="btn-save"
              style={{ background: '#00d4ff', width: '100%' }}
              onClick={() => setPomodoroCompleteModal(null)}
            >
              Tamam
            </button>
          </div>
        </div>
      )}

      {/* ========== Edit Task Modal (Long Press) ========== */}
      {editModal && (
        <div className="modal-overlay" onClick={() => { setEditModal(null); setEditText(''); setEditWho(''); }}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.5rem' }}>{MODE_CONFIG[editModal.task.size]?.emoji}</span>
              <h3 style={{ color: '#00d4ff', margin: 0 }}>Görevi Düzenle</h3>
            </div>

            <input
              ref={editInputRef}
              type="text"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              placeholder="Görev adını yaz..."
              className="todo-input"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && editModal.task.size !== 'delegate') handleEditSave(); }}
            />

            {editModal.task.size === 'delegate' && (
              <input
                type="text"
                value={editWho}
                onChange={e => setEditWho(e.target.value)}
                placeholder="Kime delege edilecek?"
                className="todo-input"
                style={{ marginTop: '10px' }}
                onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); }}
              />
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn-cancel" onClick={() => { setEditModal(null); setEditText(''); setEditWho(''); }}>İptal</button>
              <button className="btn-save" style={{ background: '#00d4ff' }} onClick={handleEditSave} disabled={!editText.trim()}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
