// StatsPage — PersonaVK analitik dashboard. 14 günlük skor trend, kilo grafiği,
// alışkanlık başarı oranı, antrenman frekansı ve kas grubu heatmap.
import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Dumbbell, Award } from 'lucide-react';
import { mkTheme } from '../theme';
import {
  getDayData, calculateDayScore, getStoreSummary,
} from '../utils/storage';
import { getActiveDateString } from '../utils/date';
import { CHECKBOX_ITEMS } from '../data/constants';
import { format, parseISO, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';

const ACCENT = '#00d4ff';
const RANGES = [
  { key: 7,  label: '7G' },
  { key: 14, label: '14G' },
  { key: 30, label: '30G' },
];

export default function StatsPage({ darkMode }) {
  const t = mkTheme(darkMode);
  const [range, setRange] = useState(14);

  const todayStr = getActiveDateString();

  const stats = useMemo(() => {
    const days = [];
    for (let i = range - 1; i >= 0; i--) {
      const dStr = format(subDays(parseISO(todayStr), i), 'yyyy-MM-dd');
      const data = getDayData(dStr);
      const score = calculateDayScore(dStr);
      days.push({ dateStr: dStr, data, score });
    }

    // Score stats
    const scores = days.map(d => d.score);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const maxScore = Math.max(...scores);

    // Compare halves
    const half = Math.floor(range / 2);
    const firstHalfAvg = Math.round(days.slice(0, half).reduce((a, b) => a + b.score, 0) / Math.max(half, 1));
    const secondHalfAvg = Math.round(days.slice(half).reduce((a, b) => a + b.score, 0) / Math.max(range - half, 1));
    const trendDelta = secondHalfAvg - firstHalfAvg;

    // Weight series
    const weightPts = days
      .map(d => ({ dateStr: d.dateStr, w: d.data.w }))
      .filter(p => p.w !== null);
    const wFirst = weightPts[0]?.w ?? null;
    const wLast = weightPts[weightPts.length - 1]?.w ?? null;
    const wDelta = wFirst !== null && wLast !== null ? +(wLast - wFirst).toFixed(2) : null;
    const wMin = weightPts.length ? Math.min(...weightPts.map(p => p.w)) : null;
    const wMax = weightPts.length ? Math.max(...weightPts.map(p => p.w)) : null;

    // Habit completion (per habit)
    const habitStats = CHECKBOX_ITEMS.map((item, idx) => {
      const done = days.filter(d => d.data.c[idx] === 1).length;
      return {
        ...item,
        done,
        total: days.length,
        rate: Math.round((done / days.length) * 100),
      };
    }).sort((a, b) => b.rate - a.rate);

    // Workout frequency
    const workoutDays = days.filter(d => d.data.c[8] === 1).length;
    const workoutRate = Math.round((workoutDays / days.length) * 100);

    // Muscle group heatmap
    const muscleCounts = {};
    days.forEach(d => {
      (d.data.m || []).forEach(m => {
        muscleCounts[m] = (muscleCounts[m] || 0) + 1;
      });
    });
    const muscles = Object.entries(muscleCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const muscleMax = muscles[0]?.count || 1;

    return {
      days, scores, avgScore, maxScore,
      firstHalfAvg, secondHalfAvg, trendDelta,
      weightPts, wFirst, wLast, wDelta, wMin, wMax,
      habitStats, workoutDays, workoutRate, muscles, muscleMax,
    };
  }, [range, todayStr]);

  // ── Style helpers ──────────────────────────────────────────────
  const cardBase = {
    background: t.card, border: t.cardBorder, borderRadius: 20,
    boxShadow: t.cardShadow, color: t.text, padding: 18,
  };
  const labelStyle = { fontSize: 11, color: t.muted, letterSpacing: '0.5px', fontWeight: 600, textTransform: 'uppercase' };
  const metricBig = { fontSize: 28, fontWeight: 800, color: t.text, lineHeight: 1, letterSpacing: '-0.5px' };

  const scoreColor = (s) => s >= 80 ? '#10b981' : s >= 60 ? ACCENT : s >= 40 ? '#f59e0b' : '#ef4444';

  // SVG weight line
  const weightSvg = useMemo(() => {
    if (stats.weightPts.length < 2) return null;
    const w = 600, h = 100, pad = 8;
    const span = stats.wMax - stats.wMin || 1;
    const xs = stats.weightPts.map((_, i) => pad + (i / (stats.weightPts.length - 1)) * (w - pad * 2));
    const ys = stats.weightPts.map(p => pad + (1 - (p.w - stats.wMin) / span) * (h - pad * 2));
    const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    const area = `${path} L${xs[xs.length - 1].toFixed(1)},${h} L${xs[0].toFixed(1)},${h} Z`;
    return { path, area, w, h };
  }, [stats.weightPts, stats.wMin, stats.wMax]);

  return (
    <div>
      {/* Page header + range selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: '-0.5px' }}>İstatistikler</div>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>İlerlemeni ölç, eğilimini gör</div>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 12, background: t.hover, border: `1px solid ${t.inputBorder}` }}>
          {RANGES.map(r => {
            const active = range === r.key;
            return (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: active ? t.card : 'transparent',
                  color: active ? t.text : t.muted,
                  fontWeight: active ? 700 : 500, fontSize: 12, fontFamily: 'inherit',
                  boxShadow: active ? t.cardShadow : 'none',
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top metrics row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12, marginBottom: 12,
      }}>
        <div style={cardBase}>
          <div style={labelStyle}>ORTALAMA SKOR</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <span style={{ ...metricBig, color: scoreColor(stats.avgScore) }}>{stats.avgScore}</span>
            <span style={{ fontSize: 13, color: t.muted, fontWeight: 600 }}>/100</span>
          </div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            {stats.trendDelta > 0
              ? <><TrendingUp size={13} color="#10b981" /><span style={{ color: '#10b981', fontWeight: 600 }}>+{stats.trendDelta}</span></>
              : stats.trendDelta < 0
                ? <><TrendingDown size={13} color="#ef4444" /><span style={{ color: '#ef4444', fontWeight: 600 }}>{stats.trendDelta}</span></>
                : <><Activity size={13} color={t.muted} /><span>Sabit</span></>}
            <span style={{ marginLeft: 4 }}>son yarıda</span>
          </div>
        </div>

        <div style={cardBase}>
          <div style={labelStyle}>EN YÜKSEK</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <Award size={22} color="#10b981" style={{ alignSelf: 'center' }} />
            <span style={{ ...metricBig, color: scoreColor(stats.maxScore) }}>{stats.maxScore}</span>
          </div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 6 }}>
            {range} günlük zirve
          </div>
        </div>

        <div style={cardBase}>
          <div style={labelStyle}>ANTRENMAN</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <Dumbbell size={22} color={ACCENT} style={{ alignSelf: 'center' }} />
            <span style={metricBig}>{stats.workoutDays}</span>
            <span style={{ fontSize: 13, color: t.muted, fontWeight: 600 }}>gün</span>
          </div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 6 }}>
            %{stats.workoutRate} sıklık
          </div>
        </div>

        <div style={cardBase}>
          <div style={labelStyle}>KİLO DEĞİŞİMİ</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            {stats.wDelta !== null ? (
              <>
                <span style={{
                  ...metricBig,
                  color: stats.wDelta > 0 ? '#ef4444' : stats.wDelta < 0 ? '#10b981' : t.text,
                }}>
                  {stats.wDelta > 0 ? '+' : ''}{stats.wDelta}
                </span>
                <span style={{ fontSize: 13, color: t.muted, fontWeight: 600 }}>kg</span>
              </>
            ) : (
              <span style={{ ...metricBig, fontSize: 18, color: t.muted }}>Veri yok</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 6 }}>
            {stats.wLast !== null ? `Şu an ${stats.wLast.toFixed(1)} kg` : 'Kilo girilmemiş'}
          </div>
        </div>
      </div>

      {/* Score trend bars */}
      <div style={{ ...cardBase, marginBottom: 12 }}>
        <div style={labelStyle}>SKOR TREND</div>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 3,
          height: 140, marginTop: 14,
        }}>
          {stats.days.map((d, i) => {
            const h = Math.max(2, (d.score / 100) * 130);
            const isToday = d.dateStr === todayStr;
            return (
              <div
                key={i}
                title={`${format(parseISO(d.dateStr), 'dd MMM', { locale: tr })}: ${d.score}/100`}
                style={{
                  flex: 1, height: h, borderRadius: 4,
                  background: scoreColor(d.score),
                  opacity: isToday ? 1 : 0.6,
                  boxShadow: isToday ? `0 0 8px ${scoreColor(d.score)}80` : 'none',
                  transition: 'opacity 0.15s',
                  cursor: 'pointer',
                }}
              />
            );
          })}
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: t.muted, marginTop: 8,
        }}>
          <span>{format(parseISO(stats.days[0].dateStr), 'dd MMM', { locale: tr })}</span>
          <span>Bugün</span>
        </div>
      </div>

      {/* Weight trend */}
      <div style={{ ...cardBase, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div style={labelStyle}>KİLO TRENDİ</div>
          {stats.weightPts.length > 0 && (
            <div style={{ fontSize: 11, color: t.muted }}>
              {stats.wMin?.toFixed(1)} – {stats.wMax?.toFixed(1)} kg
            </div>
          )}
        </div>
        {weightSvg ? (
          <svg viewBox={`0 0 ${weightSvg.w} ${weightSvg.h}`} preserveAspectRatio="none" style={{ width: '100%', height: 100, display: 'block' }}>
            <defs>
              <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.4" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={weightSvg.area} fill="url(#wGrad)" />
            <path d={weightSvg.path} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        ) : (
          <div style={{ textAlign: 'center', padding: 30, color: t.muted, fontSize: 13 }}>
            En az 2 kilo girişi gerekli
          </div>
        )}
      </div>

      {/* Habit completion rates */}
      <div style={{ ...cardBase, marginBottom: 12 }}>
        <div style={labelStyle}>ALIŞKANLIK BAŞARI ORANI</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {stats.habitStats.map(h => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{h.emoji}</span>
              <span style={{ fontSize: 12, color: t.text, fontWeight: 500, width: 110, flexShrink: 0 }}>
                {h.label}
              </span>
              <div style={{
                flex: 1, height: 8, borderRadius: 4,
                background: t.hover, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${h.rate}%`, height: '100%',
                  background: scoreColor(h.rate),
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }} />
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, color: scoreColor(h.rate),
                width: 38, textAlign: 'right',
              }}>
                %{h.rate}
              </span>
              <span style={{ fontSize: 10, color: t.muted, width: 40, textAlign: 'right' }}>
                {h.done}/{h.total}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Muscle heatmap */}
      <div style={cardBase}>
        <div style={labelStyle}>KAS GRUBU FREKANSI</div>
        {stats.muscles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: t.muted, fontSize: 13, marginTop: 10 }}>
            Henüz antrenman kas verisi yok
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 8, marginTop: 14,
          }}>
            {stats.muscles.map(m => {
              const intensity = m.count / stats.muscleMax;
              return (
                <div key={m.name} style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: `rgba(0,212,255,${0.1 + intensity * 0.4})`,
                  border: `1px solid rgba(0,212,255,${0.3 + intensity * 0.3})`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{m.name}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: ACCENT,
                    padding: '2px 8px', borderRadius: 6,
                    background: t.card,
                  }}>
                    {m.count}×
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
