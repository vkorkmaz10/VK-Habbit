// HomePage — PersonaVK dashboard. Bugünün özeti + hızlı erişim + 7 günlük trend.
import React, { useMemo, useEffect, useState } from 'react';
import {
  CheckCircle2, ListTodo, Calendar as CalIcon, TrendingUp, TrendingDown,
  Activity, Flame, Dumbbell, ArrowRight,
} from 'lucide-react';
import { mkTheme } from '../theme';
import FollowerCounter from './FollowerCounter';
import {
  getDayData, getLatestWeight, calculateDayScore,
  getTodoTasks, getCalendarEvents,
} from '../utils/storage';
import { fetchGoogleEvents, getAccounts } from '../utils/googleCalendar';
import { getActiveDateString } from '../utils/date';
import { format, parseISO, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';


export default function HomePage({ darkMode, setActiveTab }) {
  const t = mkTheme(darkMode);
  const [tick, setTick] = useState(0);
  const [googleEvents, setGoogleEvents] = useState([]);

  // Bugünden başlayarak son 7 günü topla
  const todayStr = getActiveDateString();

  useEffect(() => {
    // Tab'a her dönüldüğünde freshen (cheap)
    const onFocus = () => setTick(x => x + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    if (getAccounts().length === 0) return;
    fetchGoogleEvents(todayStr).then(setGoogleEvents).catch(() => {});
  }, [todayStr]);

  const summary = useMemo(() => {
    const todayData = getDayData(todayStr);
    const todayScore = calculateDayScore(todayStr);
    const checksDone = todayData.c.filter(c => c === 1).length;
    const checksTotal = CHECKBOX_ITEMS.length;

    // Weight + delta
    const currentWeight = getLatestWeight(todayStr);
    let prevWeight = null;
    for (let i = 1; i <= 14; i++) {
      const dStr = format(subDays(parseISO(todayStr), i), 'yyyy-MM-dd');
      const d = getDayData(dStr);
      if (d.w !== null && d.w !== currentWeight) { prevWeight = d.w; break; }
    }
    const weightDelta = prevWeight !== null ? +(currentWeight - prevWeight).toFixed(2) : null;

    // To-do
    const tasks = getTodoTasks(todayStr);
    const tasksOpen = tasks.filter(x => !x.done).length;
    const tasksDone = tasks.filter(x => x.done).length;

    // Events (local only — Google events merged separately via googleEvents state)
    const events = getCalendarEvents(todayStr);

    // 7-day score trend
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const dStr = format(subDays(parseISO(todayStr), i), 'yyyy-MM-dd');
      trend.push({
        dateStr: dStr,
        label: format(parseISO(dStr), 'EEEEEE', { locale: tr }),
        score: calculateDayScore(dStr),
      });
    }
    const avgScore = Math.round(trend.reduce((a, b) => a + b.score, 0) / trend.length);

    // Streak (consecutive days with score >= 60 going back)
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const dStr = format(subDays(parseISO(todayStr), i), 'yyyy-MM-dd');
      if (calculateDayScore(dStr) >= 60) streak++;
      else break;
    }

    return {
      todayData, todayScore, checksDone, checksTotal,
      currentWeight, weightDelta,
      tasksOpen, tasksDone,
      eventsCount: events.length,
      trend, avgScore, streak,
    };
  }, [todayStr, tick]);

  // ── Style helpers ──────────────────────────────────────────────
  const cardBase = {
    background: t.card, border: t.cardBorder, borderRadius: 20,
    boxShadow: t.cardShadow, color: t.text, padding: 18,
  };
  const labelStyle = { fontSize: 11, color: t.muted, letterSpacing: '0.5px', fontWeight: 600, textTransform: 'uppercase' };
  const metricBig = { fontSize: 32, fontWeight: 800, color: t.text, lineHeight: 1, letterSpacing: '-1px' };
  const subMetric = { fontSize: 13, color: t.muted, marginTop: 4 };

  const quickLink = (label, icon, tab) => (
    <button
      onClick={() => setActiveTab?.(tab)}
      style={{
        ...cardBase, padding: 14, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: t.hover, color: t.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.text }}>{label}</div>
      <ArrowRight size={16} color={t.muted} />
    </button>
  );

  const scoreColor = t.text;

  // Trend max for bar normalization
  const maxTrend = Math.max(100, ...summary.trend.map(d => d.score));

  return (
    <div style={{ position: 'relative' }}>

      {/* Greeting header */}
      <div className="page-title" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: t.muted, marginBottom: 2 }}>
          {format(parseISO(todayStr), 'dd MMMM yyyy, EEEE', { locale: tr })}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: t.text, letterSpacing: '-0.5px' }}>
          Merhaba, Volkan 👋
        </div>
      </div>

      {/* Top row: Score + Streak + Weight */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12, marginBottom: 12,
      }}>
        <div style={cardBase}>
          <div style={labelStyle}>BUGÜNKÜ SKOR</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <span style={{ ...metricBig, color: scoreColor }}>{summary.todayScore}</span>
            <span style={{ fontSize: 14, color: t.muted, fontWeight: 600 }}>/100</span>
          </div>
          <div style={subMetric}>
            {summary.checksDone}/{summary.checksTotal} alışkanlık tamam
          </div>
        </div>

        <div style={cardBase}>
          <div style={labelStyle}>SERİ</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <Flame size={26} color={t.text} style={{ alignSelf: 'center' }} />
            <span style={metricBig}>{summary.streak}</span>
            <span style={{ fontSize: 14, color: t.muted, fontWeight: 600 }}>gün</span>
          </div>
          <div style={subMetric}>
            {summary.streak === 0 ? 'Bugün başlayabilirsin' : 'Üst üste 60+ skor'}
          </div>
        </div>

        <div style={cardBase}>
          <div style={labelStyle}>KİLO</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <span style={metricBig}>{summary.currentWeight.toFixed(1)}</span>
            <span style={{ fontSize: 14, color: t.muted, fontWeight: 600 }}>kg</span>
          </div>
          <div style={{ ...subMetric, display: 'flex', alignItems: 'center', gap: 4 }}>
            {summary.weightDelta !== null ? (
              <>
                {summary.weightDelta > 0
                  ? <TrendingUp size={13} color={t.text} />
                  : summary.weightDelta < 0
                    ? <TrendingDown size={13} color={t.muted} />
                    : <Activity size={13} color={t.muted} />}
                <span style={{
                  color: summary.weightDelta > 0 ? t.text : summary.weightDelta < 0 ? t.muted : t.muted,
                  fontWeight: 600,
                }}>
                  {summary.weightDelta > 0 ? '+' : ''}{summary.weightDelta} kg son ölçüm
                </span>
              </>
            ) : (
              <span>İlk ölçüm</span>
            )}
          </div>
        </div>

        {/* 𝕏 Takipçi — top row 4. metrik (custom widget, livecounts.io proxy) */}
        <FollowerCounter
          darkMode={darkMode}
          user="vkorkmaz10"
          intervalMs={30000}
          cardBase={cardBase}
          labelStyle={labelStyle}
        />

      </div>

      {/* 7-day trend chart */}
      <div style={{ ...cardBase, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div>
            <div style={labelStyle}>SON 7 GÜN</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginTop: 4 }}>
              Ortalama: {summary.avgScore}/100
            </div>
          </div>
          <button
            onClick={() => setActiveTab?.('stats')}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: t.text, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            Detaylar <ArrowRight size={12} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, height: 110, alignItems: 'flex-end' }}>
          {summary.trend.map((d, i) => {
            const barH = Math.max(4, (d.score / maxTrend) * 90);
            const isToday = d.dateStr === todayStr;
            const c = d.score >= 60 ? t.text : t.muted;
            return (
              <div key={i} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4,
              }}>
                <div style={{
                  fontSize: 10, color: t.muted, fontWeight: 600,
                  opacity: d.score > 0 ? 1 : 0,
                  height: barH, display: 'flex', alignItems: 'flex-start',
                  paddingTop: 3,
                }}>
                  {d.score || ''}
                </div>
                <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <div style={{
                    width: '100%', maxWidth: 36, height: barH, borderRadius: 8,
                    background: c, opacity: isToday ? 1 : 0.55,
                  }} />
                </div>
                <div style={{
                  fontSize: 11, color: isToday ? t.text : t.muted,
                  fontWeight: isToday ? 700 : 500,
                  textTransform: 'capitalize',
                }}>
                  {d.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick access row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10,
      }}>
        {quickLink(
          summary.tasksOpen > 0 ? `${summary.tasksOpen} açık görev` : 'Tüm görevler tamam',
          <ListTodo size={18} />,
          'todo',
        )}
        {quickLink(
          (() => {
            const allEvents = [...getCalendarEvents(todayStr), ...googleEvents];
            const m = allEvents.filter(e => e.type === 'meeting').length;
            const e = allEvents.filter(e => e.type !== 'meeting').length;
            return `${m} Toplantı · ${e} Etkinlik`;
          })(),
          <CalIcon size={18} />,
          'calendar',
        )}
        {quickLink(
          'İçerik üret',
          <Dumbbell size={18} />,
          'content',
        )}
        {quickLink(
          'İstatistikler',
          <Activity size={18} />,
          'stats',
        )}
      </div>
    </div>
  );
}
