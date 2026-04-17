import React, { useState, useEffect } from 'react';
import { CHECKBOX_ITEMS } from '../data/constants';
import { getDayData, getLatestWeight, updateWeight, updateCheck, updateMuscles } from '../utils/storage';
import { getActiveDateString } from '../utils/date';

const MUSCLES = ['Chest', 'Back', 'Biceps', 'Triceps', 'Core', 'Legs'];

export default function DailyView({ selectedDateStr, onDataChange }) {
  const [dayData, setDayData] = useState(null);
  
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightInputValue, setWeightInputValue] = useState('');
  
  const [showMuscleModal, setShowMuscleModal] = useState(false);
  const [tempMuscles, setTempMuscles] = useState([]);

  const [bounds, setBounds] = useState({ min: 0, max: 100 });

  useEffect(() => {
    // Load fresh data for the selected date
    let data = getDayData(selectedDateStr);
    setDayData(data);
    
    // Set fixed bounds based on initial weight calculation when navigating to new day
    const w = data.w !== null ? data.w : getLatestWeight(selectedDateStr);
    setBounds({
      min: Math.floor(w - 2),
      max: Math.ceil(w + 2)
    });
  }, [selectedDateStr]);

  if (!dayData) return null;

  const latestWeight = getLatestWeight(selectedDateStr);
  const displayWeight = dayData.w !== null ? dayData.w : latestWeight;

  const handleWeightChange = (e) => {
    const val = parseFloat(e.target.value);
    updateWeight(selectedDateStr, val);
    setDayData((prev) => ({ ...prev, w: val }));
    onDataChange();
  };

  const handleCheckToggle = (index) => {
    const isCurrentlyChecked = dayData.c[index] === 1;

    if (index === 8 && !isCurrentlyChecked) {
      setTempMuscles(dayData.m || []);
      setShowMuscleModal(true);
      return;
    }

    if (index === 8 && isCurrentlyChecked) {
      updateMuscles(selectedDateStr, []);
      setDayData(prev => ({ ...prev, m: [] }));
    }

    updateCheck(selectedDateStr, index, !isCurrentlyChecked);
    
    const newC = [...dayData.c];
    newC[index] = isCurrentlyChecked ? 0 : 1;
    setDayData((prev) => ({ ...prev, c: newC }));
    onDataChange(); // to trigger header reload
  };

  const handleWeightSave = () => {
    const val = parseFloat(weightInputValue);
    if (!isNaN(val)) {
      updateWeight(selectedDateStr, val);
      setDayData((prev) => ({ ...prev, w: val }));
      
      // Update bounds as well
      setBounds({
        min: Math.floor(val - 2),
        max: Math.ceil(val + 2)
      });
      onDataChange();
    }
    setShowWeightModal(false);
  };

  const handleMusclesSave = () => {
    updateCheck(selectedDateStr, 8, true);
    updateMuscles(selectedDateStr, tempMuscles);
    
    setDayData((prev) => {
      const newC = [...prev.c];
      newC[8] = 1;
      return { ...prev, c: newC, m: tempMuscles };
    });
    
    setShowMuscleModal(false);
    onDataChange();
  };

  const toggleMuscle = (muscle) => {
    if (tempMuscles.includes(muscle)) {
      setTempMuscles(prev => prev.filter(m => m !== muscle));
    } else {
      setTempMuscles(prev => [...prev, muscle]);
    }
  };

  // Geçmiş günler (günlük sıfırlanma sonrası) salt okunur
  const isPast = selectedDateStr < getActiveDateString();

  return (
    <div className="fade-in">
      {/* Weight Section */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <div className="weight-section">
          <div className="weight-header">
            <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>Günlük Kilo</span>
            <span
              className="weight-value"
              onClick={() => {
                if (isPast) return;
                setWeightInputValue(displayWeight.toFixed(2));
                setShowWeightModal(true);
              }}
              style={{ cursor: isPast ? 'default' : 'pointer', textDecoration: isPast ? 'none' : 'underline', opacity: isPast ? 0.6 : 1 }}
            >
              {displayWeight.toFixed(2)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', textDecoration: 'none' }}>kg</span>
            </span>
          </div>
          <input
            type="range"
            className="weight-slider"
            min={bounds.min}
            max={bounds.max}
            step="0.05"
            value={displayWeight}
            onChange={handleWeightChange}
            disabled={isPast}
            style={{ opacity: isPast ? 0.45 : 1 }}
          />
        </div>
      </div>

      {/* Checkboxes Area */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '16px', fontSize: '1.2rem' }}>Günlük Görevler</h3>
        {CHECKBOX_ITEMS.map((item, idx) => {
          const checked = dayData.c[idx] === 1;
          return (
            <div
              key={item.id}
              className={`check-item ${checked ? 'checked' : ''}`}
              onClick={() => { if (!isPast) handleCheckToggle(idx); }}
              style={{ opacity: isPast ? 0.6 : 1, cursor: isPast ? 'default' : 'pointer' }}
            >
              <div className="check-left">
                <span className="check-emoji">{item.emoji}</span>
                <span className="check-label">{item.label}</span>
              </div>
              <div className="check-box">
                <span className="check-mark">✓</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Weight Modal */}
      {showWeightModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <h3 style={{ marginBottom: '16px' }}>Kilonuzu Girin</h3>
            <input 
              type="number" 
              step="0.05"
              value={weightInputValue} 
              onChange={(e) => setWeightInputValue(e.target.value)} 
              style={{
                width: '100%', padding: '12px', borderRadius: '12px', 
                border: 'none', marginBottom: '16px', fontSize: '1.2rem',
                textAlign: 'center', background: 'rgba(255,255,255,0.1)', color: 'white'
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setShowWeightModal(false)}
                className="btn-cancel"
              >
                İptal
              </button>
              <button 
                onClick={handleWeightSave}
                className="btn-save"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Muscle Selection Modal */}
      {showMuscleModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <h3 style={{ marginBottom: '16px' }}>Çalışılan Bölgeler</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              {MUSCLES.map((muscle, idx) => {
                const isSelected = tempMuscles.includes(muscle);
                return (
                  <div 
                    key={muscle}
                    onClick={() => toggleMuscle(muscle)}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: isSelected ? '2px solid var(--accent-color)' : '2px solid transparent',
                      background: isSelected ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255,255,255,0.05)',
                      color: isSelected ? 'var(--accent-color)' : 'white',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <img src={`/muscle_${idx}.png`} alt={muscle} style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{muscle}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setShowMuscleModal(false)}
                className="btn-cancel"
              >
                İptal
              </button>
              <button 
                onClick={handleMusclesSave}
                className="btn-save"
                disabled={tempMuscles.length === 0}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
