// CalendarPage — PersonaVK reskin of CalendarView. Preserves all storage,
// Google Calendar multi-account auth, token refresher, snackbar undo and
// month modal date-select event behavior.
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Plus, X, Calendar as CalIcon, Clock, Trash2, ExternalLink,
  ChevronLeft, ChevronRight, RefreshCw, UserPlus,
} from 'lucide-react';
import { getCalendarEvents, addCalendarEvent, removeCalendarEvent } from '../utils/storage';
import {
  getAccounts,
  addAccount as addGoogleAccount,
  removeAccount as removeGoogleAccount,
  refreshAccount as refreshGoogleAccount,
  fetchGoogleEvents,
  startTokenRefresher,
  stopTokenRefresher,
} from '../utils/googleCalendar';
import { getActiveDateString } from '../utils/date';
import { format, addMonths, subMonths, startOfMonth, startOfWeek, addDays, isSameMonth, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { mkTheme } from '../theme';
import Header from './Header';

const ACCENT = '#00d4ff';
const PURPLE = '#bd00ff';

const EVENT_TYPES = {
  meeting: { label: 'Toplantı', color: ACCENT, emoji: '🔵' },
  event:   { label: 'Etkinlik', color: PURPLE, emoji: '🟣' },
};

const PLATFORMS = [
  { key: 'zoom',  label: 'Zoom',        icon: '📹' },
  { key: 'meet',  label: 'Google Meet', icon: '📱' },
  { key: 'teams', label: 'Teams',       icon: '💬' },
  { key: null,   label: 'Yok',         icon: '—' },
];

const GoogleLogo = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function CalendarPage({ darkMode, selectedDateStr, setSelectedDateStr, refreshTrigger, onDataChange }) {
  const t = mkTheme(darkMode);

  const [showMonthModal, setShowMonthModal] = useState(false);
  const [monthDate, setMonthDate] = useState(parseISO(selectedDateStr));
  const [showAddModal, setShowAddModal] = useState(false);
  const [snackbar, setSnackbar] = useState(null);
  const snackbarTimer = useRef(null);

  // Google
  const [accounts, setAccounts] = useState(() => getAccounts());
  const [googleEvents, setGoogleEvents] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [googleInitialized, setGoogleInitialized] = useState(false);
  const [accountMenuFor, setAccountMenuFor] = useState(null);
  const googleConnected = accounts.length > 0;

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('meeting');
  const [formTimeStart, setFormTimeStart] = useState('09:00');
  const [formTimeEnd, setFormTimeEnd] = useState('10:00');
  const [formPlatform, setFormPlatform] = useState(null);
  const [formLink, setFormLink] = useState('');
  const titleRef = useRef(null);

  const todayStr = getActiveDateString();

  const localEvents = useMemo(() => getCalendarEvents(selectedDateStr), [selectedDateStr, refreshTrigger]);
  const allLocalEvents = useMemo(() => getCalendarEvents(), [refreshTrigger]);
  const events = useMemo(
    () => [...localEvents, ...googleEvents].sort((a, b) => a.timeStart.localeCompare(b.timeStart)),
    [localEvents, googleEvents]
  );

  useEffect(() => {
    if (showAddModal && titleRef.current) titleRef.current.focus();
  }, [showAddModal]);

  const syncGoogleEvents = useCallback(async () => {
    if (accounts.length === 0) { setGoogleEvents([]); setGoogleInitialized(true); return; }
    setSyncing(true);
    try {
      const evs = await fetchGoogleEvents(selectedDateStr);
      setGoogleEvents(evs);
    } catch (e) {
      console.error('Google sync error:', e);
      setGoogleEvents([]);
    }
    setSyncing(false);
    setGoogleInitialized(true);
  }, [selectedDateStr, accounts.length]);

  useEffect(() => { syncGoogleEvents(); }, [syncGoogleEvents]);

  useEffect(() => {
    const onChange = () => setAccounts(getAccounts());
    window.addEventListener('lifeos_google_accounts_changed', onChange);
    return () => window.removeEventListener('lifeos_google_accounts_changed', onChange);
  }, []);

  useEffect(() => {
    startTokenRefresher();
    return () => stopTokenRefresher();
  }, []);

  const handleAddAccount = async () => {
    try { await addGoogleAccount(); setAccounts(getAccounts()); }
    catch (e) { console.error('Google add account error:', e); }
  };
  const handleRefreshAccount = async (email) => {
    try {
      await refreshGoogleAccount(email);
      setAccounts(getAccounts());
      setAccountMenuFor(null);
      syncGoogleEvents();
    } catch (e) { console.error('Google refresh account error:', e); }
  };
  const handleRemoveAccount = (email) => {
    removeGoogleAccount(email);
    setAccounts(getAccounts());
    setAccountMenuFor(null);
  };

  // Month grid
  const monthStart = startOfMonth(monthDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarDays = [];
  let day = calStart;
  while (calendarDays.length < 42) { calendarDays.push(new Date(day)); day = addDays(day, 1); }

  const eventDatesSet = useMemo(() => {
    const set = new Set();
    allLocalEvents.forEach(e => set.add(e.dateStr));
    googleEvents.forEach(e => set.add(e.dateStr));
    return set;
  }, [allLocalEvents, googleEvents]);

  const handleAddEvent = () => {
    if (!formTitle.trim()) return;
    addCalendarEvent({
      id: 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      dateStr: selectedDateStr,
      timeStart: formTimeStart,
      timeEnd: formTimeEnd,
      title: formTitle.trim(),
      description: formDesc.trim(),
      type: formType,
      platform: formType === 'meeting' ? formPlatform : null,
      link: formType === 'meeting' ? formLink.trim() : '',
    });
    resetForm();
    setShowAddModal(false);
    onDataChange?.();
  };

  const handleDelete = (eventId) => {
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
    setFormTitle(''); setFormDesc(''); setFormType('meeting');
    setFormTimeStart('09:00'); setFormTimeEnd('10:00');
    setFormPlatform(null); setFormLink('');
  };

  // ── Style helpers ──────────────────────────────────────────────
  const cardBase = {
    background: t.card, border: t.cardBorder, borderRadius: 20,
    boxShadow: t.cardShadow, color: t.text, padding: 18,
  };
  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    background: t.input, border: `1px solid ${t.inputBorder}`,
    color: t.text, fontSize: 14, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };
  const btnPrimary = (color) => ({
    flex: 1, padding: '12px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: color, color: '#0a0a0a', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
  });
  const btnGhost = {
    flex: 1, padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
    background: 'transparent', color: t.text,
    border: `1px solid ${t.inputBorder}`, fontSize: 14, fontFamily: 'inherit',
  };
  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20,
  };
  const modalStyle = { ...cardBase, padding: 24, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' };
  const iconBtn = {
    width: 40, height: 40, borderRadius: 12, border: `1px solid ${t.inputBorder}`,
    background: t.hover, color: t.text, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{ position: 'relative', minHeight: '60vh' }}>

      {/* Page header */}
      <div className="page-title" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: '-0.5px' }}>Takvim</div>
        <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>Toplantılar ve etkinlikler</div>
      </div>

      {/* Week strip */}
      <div style={{ marginBottom: 14 }}>
        <Header
          selectedDateStr={selectedDateStr}
          onSelectDate={setSelectedDateStr}
          refreshTrigger={refreshTrigger}
          mode="calendar"
        />
      </div>

      {/* Google accounts strip */}
      <div style={{ ...cardBase, marginBottom: 12, padding: 14 }}>
        {!googleInitialized ? (
          /* Loading — prevents flash of connect button while sync is in progress */
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            color: t.muted, fontSize: 13,
          }}>
            <RefreshCw size={14} style={{ animation: 'pvk-spin 1s linear infinite', flexShrink: 0 }} />
            Google Takvim yükleniyor…
          </div>
        ) : !googleConnected ? (
          <button
            onClick={handleAddAccount}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
              background: t.hover, border: `1px solid ${t.inputBorder}`,
              color: t.text, fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            <GoogleLogo size={18} />
            Google Takvim'e Bağlan
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
              {accounts.map(acc => (
                <div key={acc.email} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setAccountMenuFor(accountMenuFor === acc.email ? null : acc.email)}
                    title={acc.needsReauth ? `${acc.email} — oturum süresi doldu` : acc.email}
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      border: `2px solid ${acc.needsReauth ? '#f59e0b' : (acc.color || ACCENT)}`,
                      padding: 0, cursor: 'pointer', overflow: 'hidden',
                      background: t.hover, color: t.text,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 14, position: 'relative',
                    }}
                  >
                    {acc.picture
                      ? <img src={acc.picture} alt={acc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span>{(acc.name || acc.email)[0].toUpperCase()}</span>}
                    <span style={{
                      position: 'absolute', bottom: -2, right: -2,
                      width: 10, height: 10, borderRadius: '50%',
                      background: acc.needsReauth ? '#f59e0b' : (acc.color || ACCENT),
                      border: `2px solid ${t.card}`,
                    }} />
                  </button>
                  {accountMenuFor === acc.email && (
                    <div
                      onMouseLeave={() => setAccountMenuFor(null)}
                      style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
                        background: t.card, border: t.cardBorder, borderRadius: 12,
                        boxShadow: t.shadow, padding: 12, minWidth: 220,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 10 }}>
                        <strong style={{ fontSize: 13, color: t.text }}>{acc.name}</strong>
                        <span style={{ fontSize: 11, color: t.muted, wordBreak: 'break-all' }}>{acc.email}</span>
                        {acc.needsReauth && (
                          <span style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>
                            ⚠ Oturum süresi doldu
                          </span>
                        )}
                      </div>
                      {acc.needsReauth && (
                        <button
                          type="button"
                          onClick={() => handleRefreshAccount(acc.email)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '8px 10px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
                            background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,0.3)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                          }}
                        >
                          <RefreshCw size={12} /> Yeniden Bağlan
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveAccount(acc.email)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                          background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                          border: '1px solid rgba(239,68,68,0.3)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                        }}
                      >
                        <Trash2 size={12} /> Hesabı Kaldır
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddAccount}
                title="Hesap Ekle"
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `1px dashed ${t.inputBorder}`, background: 'transparent',
                  color: t.muted, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <UserPlus size={14} />
              </button>
            </div>
            <button
              onClick={syncGoogleEvents}
              disabled={syncing}
              title="Senkronize Et"
              style={{
                ...iconBtn,
                opacity: syncing ? 0.5 : 1,
                cursor: syncing ? 'wait' : 'pointer',
              }}
            >
              <RefreshCw size={16} style={{
                animation: syncing ? 'pvk-spin 0.8s linear infinite' : 'none',
              }} />
            </button>
          </div>
        )}
      </div>

      {/* Date info + month button */}
      <div style={{
        ...cardBase, marginBottom: 12, padding: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 14, color: t.text, fontWeight: 600 }}>
            {format(parseISO(selectedDateStr), 'dd MMMM yyyy, EEEE', { locale: tr })}
          </div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
            {events.length === 0 ? 'Etkinlik yok' : `${events.length} etkinlik`}
            {googleEvents.length > 0 && ` (${googleEvents.length} Google)`}
          </div>
        </div>
        <button
          onClick={() => { setMonthDate(parseISO(selectedDateStr)); setShowMonthModal(true); }}
          title="Aylık Takvim"
          style={iconBtn}
        >
          <CalIcon size={18} />
        </button>
      </div>

      {/* Timeline / empty */}
      {events.length === 0 ? (
        <div style={{ ...cardBase, textAlign: 'center', padding: 40, color: t.muted }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
          <div style={{ fontSize: 14 }}>Bu gün için etkinlik yok.</div>
          <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
            Sağ alttaki + butonuna tıklayarak ekle.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map((event, idx) => {
            const typeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.event;
            const platformInfo = PLATFORMS.find(p => p.key === event.platform);
            const isGoogleEvent = event.isGoogle;
            const accentColor = isGoogleEvent && event.accountColor ? event.accountColor : typeConfig.color;

            return (
              <div key={event.id} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                {/* Time column */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                  minWidth: 48, paddingTop: 14,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{event.timeStart}</span>
                  <span style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{event.timeEnd}</span>
                </div>

                {/* Dot + line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 18 }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: typeConfig.color,
                    boxShadow: `0 0 10px ${typeConfig.color}80`,
                  }} />
                  {idx < events.length - 1 && (
                    <div style={{
                      flex: 1, width: 2, marginTop: 4,
                      background: t.borderLine,
                    }} />
                  )}
                </div>

                {/* Event card */}
                <div style={{
                  ...cardBase, flex: 1, padding: 14,
                  borderLeft: `3px solid ${accentColor}`,
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    gap: 8, marginBottom: 6,
                  }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
                        background: `${typeConfig.color}20`, color: typeConfig.color,
                      }}>
                        {typeConfig.emoji} {typeConfig.label}
                      </span>
                      {isGoogleEvent && event.accountColor && (
                        <span
                          title={event.accountEmail}
                          style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: event.accountColor,
                          }}
                        />
                      )}
                      {isGoogleEvent && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, padding: '2px 6px', borderRadius: 6,
                          background: t.hover, color: t.muted, fontWeight: 600,
                        }}>
                          <GoogleLogo size={10} /> Google
                        </span>
                      )}
                    </div>
                    {!isGoogleEvent && (
                      <button
                        onClick={() => handleDelete(event.id)}
                        title="Sil"
                        style={{
                          width: 28, height: 28, borderRadius: 8, border: 'none',
                          background: 'transparent', color: t.muted, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: event.description ? 4 : 8 }}>
                    {event.title}
                  </div>
                  {event.description && (
                    <div style={{ fontSize: 13, color: t.muted, marginBottom: 8, lineHeight: 1.4 }}>
                      {event.description}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: t.muted }}>
                      <Clock size={12} />
                      {event.timeStart} – {event.timeEnd}
                    </span>
                    {event.type === 'meeting' && event.link && (
                      <a
                        href={event.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 8,
                          background: `${typeConfig.color}20`, color: typeConfig.color,
                          textDecoration: 'none',
                        }}
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

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        title="Yeni Etkinlik"
        style={{
          position: 'fixed', right: 24, bottom: 24, zIndex: 100,
          width: 56, height: 56, borderRadius: '50%', border: 'none',
          background: ACCENT, color: '#0a0a0a', cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(0,212,255,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Plus size={26} />
      </button>

      {/* Add modal */}
      {showAddModal && (
        <div style={overlayStyle} onClick={() => { setShowAddModal(false); resetForm(); }}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: ACCENT, fontWeight: 700, fontSize: 16 }}>
                <CalIcon size={18} /> Yeni Etkinlik
              </div>
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Type selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {Object.entries(EVENT_TYPES).map(([key, cfg]) => {
                const active = formType === key;
                return (
                  <button
                    key={key}
                    onClick={() => setFormType(key)}
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                      border: active ? `2px solid ${cfg.color}` : `1px solid ${t.inputBorder}`,
                      background: active ? `${cfg.color}20` : t.hover,
                      color: active ? cfg.color : t.text,
                      fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                    }}
                  >
                    {cfg.emoji} {cfg.label}
                  </button>
                );
              })}
            </div>

            <input
              ref={titleRef}
              type="text"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="Etkinlik başlığı..."
              onKeyDown={e => { if (e.key === 'Enter') handleAddEvent(); }}
              style={{ ...inputStyle, marginBottom: 10 }}
            />

            <textarea
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="Açıklama (opsiyonel)"
              rows={2}
              style={{ ...inputStyle, marginBottom: 12, resize: 'vertical', minHeight: 60 }}
            />

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: t.muted, display: 'block', marginBottom: 4 }}>Başlangıç</label>
                <input type="time" value={formTimeStart} onChange={e => setFormTimeStart(e.target.value)} style={inputStyle} />
              </div>
              <span style={{ color: t.muted, paddingBottom: 12 }}>→</span>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: t.muted, display: 'block', marginBottom: 4 }}>Bitiş</label>
                <input type="time" value={formTimeEnd} onChange={e => setFormTimeEnd(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {formType === 'meeting' && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  {PLATFORMS.map(p => {
                    const active = formPlatform === p.key;
                    return (
                      <button
                        key={p.key || 'none'}
                        onClick={() => setFormPlatform(p.key)}
                        title={p.label}
                        style={{
                          flex: 1, minWidth: 60, padding: '10px', borderRadius: 10, cursor: 'pointer',
                          border: active ? `2px solid ${ACCENT}` : `1px solid ${t.inputBorder}`,
                          background: active ? `${ACCENT}20` : t.hover,
                          color: t.text, fontSize: 18, fontFamily: 'inherit',
                        }}
                      >
                        {p.icon}
                      </button>
                    );
                  })}
                </div>
                {formPlatform && (
                  <input
                    type="url"
                    value={formLink}
                    onChange={e => setFormLink(e.target.value)}
                    placeholder="Toplantı linki (opsiyonel)"
                    style={{ ...inputStyle, marginBottom: 12 }}
                  />
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} style={btnGhost}>İptal</button>
              <button
                onClick={handleAddEvent}
                disabled={!formTitle.trim()}
                style={{
                  ...btnPrimary(EVENT_TYPES[formType].color),
                  opacity: formTitle.trim() ? 1 : 0.5,
                  cursor: formTitle.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Month modal */}
      {showMonthModal && (
        <div style={overlayStyle} onClick={() => setShowMonthModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
            }}>
              <button onClick={() => setMonthDate(subMonths(monthDate, 1))} style={iconBtn}>
                <ChevronLeft size={18} />
              </button>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>
                {format(monthDate, 'MMMM yyyy', { locale: tr })}
              </h3>
              <button onClick={() => setMonthDate(addMonths(monthDate, 1))} style={iconBtn}>
                <ChevronRight size={18} />
              </button>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6,
            }}>
              {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map(d => (
                <span key={d} style={{
                  textAlign: 'center', fontSize: 11, color: t.muted, fontWeight: 600, padding: 4,
                }}>{d}</span>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {calendarDays.map((d, i) => {
                const dStr = format(d, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(d, monthDate);
                const isToday = dStr === todayStr;
                const isSelected = dStr === selectedDateStr;
                const hasEvents = eventDatesSet.has(dStr);

                return (
                  <button
                    key={i}
                    onClick={() => {
                      setShowMonthModal(false);
                      window.dispatchEvent(new CustomEvent('calendarDateSelect', { detail: dStr }));
                    }}
                    style={{
                      aspectRatio: '1 / 1', borderRadius: 10, cursor: 'pointer',
                      border: isToday ? `2px solid ${ACCENT}` : `1px solid ${t.inputBorder}`,
                      background: isSelected ? ACCENT : (isCurrentMonth ? t.card : 'transparent'),
                      color: isSelected ? '#0a0a0a' : (isCurrentMonth ? t.text : t.muted),
                      fontSize: 13, fontWeight: isToday || isSelected ? 700 : 500,
                      fontFamily: 'inherit',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 2,
                      opacity: isCurrentMonth ? 1 : 0.45,
                    }}
                  >
                    <span>{format(d, 'd')}</span>
                    {hasEvents && (
                      <div style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: isSelected ? '#0a0a0a' : ACCENT,
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Snackbar */}
      {snackbar && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: t.cardDark, color: t.cardDarkText,
          padding: '12px 18px', borderRadius: 12,
          boxShadow: t.shadow, display: 'flex', alignItems: 'center', gap: 14,
          zIndex: 1100, fontSize: 14,
        }}>
          <span>Etkinlik silindi</span>
          <button
            onClick={handleUndoDelete}
            style={{
              background: 'transparent', border: 'none', color: ACCENT,
              fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
            }}
          >
            GERİ AL
          </button>
        </div>
      )}

      {/* Spin keyframes */}
      <style>{`@keyframes pvk-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
