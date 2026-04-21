import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Plus, X, Calendar, Clock, Video, Link2, Trash2, ExternalLink, ChevronLeft, ChevronRight, RefreshCw, UserPlus } from 'lucide-react';
import { getCalendarEvents, addCalendarEvent, removeCalendarEvent } from '../utils/storage';
import {
  getAccounts,
  addAccount as addGoogleAccount,
  removeAccount as removeGoogleAccount,
  fetchGoogleEvents,
  startTokenRefresher,
  stopTokenRefresher,
} from '../utils/googleCalendar';
import { getActiveDateString } from '../utils/date';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, addDays, isSameMonth, parseISO } from 'date-fns';
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

export default function CalendarView({ selectedDateStr, onDataChange }) {
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [monthDate, setMonthDate] = useState(new Date(selectedDateStr));
  const [showAddModal, setShowAddModal] = useState(false);
  const [snackbar, setSnackbar] = useState(null);
  const snackbarTimer = useRef(null);

  // Google Calendar state — multi-account
  const [accounts, setAccounts] = useState(() => getAccounts());
  const [googleEvents, setGoogleEvents] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [accountMenuFor, setAccountMenuFor] = useState(null); // email → show remove menu
  const googleConnected = accounts.length > 0;

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

  // Local events
  const localEvents = useMemo(() => {
    return getCalendarEvents(selectedDateStr);
  }, [selectedDateStr, onDataChange]);

  // All local events for month dots
  const allLocalEvents = useMemo(() => {
    return getCalendarEvents();
  }, [onDataChange]);

  // Combined events: local + google, sorted by timeStart
  const events = useMemo(() => {
    return [...localEvents, ...googleEvents].sort((a, b) => a.timeStart.localeCompare(b.timeStart));
  }, [localEvents, googleEvents]);

  // Auto-focus form
  useEffect(() => {
    if (showAddModal && titleRef.current) {
      titleRef.current.focus();
    }
  }, [showAddModal]);

  // Fetch Google events (multi-account merge)
  const syncGoogleEvents = useCallback(async () => {
    if (accounts.length === 0) {
      setGoogleEvents([]);
      return;
    }
    setSyncing(true);
    try {
      const events = await fetchGoogleEvents(selectedDateStr);
      setGoogleEvents(events);
    } catch (e) {
      console.error('Google sync error:', e);
      setGoogleEvents([]);
    }
    setSyncing(false);
  }, [selectedDateStr, accounts.length]);

  useEffect(() => {
    syncGoogleEvents();
  }, [syncGoogleEvents]);

  // Listen to account changes (add/remove from this or other tabs)
  useEffect(() => {
    const onChange = () => setAccounts(getAccounts());
    window.addEventListener('vkgym_google_accounts_changed', onChange);
    return () => window.removeEventListener('vkgym_google_accounts_changed', onChange);
  }, []);

  // Start proactive token refresher
  useEffect(() => {
    startTokenRefresher();
    return () => stopTokenRefresher();
  }, []);

  // ======= Google Auth Handlers =======
  const handleAddAccount = async () => {
    try {
      await addGoogleAccount();
      setAccounts(getAccounts());
    } catch (e) {
      console.error('Google add account error:', e);
    }
  };

  const handleRemoveAccount = (email) => {
    removeGoogleAccount(email);
    setAccounts(getAccounts());
    setAccountMenuFor(null);
  };

  // ======= Month Calendar Grid =======
  const monthStart = startOfMonth(monthDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarDays = [];
  let day = calStart;
  while (calendarDays.length < 42) {
    calendarDays.push(new Date(day));
    day = addDays(day, 1);
  }

  const eventDatesSet = useMemo(() => {
    const set = new Set();
    allLocalEvents.forEach(e => set.add(e.dateStr));
    googleEvents.forEach(e => set.add(e.dateStr));
    return set;
  }, [allLocalEvents, googleEvents]);

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
    // Google etkinliklerini silemeyiz
    if (eventId.startsWith('g_')) return;
    const deletedEvent = localEvents.find(e => e.id === eventId);
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

  // ======= Render =======
  return (
    <div className="fade-in" style={{ position: 'relative', minHeight: '60vh' }}>

      {/* ========== Google Accounts (multi) ========== */}
      <div className="glass-card cal-google-section" style={{ marginBottom: '12px' }}>
        {!googleConnected ? (
          <button className="cal-google-btn" onClick={handleAddAccount}>
            <svg viewBox="0 0 24 24" width="18" height="18" style={{ marginRight: '8px' }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google Takvim'e Bağlan
          </button>
        ) : (
          <div className="cal-google-accounts-row">
            <div className="cal-google-avatars">
              {accounts.map(acc => (
                <div key={acc.email} className="cal-google-avatar-wrap">
                  <button
                    type="button"
                    className="cal-google-avatar"
                    style={{ borderColor: acc.color }}
                    onClick={() => setAccountMenuFor(accountMenuFor === acc.email ? null : acc.email)}
                    title={acc.email}
                  >
                    {acc.picture
                      ? <img src={acc.picture} alt={acc.name} />
                      : <span>{(acc.name || acc.email)[0].toUpperCase()}</span>}
                    <span className="cal-google-avatar-dot" style={{ background: acc.color }} />
                  </button>
                  {accountMenuFor === acc.email && (
                    <div className="cal-google-account-menu" onMouseLeave={() => setAccountMenuFor(null)}>
                      <div className="cal-google-account-meta">
                        <strong>{acc.name}</strong>
                        <span>{acc.email}</span>
                      </div>
                      <button
                        type="button"
                        className="cal-google-account-remove"
                        onClick={() => handleRemoveAccount(acc.email)}
                      >
                        <Trash2 size={12} /> Hesabı Kaldır
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="cal-google-add-btn"
                onClick={handleAddAccount}
                title="Hesap Ekle"
              >
                <UserPlus size={14} />
              </button>
            </div>
            <button
              className="cal-sync-btn"
              onClick={syncGoogleEvents}
              disabled={syncing}
              title="Senkronize Et"
            >
              <RefreshCw size={14} className={syncing ? 'cal-spin' : ''} />
            </button>
          </div>
        )}
      </div>

      {/* ========== Date Info + Month Button ========== */}
      <div className="glass-card" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {format(parseISO(selectedDateStr), 'dd MMMM yyyy, EEEE', { locale: tr })}
          </span>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {events.length === 0 ? 'Etkinlik yok' : `${events.length} etkinlik`}
            {googleEvents.length > 0 && ` (${googleEvents.length} Google)`}
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
            const isGoogleEvent = event.isGoogle;

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
                  className={`cal-event-card glass-card ${isGoogleEvent ? 'cal-google-event' : ''}`}
                  style={{ borderLeft: `3px solid ${isGoogleEvent && event.accountColor ? event.accountColor : typeConfig.color}` }}
                >
                  <div className="cal-event-header">
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="cal-event-type-badge" style={{ background: `${typeConfig.color}20`, color: typeConfig.color }}>
                        {typeConfig.emoji} {typeConfig.label}
                      </span>
                      {isGoogleEvent && event.accountColor && (
                        <span
                          className="cal-event-account-dot"
                          style={{ background: event.accountColor }}
                          title={event.accountEmail}
                        />
                      )}
                      {isGoogleEvent && (
                        <span className="cal-google-badge">
                          <svg viewBox="0 0 24 24" width="10" height="10">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Google
                        </span>
                      )}
                    </div>
                    {!isGoogleEvent && (
                      <button className="cal-event-delete" onClick={() => handleDelete(event.id)}>
                        <Trash2 size={14} />
                      </button>
                    )}
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
