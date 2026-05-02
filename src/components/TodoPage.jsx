// TodoPage — PersonaVK reskin of TodoView. Preserves all storage logic,
// Pomodoro persistence, long-press edit, snackbar undo, FAB and modals.
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Plus, X, Brain, Zap, Users, Trash2, RotateCcw, Play, Pause, Timer } from 'lucide-react';
import {
  getTodoTasks, addTodoTask, insertTodoTaskAt, updateTodoTask, removeTodoTask,
  getActivePomodoro, setActivePomodoro, clearActivePomodoro,
} from '../utils/storage';
import { getActiveDateString } from '../utils/date';
import { mkTheme } from '../theme';
import Header from './Header';

const POMODORO_DURATION = 25 * 60;

const MODE_CONFIG = {
  quick:    { label: 'Hemen',   shortLabel: 'Hemen',   icon: Zap,   emoji: '⚡' },
  focus:    { label: 'Odaklan', shortLabel: 'Odaklan', icon: Brain, emoji: '🧠' },
  delegate: { label: 'Takip Et', shortLabel: 'Takip Et', icon: Users, emoji: '👥' },
};

function playAlarmSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [784, 988, 784, 988, 1175];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.18);
      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.2);
    });
  } catch (e) { /* silent */ }
}

function formatTime(s) {
  const m = Math.floor(s / 60), r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

function getDaysDiff(fromStr, toStr) {
  const diff = new Date(toStr).getTime() - new Date(fromStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function TodoPage({ darkMode, selectedDateStr, setSelectedDateStr, refreshTrigger, onDataChange }) {
  const t = mkTheme(darkMode);

  const [activeMode, setActiveMode] = useState(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [fabMode, setFabMode] = useState(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [delegateName, setDelegateName] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [pomodoroCompleteModal, setPomodoroCompleteModal] = useState(null);
  const [showPomoPopup, setShowPomoPopup] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [editText, setEditText] = useState('');
  const [editWho, setEditWho] = useState('');
  const [snackbar, setSnackbar] = useState(null);
  const inputRef = useRef(null);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const snackbarTimer = useRef(null);

  const todayStr = getActiveDateString();
  const isPastDay = selectedDateStr < todayStr;

  const [pomodoro, setPomodoro] = useState(() => {
    const saved = getActivePomodoro();
    if (saved && saved.status === 'running') {
      const elapsed = Math.floor((Date.now() - saved.lastTimestamp) / 1000);
      const remaining = Math.max(saved.timeLeft - elapsed, 0);
      if (remaining <= 0) { clearActivePomodoro(); return null; }
      return { ...saved, timeLeft: remaining };
    }
    return saved;
  });

  useEffect(() => {
    if (!pomodoro || pomodoro.status !== 'running') return;
    const interval = setInterval(() => {
      setPomodoro(prev => {
        if (!prev || prev.status !== 'running') return prev;
        const newTime = prev.timeLeft - 1;
        if (newTime <= 0) {
          clearActivePomodoro();
          setPomodoroCompleteModal({ taskId: prev.taskId, dateStr: prev.dateStr });
          playAlarmSound();
          return null;
        }
        const updated = { ...prev, timeLeft: newTime, lastTimestamp: Date.now() };
        setActivePomodoro(updated);
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pomodoro?.status, pomodoro?.taskId]);

  useEffect(() => { if (fabMode && inputRef.current) inputRef.current.focus(); }, [fabMode]);

  const tasks = useMemo(() => getTodoTasks(selectedDateStr), [selectedDateStr, refreshTrigger]);
  const filteredTasks = useMemo(() => {
    const filtered = activeMode === null ? [...tasks] : tasks.filter(x => x.size === activeMode);
    // Newest-first within each section: reverse insertion order; keep done at bottom.
    const undone = filtered.filter(x => !x.done).reverse();
    const done = filtered.filter(x => x.done).reverse();
    return [...undone, ...done];
  }, [tasks, activeMode]);

  const startPomodoro = useCallback((taskId) => {
    const data = { taskId, dateStr: selectedDateStr, timeLeft: POMODORO_DURATION, status: 'running', lastTimestamp: Date.now() };
    setActivePomodoro(data); setPomodoro(data); setShowPomoPopup(true);
  }, [selectedDateStr]);
  const pausePomodoro  = useCallback(() => setPomodoro(p => { if (!p) return p; const u = { ...p, status: 'paused',  lastTimestamp: Date.now() }; setActivePomodoro(u); return u; }), []);
  const resumePomodoro = useCallback(() => setPomodoro(p => { if (!p) return p; const u = { ...p, status: 'running', lastTimestamp: Date.now() }; setActivePomodoro(u); return u; }), []);
  const cancelPomodoro = useCallback(() => { clearActivePomodoro(); setPomodoro(null); setShowPomoPopup(false); }, []);

  const handlePointerDown = (task) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setEditModal({ task }); setEditText(task.txt); setEditWho(task.who || '');
    }, 500);
  };
  const handlePointerUp = () => clearTimeout(longPressTimer.current);

  const handleEditSave = () => {
    if (!editModal || !editText.trim()) return;
    const updates = { txt: editText.trim() };
    if (editModal.task.size === 'delegate') updates.who = editWho.trim();
    updateTodoTask(selectedDateStr, editModal.task.id, updates);
    setEditModal(null); setEditText(''); setEditWho('');
    onDataChange?.();
  };

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      txt: newTaskText.trim(), done: false, pri: 1, size: fabMode,
      createdAt: selectedDateStr,
      who: fabMode === 'delegate' ? delegateName.trim() : undefined,
    };
    addTodoTask(selectedDateStr, task);
    setNewTaskText(''); setDelegateName(''); setFabMode(null); setFabOpen(false);
    onDataChange?.();
  };

  const handleToggle = (task) => {
    if (task.done) { setConfirmModal({ dateStr: selectedDateStr, taskId: task.id, task }); return; }
    if (pomodoro && pomodoro.taskId === task.id) {
      setConfirmModal({ dateStr: selectedDateStr, taskId: task.id, task, pomodoroWarning: true });
      return;
    }
    updateTodoTask(selectedDateStr, task.id, { done: true });
    onDataChange?.();
  };

  const confirmUncheck = () => {
    if (!confirmModal) return;
    updateTodoTask(confirmModal.dateStr, confirmModal.taskId, { done: false });
    setConfirmModal(null); onDataChange?.();
  };

  const handleDelete = (taskId) => {
    if (pomodoro && pomodoro.taskId === taskId) { clearActivePomodoro(); setPomodoro(null); }
    const idx = tasks.findIndex(x => x.id === taskId);
    const deleted = idx >= 0 ? tasks[idx] : null;
    removeTodoTask(selectedDateStr, taskId);
    onDataChange?.();
    if (deleted) {
      if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
      setSnackbar({ task: deleted, dateStr: selectedDateStr, index: idx });
      snackbarTimer.current = setTimeout(() => setSnackbar(null), 5000);
    }
  };

  const handleUndo = () => {
    if (!snackbar) return;
    insertTodoTaskAt(snackbar.dateStr, snackbar.task, snackbar.index);
    setSnackbar(null);
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    onDataChange?.();
  };

  const doneCount = tasks.filter(x => x.done).length;
  const progressPct = Math.min((doneCount / 3) * 100, 100);
  const pomoProg = pomodoro ? ((POMODORO_DURATION - pomodoro.timeLeft) / POMODORO_DURATION) * 100 : 0;
  const pomoCirc = 2 * Math.PI * 90;
  const pomoOff = pomoCirc - (pomoProg / 100) * pomoCirc;

  // ── Style helpers ──────────────────────────────────────────────
  const cardBase = {
    background: t.card, border: t.cardBorder, borderRadius: 20,
    boxShadow: t.cardShadow, color: t.text, padding: 18,
  };
  const modeBtn = (active) => ({
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
    background: active ? t.accent : t.hover,
    color: active ? t.accentText : t.text,
    transition: 'background 0.15s, color 0.15s',
  });
  const iconBtn = {
    width: 40, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer',
    background: t.hover, color: t.text,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    background: t.input, border: `1px solid ${t.inputBorder}`,
    color: t.text, fontSize: 14, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };
  const btnPrimary = {
    flex: 1, padding: '12px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: t.accent, color: t.accentText, fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
  };
  const btnGhost = {
    flex: 1, padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
    background: 'transparent', color: t.text,
    border: `1px solid ${t.inputBorder}`, fontSize: 14, fontFamily: 'inherit',
  };

  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20,
  };
  const modalStyle = { ...cardBase, padding: 24, maxWidth: 420, width: '100%' };

  return (
    <div style={{ position: 'relative', minHeight: '60vh' }}>

      {/* Page header */}
      <div className="page-title" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: '-0.5px' }}>To-Do</div>
        <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>Görevlerini organize et</div>
      </div>

      {/* Week strip */}
      <div style={{ marginBottom: 16 }}>
        <Header
          selectedDateStr={selectedDateStr}
          onSelectDate={setSelectedDateStr}
          refreshTrigger={refreshTrigger}
          mode="todo"
          showTitle={false}
          darkMode={darkMode}
        />
      </div>

      {/* Mode selector: 3 buttons side by side */}
      <div style={{ ...cardBase, marginBottom: 14, padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.entries(MODE_CONFIG).map(([key, cfg]) => {
            const active = activeMode === key;
            return (
              <button
                key={key}
                onClick={() => setActiveMode(prev => prev === key ? null : key)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 999,
                  border: `1px solid ${active ? (darkMode ? '#fff' : '#000') : t.inputBorder}`,
                  background: active ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : 'transparent',
                  color: active ? t.text : t.muted,
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                {cfg.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Task list / grid */}
      {filteredTasks.length === 0 ? (
        <div style={{ ...cardBase, textAlign: 'center', padding: 40, color: t.muted }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <p style={{ margin: 0 }}>{activeMode ? 'Bu kategoride görev yok.' : 'Henüz görev eklenmedi.'}</p>
          {!isPastDay && <p style={{ fontSize: 13, marginTop: 6 }}>Sağ alttaki + butonuna tıklayarak ekle.</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredTasks.map(task => {
            const emoji = MODE_CONFIG[task.size]?.emoji || '';
            const isPomoActive = pomodoro && pomodoro.taskId === task.id;
            const isPomoRunning = isPomoActive && pomodoro.status === 'running';
            const rolloverDays = task.createdAt ? getDaysDiff(task.createdAt, todayStr) : 0;

            return (
              <div key={task.id} style={{
                ...cardBase, padding: 14, position: 'relative',
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: task.done ? 0.55 : 1,
                border: isPomoRunning ? `1px solid ${t.accent}` : t.cardBorder,
                boxShadow: t.cardShadow,
              }}>
                {rolloverDays > 0 && !task.done && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6,
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '2px 6px', borderRadius: 8,
                    background: t.border, color: t.muted,
                    fontSize: 10, fontWeight: 700,
                  }}>
                    <RotateCcw size={10} />
                    <span>{rolloverDays}</span>
                  </div>
                )}

                <div
                  onClick={() => { if (!longPressTriggered.current) handleToggle(task); }}
                  onPointerDown={() => handlePointerDown(task)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer', userSelect: 'none', minWidth: 0,
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                    background: task.done ? t.accent : 'transparent',
                    border: task.done ? 'none' : `2px solid ${t.inputBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: t.accentText, fontWeight: 700, fontSize: 14,
                  }}>
                    {task.done && '✓'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: t.text, fontSize: 14, fontWeight: 500,
                      textDecoration: task.done ? 'line-through' : 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {emoji} {task.txt}
                    </div>
                    {task.who && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        marginTop: 4, color: t.muted, fontSize: 12,
                      }}>
                        <Users size={12} />
                        <span>{task.who}</span>
                      </div>
                    )}
                  </div>
                </div>

                {task.size === 'focus' && !task.done && !isPastDay && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isPomoActive) setShowPomoPopup(true);
                      else if (!pomodoro) startPomodoro(task.id);
                    }}
                    disabled={pomodoro !== null && !isPomoActive}
                    title={isPomoActive ? 'Sayacı Göster' : 'Çalışmaya Başla'}
                    style={{
                      width: 32, height: 32, borderRadius: 10, border: 'none',
                      background: isPomoActive ? t.accent : t.hover,
                      color: isPomoActive ? t.accentText : t.text,
                      cursor: (pomodoro !== null && !isPomoActive) ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: (pomodoro !== null && !isPomoActive) ? 0.4 : 1,
                    }}
                  >
                    {isPomoActive ? <Timer size={14} /> : <Play size={14} />}
                  </button>
                )}

                <button
                  onClick={() => handleDelete(task.id)}
                  style={{
                    width: 32, height: 32, borderRadius: 10, border: 'none',
                    background: 'transparent', color: t.muted, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      {!isPastDay && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100 }}>
          {fabOpen && (
            <div style={{
              position: 'absolute', bottom: 70, right: 8,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {[
                { mode: 'delegate', icon: Users, title: 'Takip Et' },
                { mode: 'focus',    icon: Brain, title: 'Odaklan' },
                { mode: 'quick',    icon: Zap,   title: 'Hemen Hallet' },
              ].map(({ mode, icon: Icon, title }) => (
                <button
                  key={mode}
                  onClick={() => { setFabMode(mode); setFabOpen(false); }}
                  title={title}
                  style={{
                    width: 48, height: 48, borderRadius: 14, border: 'none', cursor: 'pointer',
                    background: t.card, color: t.text, boxShadow: t.shadow,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon size={20} />
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => { setFabOpen(o => !o); setFabMode(null); }}
            style={{
              width: 56, height: 56, borderRadius: 18, border: 'none', cursor: 'pointer',
              background: t.accent, color: t.accentText,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: t.shadow,
              transform: fabOpen ? 'rotate(45deg)' : 'rotate(0)',
              transition: 'transform 0.2s',
            }}
          >
            <Plus size={28} />
          </button>
        </div>
      )}

      {/* Pomodoro overlay */}
      {pomodoro && showPomoPopup && (
        <div style={overlayStyle} onClick={() => setShowPomoPopup(false)}>
          <div style={{ ...modalStyle, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
              <Timer size={18} color={t.text} />
              <span style={{ fontSize: 12, color: t.muted, letterSpacing: '1px' }}>POMODORO</span>
            </div>
            <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto 20px' }}>
              <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="100" cy="100" r="90" fill="none" stroke={t.progressTrack} strokeWidth="10" />
                <circle cx="100" cy="100" r="90" fill="none" stroke={t.accent} strokeWidth="10"
                  strokeLinecap="round" strokeDasharray={pomoCirc} strokeDashoffset={pomoOff}
                  style={{ transition: 'stroke-dashoffset 1s linear' }} />
              </svg>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 36, fontWeight: 700, color: t.text,
              }}>
                {formatTime(pomodoro.timeLeft)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {pomodoro.status === 'running' ? (
                <button style={btnPrimary} onClick={pausePomodoro}>
                  <Pause size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Durdur
                </button>
              ) : (
                <button style={btnPrimary} onClick={resumePomodoro}>
                  <Play size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Devam
                </button>
              )}
              <button style={btnGhost} onClick={cancelPomodoro}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Task creation modal */}
      {fabMode && (
        <div style={overlayStyle} onClick={() => { setFabMode(null); setNewTaskText(''); setDelegateName(''); }}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>{MODE_CONFIG[fabMode].emoji}</span>
              <h3 style={{ color: t.text, margin: 0, fontSize: 18 }}>{MODE_CONFIG[fabMode].label} Görevi Ekle</h3>
            </div>
            <input ref={inputRef} type="text" value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              placeholder="Görev adını yaz..." style={inputStyle}
              onKeyDown={e => { if (e.key === 'Enter' && fabMode !== 'delegate') handleAddTask(); }} />
            {fabMode === 'delegate' && (
              <input type="text" value={delegateName}
                onChange={e => setDelegateName(e.target.value)}
                placeholder="Kime delege edilecek?" style={{ ...inputStyle, marginTop: 10 }}
                onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); }} />
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={btnGhost} onClick={() => { setFabMode(null); setNewTaskText(''); setDelegateName(''); }}>İptal</button>
              <button style={{ ...btnPrimary, opacity: newTaskText.trim() ? 1 : 0.5 }}
                disabled={!newTaskText.trim()} onClick={handleAddTask}>Ekle</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm uncheck / pomodoro warning modal */}
      {confirmModal && (
        <div style={overlayStyle} onClick={() => setConfirmModal(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            {confirmModal.pomodoroWarning ? (
              <>
                <h3 style={{ marginTop: 0, marginBottom: 12, color: t.text, fontSize: 18 }}>⏳ Pomodoro Aktif!</h3>
                <p style={{ color: t.muted, marginBottom: 20, lineHeight: 1.5, fontSize: 14 }}>
                  <strong style={{ color: t.text }}>"{confirmModal.task.txt}"</strong> görevi için Pomodoro sayacı çalışıyor. Tamamlanırsa sayacınız iptal edilecek.<br /><br />
                  Görevi tamamlamak istiyor musunuz?
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={btnGhost} onClick={() => setConfirmModal(null)}>Vazgeç</button>
                  <button style={btnPrimary} onClick={() => {
                    updateTodoTask(confirmModal.dateStr, confirmModal.taskId, { done: true });
                    clearActivePomodoro(); setPomodoro(null); setShowPomoPopup(false);
                    setConfirmModal(null); onDataChange?.();
                  }}>Evet, Tamamla</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0, marginBottom: 12, color: t.text, fontSize: 18 }}>Emin misiniz?</h3>
                <p style={{ color: t.muted, marginBottom: 20, lineHeight: 1.5, fontSize: 14 }}>
                  <strong style={{ color: t.text }}>"{confirmModal.task.txt}"</strong> görevinin tamamlanma durumunu kaldırmak istediğinize emin misiniz?
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={btnGhost} onClick={() => setConfirmModal(null)}>Vazgeç</button>
                  <button style={btnPrimary} onClick={confirmUncheck}>Evet, Kaldır</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Pomodoro complete modal */}
      {pomodoroCompleteModal && (
        <div style={overlayStyle} onClick={() => setPomodoroCompleteModal(null)}>
          <div style={{ ...modalStyle, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
            <h3 style={{ color: t.text, margin: '0 0 8px', fontSize: 20 }}>Pomodoro Tamamlandı!</h3>
            <p style={{ color: t.muted, lineHeight: 1.5, marginBottom: 20, fontSize: 14 }}>
              25 dakikalık çalışma süreniz doldu.<br />
              Görevi tamamladıysanız kutucuğu işaretleyin.
            </p>
            <button style={{ ...btnPrimary, width: '100%' }} onClick={() => setPomodoroCompleteModal(null)}>Tamam</button>
          </div>
        </div>
      )}

      {/* Edit task modal */}
      {editModal && (
        <div style={overlayStyle} onClick={() => { setEditModal(null); setEditText(''); setEditWho(''); }}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>{MODE_CONFIG[editModal.task.size]?.emoji}</span>
              <h3 style={{ color: t.text, margin: 0, fontSize: 18 }}>Görevi Düzenle</h3>
            </div>
            <input type="text" value={editText} autoFocus
              onChange={e => setEditText(e.target.value)}
              placeholder="Görev adını yaz..." style={inputStyle}
              onKeyDown={e => { if (e.key === 'Enter' && editModal.task.size !== 'delegate') handleEditSave(); }} />
            {editModal.task.size === 'delegate' && (
              <input type="text" value={editWho}
                onChange={e => setEditWho(e.target.value)}
                placeholder="Kime delege edilecek?" style={{ ...inputStyle, marginTop: 10 }}
                onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); }} />
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={btnGhost} onClick={() => { setEditModal(null); setEditText(''); setEditWho(''); }}>İptal</button>
              <button style={{ ...btnPrimary, opacity: editText.trim() ? 1 : 0.5 }}
                disabled={!editText.trim()} onClick={handleEditSave}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar undo */}
      {snackbar && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: t.cardDark, color: t.cardDarkText,
          padding: '12px 18px', borderRadius: 12, boxShadow: t.shadow,
          display: 'flex', alignItems: 'center', gap: 16, zIndex: 1100,
          fontSize: 14,
        }}>
          <span>Görev silindi</span>
          <button onClick={handleUndo} style={{
            background: 'transparent', border: 'none', color: t.text,
            fontWeight: 700, cursor: 'pointer', fontSize: 13, letterSpacing: '0.5px',
          }}>GERİ AL</button>
        </div>
      )}
    </div>
  );
}
