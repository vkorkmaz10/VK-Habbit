import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addWeeks, isAfter } from 'date-fns';
import { getWeekDays, formatWeekTitle, getActiveDateObj } from '../utils/date';
import { calculateDayScore } from '../utils/storage';

export default function Header({ selectedDateStr, onSelectDate, refreshTrigger }) {
  // `weekBaseDate` tells us which week we are looking at.
  // By default, it's the active week (today).
  const [weekBaseDate, setWeekBaseDate] = useState(getActiveDateObj());

  // Listen external date changes (like returning to "bugün")
  useEffect(() => {
    setWeekBaseDate(new Date(selectedDateStr));
  }, [selectedDateStr]);

  const handlePrevWeek = () => {
    setWeekBaseDate(addWeeks(weekBaseDate, -1));
  };

  const handleNextWeek = () => {
    const nextWk = addWeeks(weekBaseDate, 1);
    // Henüz yaşanmamış haftalara girmeyi bloke edelim (Plan'a göre)
    // Eğer nextWk, activeDate'den büyükse (hafta başlangıcı bazında) geçme:
    // Pazar gününden sonrasını engelleme vs.
    if (isAfter(nextWk, addWeeks(getActiveDateObj(), 0))) {
        // Tam engelleme yapmıyoruz ama ilerideki tamamen boş haftaya geçilmesin
        // Gelecek engeli:
        const { start: activeStart } = getWeekDays(getActiveDateObj());
        const { start: nextStart } = getWeekDays(nextWk);
        if (isAfter(nextStart, activeStart)) {
            return; // İzin verme
        }
    }
    setWeekBaseDate(nextWk);
  };

  const { days } = getWeekDays(weekBaseDate);
  const weekTitle = formatWeekTitle(weekBaseDate);

  // SVG parameters for progress ring
  const circleRadius = 20;
  const circleCircumference = 2 * Math.PI * circleRadius;

  return (
    <div className="header-container glass-card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: "16px" }}>
      
      <div className="summary-header">
        <button onClick={handlePrevWeek} style={{ background: 'transparent', border: 'none', color: 'white' }}>
          <ChevronLeft size={28} />
        </button>
        <div className="week-title" style={{ marginBottom: 0 }}>{weekTitle}</div>
        <button onClick={handleNextWeek} style={{ background: 'transparent', border: 'none', color: 'white' }}>
          <ChevronRight size={28} />
        </button>
      </div>

      <div className="days-row" style={{ marginTop: '16px' }}>
        {days.map((d, index) => {
          const score = calculateDayScore(d.dateStr);
          const offset = circleCircumference - (score / 100) * circleCircumference;
          const isActive = d.dateStr === selectedDateStr;
          
          return (
            <div 
              key={index}
              className={`day-circle ${isActive ? 'active' : ''} ${d.isToday ? 'is-today' : ''}`}
              onClick={() => onSelectDate(d.dateStr)}
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
                  style={{ stroke: score === 100 ? '#39FF14' : 'var(--accent-color)' }}
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
