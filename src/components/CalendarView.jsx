import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, X, Calendar, Clock, Video, Link2, Trash2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCalendarEvents, addCalendarEvent, removeCalendarEvent } from '../utils/storage';
import { getActiveDateString } from '../utils/date';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, addDays, isSameMonth, isSameDay, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

const EVENT_TYPES = {
  meeting: { label: 'Toplantı', color: '#00d4ff', emoji: '🔵' },
  event: { label: 'Etkinlik', color: '#bd00ff', emoji: '🟣' },
};

const PLATFORMS = [
  { key: 'zoom', label: 'Zoom', icon: '📹' },
  { key: 'meet', label: 'Google Meet', icon: '📱' },
  { key: 'teams', label: 'Teams', icon: '💬' },
  { key: null, label: 'Yok', icon: '—' },
];

// Saatlik timeline slotları (07:00 - 23:00)
const TIMELINE_HOURS = Array.from({ length: 17 }, (_, i) => {
  const h = i + 7;
  return `${h.toString().padStart(2, '0')}:00`;
});

export default function CalendarView({ selectedDateStr, onDataChange }) {
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [monthDate, setMonthDate] = useState(new Date(selectedDateStr));
  const [showAddModal, setShowAddModal] = useState(false);
  const [snackbar, setSnackbar] = useState(null);
  const snackbarTimer = useRef(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('meeting');
  const [formTimeStart, setFormTimeStart] = useState('09:00');
  const [formTimeEnd, setFormTimeEnd] = useState('10:00');
  const [formPlatform, setFormPlatform] = useState(null);
  const [formLink, setFormLink] = useState('');
  const titleRef = useRef(null);

  const todayStr = getActiveDateString();

  const events = useMemo(() => {
    return getCalendarEvents(selectedDateStr);
  }, [selectedDateStr, onDataChange]);

  // All events for month dots
  const allEvents = useMemo(() => {
    return getCalendarEvents();
  }, [onDataChange]);

  useEffect(() => {
    if (showAddModal && titleRef.current) {
      titleRef.current.focus();
    }
  }, [showAddModal]);

  // ======= Month Calendar Grid =======
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarDays = [];
  let day = calStart;
  while (calendarDays.length < 42) {
    calendarDays.push(new Date(day));
    day = addDays(day, 1);
  }

  // Check which days have events
  const eventDatesSet = useMemo(() => {
    const set = new Set();
    allEvents.forEach(e => set.add(e.dateStr));
    return set;
  }, [allEvents]);

  // ======= Handlers =======
  const handleAddEvent = () => {
    if (!formTitle.trim()) return;
    const event = {
      id: 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      dateStr: selectedDateStr,
      timeStart: formTimeStart,
      timeEnd: formTimeEnd,
      title: formTitle.trim(),
      description: formDesc.trim(),
      type: formType,
      platform: formType === 'meeting' ? formPlatform : null,
      link: formType === 'meeting' ? formLink.trim() : '',
    };
    addCalendarEvent(event);
    resetForm();
    setShowAddModal(false);
    onDataChange?.();
  };

  const handleDelete = (eventId) => {
    const deletedEvent = events.find(e => e.id === eventId);
    removeCalendarEvent(eventId);
    onDataChange?.();

    if (deletedEvent) {
      if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
      setSnackbar({ event: deletedEvent });
      snackbarTimer.current = setTimeout(() => setSnackbar(null), 5000);
    }
  };

  const handleUndoDelete = () => {
    if (!snackbar) return;
    addCalendarEvent(snackbar.event);
    setSnackbar(null);
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    onDataChange?.();
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormType('meeting');
    setFormTimeStart('09:00');
    setFormTimeEnd('10:00');
    setFormPlatform(null);
    setFormLink('');
  };

  const handleMonthDayClick = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setShowMonthModal(false);
    // Trigger parent date change via onSelectDate is handled externally
    // For now just close and the parent header handles date navigation
  };

  // ======= Render =======
  return (
    <div className="fade-in" style={{ position: 'relative', minHeight: '60vh' }}>

      {/* ========== Month Calendar Button ========== */}
      <div className="glass-card" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {format(parseISO(selectedDateStr), 'dd MMMM yyyy, EEEE', { locale: tr })}
          </span>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {events.length === 0 ? 'Etkinlik yok' : `${events.length} etkinlik`}
          </div>
        </div>
        <button
          className="cal-month-btn"
          onClick={() => { setMonthDate(parseISO(selectedDateStr)); setShowMonthModal(true); }}
          title="Aylık Takvim"
        >
          <Calendar size={20} />
        </button>
      </div>

      {/* ========== Timeline Agenda ========== */}
      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</div>
          <p>Bu gün için etkinlik yok.</p>
          <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Sağ alttaki + butonuna tıklayarak ekle.</p>
        </div>
      ) : (
        <div className="cal-timeline">
          {events.map((event, idx) => {
            const typeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.event;
            const platformInfo = PLATFORMS.find(p => p.key === event.platform);
            
            return (
              <div key={event.id} className="cal-timeline-item">
                {/* Time column */}
                <div className="cal-time-col">
                  <span className="cal-time-start">{event.timeStart}</span>
                  <span className="cal-time-end">{event.timeEnd}</span>
                </div>

                {/* Line connector */}
                <div className="cal-line-col">
                  <div className="cal-dot" style={{ background: typeConfig.color, boxShadow: `0 0 8px ${typeConfig.color}50` }} />
                  {idx < events.length - 1 && <div className="cal-line" />}
                </div>

                {/* Event card */}
                <div
                  className="cal-event-card glass-card"
                  style={{ borderLeft: `3px solid ${typeConfig.color}` }}
                >
                  <div className="cal-event-header">
                    <span className="cal-event-type-badge" style={{ background: `${typeConfig.color}20`, color: typeConfig.color }}>
                      {typeConfig.emoji} {typeConfig.label}
                    </span>
                    <button className="cal-event-delete" onClick={() => handleDelete(event.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <h4 className="cal-event-title">{event.title}</h4>

                  {event.description && (
                    <p className="cal-event-desc">{event.description}</p>
                  )}

                  <div className="cal-event-meta">
                    <span className="cal-event-time-info">
                      <Clock size={12} />
                      {event.timeStart} – {event.timeEnd}
                    </span>

                    {event.type === 'meeting' && event.link && (
                      <a
                        href={event.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cal-join-btn"
                        style={{ background: `${typeConfig.color}20`, color: typeConfig.color }}
                      >
                        {platformInfo?.icon || '🔗'} Katıl
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========== FAB ========== */}
      <div className="todo-fab-container">
        <button
          className="todo-fab-main cal-fab"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={28} />
        </button>
      </div>

      {/* ========== Add Event Modal ========== */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); resetForm(); }}>
          <div className="modal-content glass-card cal-add-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#00d4ff', marginBottom: '16px' }}>
              <Calendar size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
              Yeni Etkinlik
            </h3>

            {/* Type selector */}
            <div className="cal-type-selector">
              {Object.entries(EVENT_TYPES).map(([key, cfg]) => (
                <button
                  key={key}
                  className={`cal-type-btn ${formType === key ? 'active' : ''}`}
                  style={{ '--cal-type-color': cfg.color }}
                  onClick={() => setFormType(key)}
                >
                  {cfg.emoji} {cfg.label}
                </button>
              ))}
            </div>

            {/* Title */}
            <input
              ref={titleRef}
              type="text"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="Etkinlik başlığı..."
              className="todo-input"
              onKeyDown={e => { if (e.key === 'Enter') handleAddEvent(); }}
            />

            {/* Description */}
            <textarea
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="Açıklama (opsiyonel)"
              className="todo-input cal-textarea"
              rows={2}
            />

            {/* Time row */}
            <div className="cal-time-row">
              <div className="cal-time-field">
                <label>Başlangıç</label>
                <input type="time" value={formTimeStart} onChange={e => setFormTimeStart(e.target.value)} className="cal-time-input" />
              </div>
              <span style={{ color: 'var(--text-muted)', alignSelf: 'flex-end', paddingBottom: '10px' }}>→</span>
              <div className="cal-time-field">
                <label>Bitiş</label>
                <input type="time" value={formTimeEnd} onChange={e => setFormTimeEnd(e.target.value)} className="cal-time-input" />
              </div>
            </div>

            {/* Platform (only for meetings) */}
            {formType === 'meeting' && (
              <>
                <div className="cal-platform-row">
                  {PLATFORMS.map(p => (
                    <button
                      key={p.key || 'none'}
                      className={`cal-platform-btn ${formPlatform === p.key ? 'active' : ''}`}
                      onClick={() => setFormPlatform(p.key)}
                    >
                      {p.icon}
                    </button>
                  ))}
                </div>

                {formPlatform && (
                  <input
                    type="url"
                    value={formLink}
                    onChange={e => setFormLink(e.target.value)}
                    placeholder="Toplantı linki (opsiyonel)"
                    className="todo-input"
                    style={{ marginTop: '8px' }}
                  />
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn-cancel" onClick={() => { setShowAddModal(false); resetForm(); }}>İptal</button>
              <button
                className="btn-save"
                style={{ background: EVENT_TYPES[formType].color }}
                onClick={handleAddEvent}
                disabled={!formTitle.trim()}
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Monthly Calendar Modal ========== */}
      {showMonthModal && (
        <div className="modal-overlay" onClick={() => setShowMonthModal(false)}>
          <div className="modal-content glass-card cal-month-modal" onClick={e => e.stopPropagation()}>
            {/* Month nav */}
            <div className="cal-month-nav">
              <button onClick={() => setMonthDate(subMonths(monthDate, 1))}>
                <ChevronLeft size={20} />
              </button>
              <h3>{format(monthDate, 'MMMM yyyy', { locale: tr })}</h3>
              <button onClick={() => setMonthDate(addMonths(monthDate, 1))}>
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Day headers */}
            <div className="cal-month-grid cal-month-headers">
              {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map(d => (
                <span key={d} className="cal-month-day-header">{d}</span>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="cal-month-grid">
              {calendarDays.map((d, i) => {
                const dStr = format(d, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(d, monthDate);
                const isToday = dStr === todayStr;
                const isSelected = dStr === selectedDateStr;
                const hasEvents = eventDatesSet.has(dStr);

                return (
                  <button
                    key={i}
                    className={`cal-month-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setShowMonthModal(false);
                      // Emit the date to parent via window event
                      window.dispatchEvent(new CustomEvent('calendarDateSelect', { detail: dStr }));
                    }}
                  >
                    <span>{format(d, 'd')}</span>
                    {hasEvents && <div className="cal-month-dot" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========== Snackbar ========== */}
      {snackbar && (
        <div className="snackbar-undo">
          <span>Etkinlik silindi</span>
          <button onClick={handleUndoDelete}>GERİ AL</button>
        </div>
      )}
    </div>
  );
}
