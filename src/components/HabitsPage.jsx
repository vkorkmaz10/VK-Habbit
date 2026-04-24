// HabitsPage — PersonaVK styled. Wraps existing storage.js + scoring.
// Replaces visual roles of Header + DailyView for the habits tab.
import React, { useState, useEffect } from 'react';
import { CHECKBOX_ITEMS } from '../data/constants';
import {
  getDayData, getLatestWeight, updateWeight, updateCheck, updateMuscles,
  calculateDayScore,
} from '../utils/storage';
import { getActiveDateString } from '../utils/date';
import { mkTheme } from '../theme';
import Header from './Header';
import WeeklyReport from './WeeklyReport';

const MUSCLES = ['Chest', 'Back', 'Biceps', 'Triceps', 'Core', 'Legs'];

// ScoreRing — used by Daily Score card only.
function ScoreRing({ value, size = 64, stroke = 5, color, trackColor, textColor, showValue = true, fillPct }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pctSrc = fillPct !== undefined ? fillPct : value;
  const pct = Math.min(pctSrc / 100, 1);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      {showValue && (
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle"
          style={{
            fill: textColor, fontSize: size * 0.26, fontWeight: 700,
            fontFamily: 'Spline Sans',
            transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px`,
          }}>
          {value}
        </text>
      )}
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────
function HabitCard({ item, checked, onToggle, disabled, t, darkMode }) {
  return (
    <div
      onClick={() => { if (!disabled) onToggle(); }}
      style={{
        background: t.card, borderRadius: 16, padding: '14px 16px',
        boxShadow: t.cardShadow, border: t.cardBorder,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        display: 'flex', alignItems: 'center', gap: 12,
        transition: 'transform 0.1s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{
        width: 26, height: 26, borderRadius: 8,
        border: `2px solid ${checked ? t.text : (darkMode ? '#3a3a3e' : '#d6d6d6')}`,
        background: checked ? t.text : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        transition: 'all 0.15s',
      }}>
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.card} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{item.label}</div>
      </div>
      <span style={{ fontSize: 18 }}>{item.emoji}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
function WeightCard({ value, onChange, onCommit, disabled, bounds, savedFlash, t, darkMode }) {
  const dec = () => onChange(Math.max(bounds.min, +(value - 0.1).toFixed(2)));
  const inc = () => onChange(Math.min(bounds.max, +(value + 0.1).toFixed(2)));
  const btn = {
    width: 36, height: 36, borderRadius: '50%',
    border: `2px solid ${darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}`,
    background: 'transparent', color: darkMode ? '#fff' : '#111', fontSize: 18, cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'Spline Sans', opacity: disabled ? 0.5 : 1,
  };
  return (
    <div style={{ background: darkMode ? t.cardDark : t.card, borderRadius: 20, padding: '20px 22px', color: darkMode ? t.cardDarkText : t.text, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Kilo Girişi</div>
        {savedFlash && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
            background: 'rgba(34,197,94,0.2)', color: '#4ade80',
            transition: 'opacity 0.3s',
          }}>✓ Kaydedildi</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: darkMode ? 'rgba(232,232,236,0.4)' : 'rgba(0,0,0,0.4)', marginBottom: 18 }}>Bugünün ağırlığı</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <button onClick={dec} disabled={disabled} style={btn}>−</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 1, color: darkMode ? t.cardDarkText : t.text }}>{value.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: darkMode ? 'rgba(232,232,236,0.4)' : 'rgba(0,0,0,0.4)' }}>kg</div>
        </div>
        <button onClick={inc} disabled={disabled} style={btn}>+</button>
      </div>
      <input
        type="range" min={bounds.min} max={bounds.max} step="0.05"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        onMouseUp={onCommit} onTouchEnd={onCommit}
        disabled={disabled}
        style={{ width: '100%', accentColor: darkMode ? t.cardDarkText : t.text, opacity: disabled ? 0.5 : 1 }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Eski kas modal'ı korundu — /muscle_*.png görselleri ve İngilizce etiketler.
function MuscleModal({ initial, onSave, onClose }) {
  const [sel, setSel] = useState(initial);
  const toggle = (m) => setSel(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card">
        <h3 style={{ marginBottom: '16px' }}>Çalışılan Bölgeler</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          {MUSCLES.map((muscle, idx) => {
            const isSelected = sel.includes(muscle);
            return (
              <div
                key={muscle}
                onClick={() => toggle(muscle)}
                style={{
                  padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer',
                  border: isSelected ? '2px solid var(--accent-color)' : '2px solid transparent',
                  background: isSelected ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255,255,255,0.05)',
                  color: isSelected ? 'var(--accent-color)' : 'white',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  transition: 'all 0.2s ease',
                }}>
                <img src={`/muscle_${idx}.png`} alt={muscle} style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{muscle}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} className="btn-cancel">İptal</button>
          <button onClick={() => onSave(sel)} className="btn-save" disabled={sel.length === 0}>Kaydet</button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
export default function HabitsPage({ darkMode, selectedDateStr, setSelectedDateStr, refreshTrigger, onDataChange }) {
  const t = mkTheme(darkMode);
  const [dayData, setDayData] = useState(null);
  const [bounds, setBounds] = useState({ min: 70, max: 80 });
  const [showMuscleModal, setShowMuscleModal] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Load day data on date change OR when external refreshTrigger fires
  useEffect(() => {
    const data = getDayData(selectedDateStr);
    setDayData(data);
    const w = data.w !== null ? data.w : getLatestWeight(selectedDateStr);
    setBounds({ min: Math.floor(w - 2), max: Math.ceil(w + 2) });
  }, [selectedDateStr, refreshTrigger]);

  if (!dayData) return null;

  const isPast = selectedDateStr < getActiveDateString();
  const latestWeight = getLatestWeight(selectedDateStr);
  const displayWeight = dayData.w !== null ? dayData.w : latestWeight;
  const dayScore = calculateDayScore(selectedDateStr);
  const checkedCount = dayData.c.filter(v => v === 1).length;

  const handleWeightChange = (val) => {
    setDayData(prev => ({ ...prev, w: val }));
  };
  const commitWeight = () => {
    const v = dayData.w !== null ? dayData.w : displayWeight;
    updateWeight(selectedDateStr, v);
    setDayData(prev => ({ ...prev, w: v }));
    onDataChange?.();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const handleToggle = (idx) => {
    if (isPast) return;
    const isChecked = dayData.c[idx] === 1;
    if (idx === 8 && !isChecked) {
      setShowMuscleModal(true);
      return;
    }
    if (idx === 8 && isChecked) {
      updateMuscles(selectedDateStr, []);
      setDayData(prev => ({ ...prev, m: [] }));
    }
    updateCheck(selectedDateStr, idx, !isChecked);
    const newC = [...dayData.c];
    newC[idx] = isChecked ? 0 : 1;
    setDayData(prev => ({ ...prev, c: newC }));
    onDataChange?.();
  };

  const handleMusclesSave = (muscles) => {
    updateCheck(selectedDateStr, 8, true);
    updateMuscles(selectedDateStr, muscles);
    setDayData(prev => {
      const newC = [...prev.c]; newC[8] = 1;
      return { ...prev, c: newC, m: muscles };
    });
    setShowMuscleModal(false);
    onDataChange?.();
  };

  const todayStr = getActiveDateString();

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Page header */}
      <div className="page-title" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: '-0.5px' }}>Alışkanlıklarım</div>
        <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>Günlük rutinini takip et</div>
      </div>

      {/* Week strip — eski Header (mevcut görsel korunur) */}
      <div style={{ marginBottom: 16 }}>
        <Header
          selectedDateStr={selectedDateStr}
          onSelectDate={setSelectedDateStr}
          refreshTrigger={refreshTrigger}
          mode="habit"
          showTitle={false}
          darkMode={darkMode}
        />
      </div>

      {/* Habits + side cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div>
          <div style={{
            fontSize: 12, fontWeight: 700, color: t.muted, textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: 12,
          }}>
            {selectedDateStr === todayStr ? 'Bugün' : selectedDateStr} · {checkedCount}/{CHECKBOX_ITEMS.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CHECKBOX_ITEMS.map((item, idx) => (
              <HabitCard
                key={item.id} item={item}
                checked={dayData.c[idx] === 1}
                onToggle={() => handleToggle(idx)}
                disabled={isPast}
                t={t} darkMode={darkMode}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <WeightCard
            value={displayWeight} onChange={handleWeightChange} onCommit={commitWeight}
            disabled={isPast} bounds={bounds} savedFlash={savedFlash} t={t} darkMode={darkMode}
          />

          <div style={{
            background: t.card, borderRadius: 20, padding: '22px 24px',
            boxShadow: t.cardShadow, border: t.cardBorder,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Günlük Skor</div>
            <ScoreRing value={dayScore} size={110} stroke={9}
              color={t.text} trackColor={t.progressTrack} textColor={t.text} />
            <div style={{ fontSize: 12, color: t.muted }}>{dayScore}% tamamlandı</div>
          </div>

          {selectedDateStr !== todayStr && (
            <button onClick={() => setSelectedDateStr(todayStr)} style={{
              padding: '14px 16px', borderRadius: 14, border: 'none',
              background: t.cardDark, color: t.cardDarkText,
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
              fontFamily: 'Spline Sans',
            }}>
              Bugüne Dön
            </button>
          )}

          <WeeklyReport
            selectedDateStr={selectedDateStr}
            refreshTrigger={refreshTrigger}
            darkMode={darkMode}
          />
        </div>
      </div>

      {showMuscleModal && (
        <MuscleModal
          initial={dayData.m || []}
          onSave={handleMusclesSave}
          onClose={() => setShowMuscleModal(false)}
        />
      )}
    </div>
  );
}
