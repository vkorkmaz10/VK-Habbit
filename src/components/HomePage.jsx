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
import { getActiveDateString } from '../utils/date';
import { CHECKBOX_ITEMS } from '../data/constants';
import { format, parseISO, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';

const ACCENT = '#00d4ff';

export default function HomePage({ darkMode, setActiveTab }) {
  const t = mkTheme(darkMode);
  const [tick, setTick] = useState(0);

  // Bugünden başlayarak son 7 günü topla
  const todayStr = getActiveDateString();

  useEffect(() => {
    // Tab'a her dönüldüğünde freshen (cheap)
    const onFocus = () => setTick(x => x + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

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

    // Events
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

  const quickLink = (label, icon, tab, color = ACCENT) => (
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
        background: `${color}20`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.text }}>{label}</div>
      <ArrowRight size={16} color={t.muted} />
    </button>
  );

  // Score color
  const scoreColor = summary.todayScore >= 80 ? '#10b981' : summary.todayScore >= 60 ? ACCENT : summary.todayScore >= 40 ? '#f59e0b' : '#ef4444';

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
            <Flame size={26} color="#f59e0b" style={{ alignSelf: 'center' }} />
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
                  ? <TrendingUp size={13} color="#ef4444" />
                  : summary.weightDelta < 0
                    ? <TrendingDown size={13} color="#10b981" />
                    : <Activity size={13} color={t.muted} />}
                <span style={{
                  color: summary.weightDelta > 0 ? '#ef4444' : summary.weightDelta < 0 ? '#10b981' : t.muted,
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
              color: ACCENT, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            Detaylar <ArrowRight size={12} />
          </button>
        </div>
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 6, height: 100,
        }}>
          {summary.trend.map((d, i) => {
            const h = Math.max(4, (d.score / maxTrend) * 90);
            const isToday = d.dateStr === todayStr;
            const c = d.score >= 80 ? '#10b981' : d.score >= 60 ? ACCENT : d.score >= 40 ? '#f59e0b' : '#ef4444';
            return (
              <div key={i} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 6,
              }}>
                <div style={{
                  fontSize: 10, color: t.muted, fontWeight: 600,
                  opacity: d.score > 0 ? 1 : 0.4,
                }}>
                  {d.score || ''}
                </div>
                <div style={{
                  width: '100%', maxWidth: 36, height: h, borderRadius: 8,
                  background: c, opacity: isToday ? 1 : 0.55,
                  boxShadow: isToday ? `0 0 12px ${c}80` : 'none',
                }} />
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

      {/* Today's checklist preview */}
      <div style={{ ...cardBase, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={labelStyle}>BUGÜNÜN ALIŞKANLIKLARI</div>
          <button
            onClick={() => setActiveTab?.('habits')}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: ACCENT, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            Aç <ArrowRight size={12} />
          </button>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8,
        }}>
          {CHECKBOX_ITEMS.map((item, i) => {
            const done = summary.todayData.c[i] === 1;
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 10,
                background: done ? `${ACCENT}15` : t.hover,
                border: `1px solid ${done ? `${ACCENT}40` : t.inputBorder}`,
                opacity: done ? 1 : 0.7,
              }}>
                <span style={{ fontSize: 14 }}>{item.emoji}</span>
                <span style={{
                  fontSize: 11, color: done ? ACCENT : t.text,
                  fontWeight: done ? 700 : 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {item.label}
                </span>
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
          summary.tasksOpen > 0 ? ACCENT : '#10b981',
        )}
        {quickLink(
          summary.eventsCount > 0 ? `Bugün ${summary.eventsCount} etkinlik` : 'Etkinlik yok',
          <CalIcon size={18} />,
          'calendar',
          '#bd00ff',
        )}
        {quickLink(
          'İçerik üret',
          <Dumbbell size={18} />,
          'content',
          '#f59e0b',
        )}
        {quickLink(
          'İstatistikler',
          <Activity size={18} />,
          'stats',
          '#10b981',
        )}
      </div>
    </div>
  );
}
