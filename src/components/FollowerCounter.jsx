// FollowerCounter — X (Twitter) takipçi sayısı kartı.
// Cloudflare Pages Function üzerinden livecounts.io API proxy'lenir.
// PersonaVK kart stiline uyumlu, dark/light otomatik, animasyonlu sayaç.
import React, { useEffect, useRef, useState } from 'react';
import { useFollowerCount } from '../hooks/useFollowerCount';
import { mkTheme } from '../theme';

const ACCENT = '#00d4ff';

// X logo (resmi 𝕏 mark, single-color)
function XLogo({ color, size = 22 }) {
  return (
    <svg viewBox="0 0 1200 1227" width={size} height={size} fill={color} aria-hidden="true">
      <path d="M714.163 519.284 1160.89 0H1055.03L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894L144.011 79.694h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z"/>
    </svg>
  );
}

// Smooth easing animasyonu — eski sayıdan yeni sayıya 800ms
function useAnimatedNumber(target, durationMs = 800) {
  const [display, setDisplay] = useState(target ?? 0);
  const fromRef = useRef(target ?? 0);
  const startRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target == null) return;
    cancelAnimationFrame(rafRef.current);
    fromRef.current = display;
    startRef.current = performance.now();
    const from = fromRef.current;
    const to = target;
    if (from === to) return;

    const tick = (now) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (to - from) * eased);
      setDisplay(value);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return display;
}

const formatNumber = (n) => new Intl.NumberFormat('tr-TR').format(n);

export default function FollowerCounter({
  darkMode,
  user = 'vkorkmaz10',
  intervalMs = 30000,
  cardBase,
  labelStyle,
}) {
  const t = mkTheme(darkMode);
  const { count, error, loading, refresh } = useFollowerCount({ user, intervalMs });
  const display = useAnimatedNumber(count ?? 0);

  const fallbackCard = {
    background: t.card,
    borderRadius: 16,
    padding: 16,
    boxShadow: t.cardShadow,
    border: `1px solid ${t.border}`,
  };
  const baseStyle = cardBase || fallbackCard;
  const lblStyle = labelStyle || {
    fontSize: 11, fontWeight: 700, color: t.muted,
    textTransform: 'uppercase', letterSpacing: 0.6,
  };

  const handleClick = () => refresh();

  return (
    <div
      onClick={handleClick}
      title="Tıkla → yenile"
      style={{
        ...baseStyle,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 10,
        minHeight: 120,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Üst satır: logo + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: darkMode ? '#0f172a' : '#0b0b0b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <XLogo color="#ffffff" size={16} />
        </div>
        <div style={lblStyle}>𝕏 Takipçi</div>
        {loading && count == null && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: t.muted }}>…</span>
        )}
      </div>

      {/* Sayı */}
      <div style={{
        fontSize: 30,
        fontWeight: 800,
        color: error && count == null ? t.muted : t.text,
        lineHeight: 1.1,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: -0.5,
      }}>
        {error && count == null ? '—' : formatNumber(display)}
      </div>

      {/* Alt satır: handle + status */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 12, color: t.muted,
      }}>
        <span>@{user}</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          color: error ? '#ef4444' : ACCENT,
          fontWeight: 600,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: error ? '#ef4444' : ACCENT,
            boxShadow: error ? 'none' : `0 0 6px ${ACCENT}`,
          }} />
          {error ? 'offline' : 'live'}
        </span>
      </div>
    </div>
  );
}
