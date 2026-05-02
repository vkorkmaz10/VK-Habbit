import React, { useState, useEffect, useRef } from 'react';
import { addWeeks, isAfter } from 'date-fns';
import { getWeekDays, formatWeekTitle, getActiveDateObj } from '../utils/date';
import { calculateDayScore, calculateTodoScore } from '../utils/storage';

export default function Header({ selectedDateStr, onSelectDate, refreshTrigger, mode = 'habit', showTitle = true, darkMode = true }) {
  const [weekBaseDate, setWeekBaseDate] = useState(getActiveDateObj());
  const touchStartX = useRef(null);

  useEffect(() => {
    setWeekBaseDate(new Date(selectedDateStr));
  }, [selectedDateStr]);

  const handlePrevWeek = () => {
    setWeekBaseDate(prev => addWeeks(prev, -1));
  };

  const handleNextWeek = () => {
    setWeekBaseDate(prev => {
      const nextWk = addWeeks(prev, 1);
      const { start: activeStart } = getWeekDays(getActiveDateObj());
      const { start: nextStart } = getWeekDays(nextWk);
      if (isAfter(nextStart, activeStart)) return prev;
      return nextWk;
    });
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) handleNextWeek();
      else handlePrevWeek();
    }
    touchStartX.current = null;
  };

  const { days } = getWeekDays(weekBaseDate);
  const weekTitle = formatWeekTitle(weekBaseDate);

  const isTodo = mode === 'todo';
  const isCalendar = mode === 'calendar';
  // Todo: dark theme = white, light theme = black (with neon glow)
  // Calendar: cyan. Habit: green.
  let accentColor, accentGlow;
  accentColor = darkMode ? '#ffffff' : '#000000';
  accentGlow = darkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)';

  const circleRadius = 20;
  const circleCircumference = 2 * Math.PI * circleRadius;

  return (
    <div
      className="header-container glass-card"
      style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: "16px" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      {showTitle && (
        <div className="summary-header">
          <div className="week-title" style={{ marginBottom: 0 }}>{weekTitle}</div>
        </div>
      )}

      <div className="days-row" style={{ marginTop: showTitle ? '16px' : '4px' }}>
        {days.map((d, index) => {
          const score = isTodo ? calculateTodoScore(d.dateStr) : calculateDayScore(d.dateStr);
          const offset = circleCircumference - (score / 100) * circleCircumference;
          const isActive = d.dateStr === selectedDateStr;

          return (
            <div
              key={index}
              className={`day-circle ${isActive ? 'active' : ''} ${d.isToday ? 'is-today' : ''}`}
              onClick={() => onSelectDate(d.dateStr)}
              style={{
                ...(isActive ? { boxShadow: `0 0 12px ${accentGlow}` } : {}),
                ...(d.isToday ? { borderColor: accentColor } : {})
              }}
            >
              <svg className="day-progress-svg" width="44" height="44" viewBox="0 0 44 44">
                <circle
                  className="day-progress-bg"
                  cx="22" cy="22" r={circleRadius}
                />
                <circle
                  className="day-progress-fill"
                  cx="22" cy="22" r={circleRadius}
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={offset}
                  style={{ stroke: score === 100 ? accentColor : accentColor }}
                />
              </svg>
              <span className="day-label">{d.dayNum}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}