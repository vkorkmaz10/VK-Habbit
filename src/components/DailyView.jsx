import React, { useState, useEffect } from 'react';
import { CHECKBOX_ITEMS } from '../data/constants';
import { getDayData, getLatestWeight, updateWeight, updateCheck } from '../utils/storage';

export default function DailyView({ selectedDateStr, onDataChange }) {
  const [dayData, setDayData] = useState(null);

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
    updateCheck(selectedDateStr, index, !isCurrentlyChecked);
    
    const newC = [...dayData.c];
    newC[index] = isCurrentlyChecked ? 0 : 1;
    setDayData((prev) => ({ ...prev, c: newC }));
    onDataChange(); // to trigger header reload
  };

  // Kilo null ise, yani kullanıcı henüz ağırlık "kaydetmediyse", ufak bir not düşebiliriz.
  const isWeightSet = dayData.w !== null;

  return (
    <div className="fade-in">
      {/* Weight Section */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <div className="weight-section">
          <div className="weight-header">
            <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>Günlük Kilo</span>
            <span className="weight-value">
              {displayWeight.toFixed(2)} <span style={{fontSize: '1rem', color: 'var(--text-muted)'}}>kg</span>
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
          />
          {!isWeightSet && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
              * Kaydırarak kilonuzu kaydedin
            </div>
          )}
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
              onClick={() => handleCheckToggle(idx)}
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
    </div>
  );
}
