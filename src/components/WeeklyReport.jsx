import React, { useMemo } from 'react';
import { getWeekDays, START_DATE_STR, getActiveDateObj } from '../utils/date';
import { getStoreSummary, getDayData, calculateDayScore } from '../utils/storage';
import { addWeeks, isAfter } from 'date-fns';
import BodyHighlighter from './BodyHighlighter';

export default function WeeklyReport({ selectedDateStr, refreshTrigger }) {
  
  // Raporları hesapla
  const reportData = useMemo(() => {
    const raw = getStoreSummary();
    const currentDateObj = new Date(selectedDateStr);
    
    // Geçerli haftanın günlerini al
    const { start: currentWeekStart, days: currentWeekDays } = getWeekDays(currentDateObj);
    
    // Geçen haftanın başlangıcı
    const prevWeekStart = addWeeks(currentWeekStart, -1);
    const { days: prevWeekDays } = getWeekDays(prevWeekStart);

    // Antrenman index: 8 (0-indexed, Checkbox items içinde 8. sırada)
    const workoutIdx = 8;
    
    const calculateStats = (daysArray) => {
      let weightSum = 0;
      let weightCount = 0;
      let workoutCount = 0;
      let scoreSum = 0;
      let scoreCount = 0;
      let workedSet = new Set();

      daysArray.forEach(d => {
        if (isAfter(new Date(d.dateStr), getActiveDateObj())) return;

        const data = getDayData(d.dateStr);
        
        if (data.w !== null) {
          weightSum += data.w;
          weightCount++;
        }
        
        if (data.c[workoutIdx] === 1) {
          workoutCount++;
        }
        
        if (data.m) {
          data.m.forEach(muscle => workedSet.add(muscle));
        }
        
        const dayScore = calculateDayScore(d.dateStr);
        scoreSum += dayScore;
        scoreCount++;
      });

      return {
        avgWeight: weightCount > 0 ? (weightSum / weightCount) : 0,
        workoutCount,
        avgScore: scoreCount > 0 ? (scoreSum / scoreCount) : 0,
        workedSet
      };
    };

    const curStats = calculateStats(currentWeekDays);
    const prevStats = calculateStats(prevWeekDays);

    let weightDiff = 0;
    let feedback = "";
    let feedbackColor = "var(--text-muted)";

    if (curStats.avgWeight > 0 && prevStats.avgWeight > 0) {
      weightDiff = curStats.avgWeight - prevStats.avgWeight;
      
      // Feedback thresholds
      if (weightDiff < 0) {
        feedback = "Kilo Kaybı";
        feedbackColor = "var(--error-color)";
      } else if (weightDiff >= 0 && weightDiff <= 0.3) {
        feedback = "Düşük";
        feedbackColor = "var(--warning-color)";
      } else if (weightDiff > 0.3 && weightDiff <= 0.6) {
        feedback = "İyi";
        feedbackColor = "var(--accent-color)";
      } else if (weightDiff > 0.6 && weightDiff <= 1.0) {
        feedback = "Çok İyi";
        feedbackColor = "var(--accent-color)";
      } else if (weightDiff > 1.0) {
        feedback = "Fazla Hızlı";
        feedbackColor = "var(--error-color)";
      }
    }

    return { curStats, weightDiff, feedback, feedbackColor };

  }, [selectedDateStr, refreshTrigger]);

  return (
    <div className="glass-card fade-in">
      <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', color: 'var(--accent-color)' }}>Seçili Hafta Özeti</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center', marginBottom: '20px' }}>
        <div className="score-display">
          <span className="score-title">Başarı</span>
          <span className="score-percent">{Math.round(reportData.curStats.avgScore)}%</span>
        </div>
        <div className="score-display">
          <span className="score-title">Ort. Kilo</span>
          <span className="score-percent" style={{ color: 'white' }}>
            {reportData.curStats.avgWeight > 0 ? reportData.curStats.avgWeight.toFixed(2) : '-'}
          </span>
        </div>
        <div className="score-display">
          <span className="score-title">Antrenman</span>
          <span className="score-percent" style={{ color: 'white' }}>{reportData.curStats.workoutCount}</span>
        </div>
      </div>

      {reportData.feedback && (
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
             <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DEĞİŞİM (Geçen Haftaya Göre)</div>
             <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
               {reportData.weightDiff > 0 ? '+' : ''}{reportData.weightDiff.toFixed(2)} kg
             </div>
          </div>
          <div style={{ 
            padding: '6px 12px', 
            borderRadius: '20px', 
            backgroundColor: `${reportData.feedbackColor}20`, 
            color: reportData.feedbackColor,
            fontWeight: 'bold'
          }}>
            {reportData.feedback}
          </div>
        </div>
      )}

      {/* Muscle Heatmap */}
      <div style={{marginTop: '20px', background: 'rgba(0,0,0,0.2)', padding:'16px', borderRadius:'12px'}}>
        <h4 style={{marginBottom:'12px', textAlign:'center', color:'var(--text-muted)'}}>Bu Hafta Çalışılan Bölgeler</h4>
        
        <BodyHighlighter workedSet={reportData.curStats.workedSet} style={{ maxHeight: '350px' }} />

        <div style={{display:'flex', flexWrap:'wrap', gap:'8px', justifyContent:'center', marginTop: '16px'}}>
          {['Chest', 'Back', 'Biceps', 'Triceps', 'Core', 'Legs'].map(m => {
            const isWorked = reportData.curStats.workedSet.has(m);
            return (
              <span key={m} style={{
                fontSize:'0.75rem', 
                padding:'4px 10px', 
                borderRadius:'12px', 
                background: isWorked ? 'rgba(57, 255, 20, 0.2)' : 'rgba(255,255,255,0.05)', 
                color: isWorked ? 'var(--accent-color)' : 'var(--text-muted)',
                border: isWorked ? '1px solid var(--accent-color)' : '1px solid transparent'
              }}>
                {m}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
