import React, { useMemo } from 'react';
import { getWeekDays, START_DATE_STR, getActiveDateObj } from '../utils/date';
import { getStoreSummary, getDayData, calculateDayScore } from '../utils/storage';
import { addWeeks, isAfter } from 'date-fns';
import BodyHighlighter from './BodyHighlighter';
import { mkTheme } from '../theme';

export default function WeeklyReport({ selectedDateStr, refreshTrigger, darkMode = true }) {
  const t = mkTheme(darkMode);

  // Raporları hesapla
  const reportData = useMemo(() => {
    const currentDateObj = new Date(selectedDateStr);

    const { start: currentWeekStart, days: currentWeekDays } = getWeekDays(currentDateObj);
    const prevWeekStart = addWeeks(currentWeekStart, -1);
    const { days: prevWeekDays } = getWeekDays(prevWeekStart);

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
    let feedback = '';
    let feedbackColor = 'rgba(255,255,255,0.4)';

    if (curStats.avgWeight > 0 && prevStats.avgWeight > 0) {
      weightDiff = curStats.avgWeight - prevStats.avgWeight;

      if (weightDiff < 0) {
        feedback = 'Kilo Kaybı';
        feedbackColor = 'rgba(255,255,255,0.55)';
      } else if (weightDiff >= 0 && weightDiff <= 0.3) {
        feedback = 'Düşük';
        feedbackColor = 'rgba(255,255,255,0.4)';
      } else if (weightDiff > 0.3 && weightDiff <= 0.6) {
        feedback = 'İyi';
        feedbackColor = 'rgba(255,255,255,0.75)';
      } else if (weightDiff > 0.6 && weightDiff <= 1.0) {
        feedback = 'Çok İyi';
        feedbackColor = 'rgba(255,255,255,0.75)';
      } else if (weightDiff > 1.0) {
        feedback = 'Fazla Hızlı';
        feedbackColor = 'rgba(255,255,255,0.55)';
      }
    }

    return { curStats, weightDiff, feedback, feedbackColor };

  }, [selectedDateStr, refreshTrigger]);

  // Card is always dark regardless of theme
  const cardBg = t.cardDark;           // dark: #242428 / light: #111111
  const cardText = t.cardDarkText;     // dark: #e8e8ec / light: #ffffff
  const cardMuted = 'rgba(255,255,255,0.4)';
  const innerBg = 'rgba(0,0,0,0.25)';
  const statBg = 'rgba(255,255,255,0.07)';

  return (
    <div style={{
      background: cardBg,
      borderRadius: 20,
      padding: '22px 24px',
      color: cardText,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18, color: cardText }}>
        Seçili Hafta Özeti
      </div>

      {/* 3 stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Başarı', value: `${Math.round(reportData.curStats.avgScore)}%` },
          { label: 'Ort. Kilo', value: reportData.curStats.avgWeight > 0 ? reportData.curStats.avgWeight.toFixed(2) : '–' },
          { label: 'Antrenman', value: reportData.curStats.workoutCount },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: statBg,
            borderRadius: 12,
            padding: '12px 8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: cardMuted, marginBottom: 6, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: cardText }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Weight change row */}
      {reportData.feedback && (
        <div style={{
          background: innerBg,
          padding: '12px 14px',
          borderRadius: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
        }}>
          <div>
            <div style={{ fontSize: 10, color: cardMuted, fontWeight: 700, letterSpacing: '0.5px', marginBottom: 4 }}>
              DEĞİŞİM (GEÇEN HAFTAYA GÖRE)
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: cardText }}>
              {reportData.weightDiff > 0 ? '+' : ''}{reportData.weightDiff.toFixed(2)} kg
            </div>
          </div>
          <div style={{
            padding: '6px 14px',
            borderRadius: 20,
            background: `${reportData.feedbackColor}20`,
            color: reportData.feedbackColor,
            fontWeight: 700,
            fontSize: 13,
          }}>
            {reportData.feedback}
          </div>
        </div>
      )}

      {/* Muscle Heatmap */}
      <div style={{ background: innerBg, padding: '16px', borderRadius: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: cardMuted, textAlign: 'center', marginBottom: 12, letterSpacing: '0.5px' }}>
          BU HAFTA ÇALIŞILAN BÖLGELER
        </div>

        {/* Constrained BodyHighlighter */}
        <div className="body-highlighter-wrapper">
          <BodyHighlighter
            workedSet={reportData.curStats.workedSet}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>

        {/* Muscle badges — keep green color */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 }}>
          {[
            { key: 'Chest', label: 'Göğüs' },
            { key: 'Back', label: 'Sırt' },
            { key: 'Biceps', label: 'Ön Kol' },
            { key: 'Triceps', label: 'Arka Kol' },
            { key: 'Shoulders', label: 'Omuz' },
            { key: 'Core', label: 'Karın' },
            { key: 'Legs', label: 'Bacak' },
          ].map(({ key, label }) => {
            const isWorked = reportData.curStats.workedSet.has(key);
            return (
              <span key={key} style={{
                fontSize: 12,
                padding: '4px 12px',
                borderRadius: 12,
                background: isWorked ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                color: isWorked ? cardText : cardMuted,
                border: isWorked ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
                fontWeight: 600,
              }}>
                {label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
