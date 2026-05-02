// HabitsPage — PersonaVK styled. Wraps existing storage.js + scoring.
// Replaces visual roles of Header + DailyView for the habits tab.
import React, { useState, useEffect } from 'react';
import { CHECKBOX_ITEMS } from '../data/constants';
import {
  Coffee, Zap, UtensilsCrossed, Utensils, Moon, Droplets, Pill,
  BedDouble, Dumbbell, TrendingUp, Target, Footprints,
} from 'lucide-react';
import {
  getDayData, getLatestWeight, updateWeight, updateCheck, updateMuscles,
  calculateDayScore,
} from '../utils/storage';
import { getActiveDateString } from '../utils/date';
import { mkTheme } from '../theme';
import Header from './Header';
import WeeklyReport from './WeeklyReport';

const HABIT_ICONS = {
  Coffee, Zap, UtensilsCrossed, Utensils, Moon, Droplets, Pill,
  BedDouble, Dumbbell, TrendingUp, Target, Footprints,
};

const MUSCLES = ['Chest', 'Back', 'Biceps', 'Triceps', 'Shoulders', 'Core', 'Legs', 'Cardio'];
const MUSCLE_LABELS = {
  Chest: 'Göğüs', Back: 'Sırt', Biceps: 'Ön Kol',
  Triceps: 'Arka Kol', Shoulders: 'Omuz', Core: 'Karın', Legs: 'Bacak',
  Cardio: 'Kardiyo',
};

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
function HabitCard({ item, checked, onToggle, disabled, t }) {
  const IconComp = HABIT_ICONS[item.icon];
  return (
    <div
      onClick={() => { if (!disabled) onToggle(); }}
      style={{
        background: t.card, borderRadius: 16, padding: '10px 10px',
        boxShadow: t.cardShadow, border: t.cardBorder,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        display: 'flex', alignItems: 'center', gap: 8,
        transition: 'transform 0.1s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{
        width: 28, height: 28, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
      }}>
        {IconComp && <IconComp size={16} color={t.text} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: t.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{item.label}</div>
      </div>
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        border: `2px solid ${checked ? t.text : t.inputBorder}`,
        background: checked ? t.text : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.card} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
function WeightCard({ value, onChange, onCommit, disabled, bounds, savedFlash, t, darkMode }) {
  const commitTimer = React.useRef(null);
  const scheduleCommit = () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(onCommit, 800);
  };
  const dec = () => { onChange(Math.max(bounds.min, +(value - 0.1).toFixed(2))); scheduleCommit(); };
  const inc = () => { onChange(Math.min(bounds.max, +(value + 0.1).toFixed(2))); scheduleCommit(); };
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
            background: darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            color: darkMode ? t.cardDarkText : t.text,
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
function MuscleModal({ initial, onSave, onClose, t, darkMode }) {
  const [sel, setSel] = useState(initial);
  const toggle = (m) => setSel(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasMuscle = sel.some(s => s !== 'Cardio');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 400,
          background: t.card, borderRadius: 18, padding: 24,
          border: t.cardBorder, boxShadow: t.cardShadow,
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        <h3 style={{ marginBottom: 16, color: t.text, fontFamily: 'Spline Sans', fontSize: 16, fontWeight: 700 }}>
          Çalışılan Bölgeler
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {MUSCLES.map((muscle) => {
            const isSelected = sel.includes(muscle);
            return (
              <div
                key={muscle}
                onClick={() => toggle(muscle)}
                style={{
                  padding: '14px 10px', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                  border: `2px solid ${isSelected ? t.text : t.inputBorder}`,
                  background: isSelected
                    ? (darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)')
                    : t.hover,
                  color: isSelected ? t.text : t.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>{MUSCLE_LABELS[muscle]}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: 14, borderRadius: 12,
              border: `1px solid ${t.inputBorder}`,
              background: t.hover, color: t.text,
              fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'Spline Sans',
            }}
          >İptal</button>
          <button
            onClick={() => onSave(sel)}
            disabled={!hasMuscle}
            style={{
              flex: 1, padding: 14, borderRadius: 12, border: 'none',
              background: hasMuscle ? t.accent : t.hover,
              color: hasMuscle ? t.accentText : t.muted,
              fontWeight: 700, fontSize: 15,
              cursor: hasMuscle ? 'pointer' : 'not-allowed',
              opacity: hasMuscle ? 1 : 0.5, fontFamily: 'Spline Sans',
            }}
          >Kaydet</button>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
            {CHECKBOX_ITEMS.map((item, idx) => (
              <HabitCard
                key={item.id} item={item}
                checked={dayData.c[idx] === 1}
                onToggle={() => handleToggle(idx)}
                disabled={isPast}
                t={t}
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
          t={t}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}
