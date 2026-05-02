// PersonaVK Sidebar — collapsible (desktop) + drawer (mobile)
import React from 'react';
import { mkTheme } from '../theme';

const NAV_ITEMS = [
  { id: 'home',     label: 'Ana Sayfa',       icon: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' },
  { id: 'habits',   label: 'Alışkanlıklarım', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  { id: 'todo',     label: 'To-Do',           icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { id: 'content',  label: 'İçerik',          icon: 'M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l6 6v10a2 2 0 0 1-2 2zM14 2v6h6M12 11v6M9 14h6' },
  { id: 'engine',   label: 'İçerik Motoru',   icon: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z' },
  { id: 'calendar', label: 'Takvim',          icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
  { id: 'stats',    label: 'İstatistikler',   icon: 'M18 20V10M12 20V4M6 20v-6' },
  { id: 'settings', label: 'Ayarlar',         icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
];

function SvgIcon({ path, size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="10" fill="#111" />
      <path d="M8 24 L16 8 L24 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 19 h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Sidebar({ activeTab, setActiveTab, expanded, setExpanded, mobileOpen, setMobileOpen, darkMode, setDarkMode }) {
  const t = mkTheme(darkMode);

  const sidebarContent = (isMobile) => (
    <div style={{
      width: isMobile ? 240 : (expanded ? 240 : 72),
      height: '100%',
      background: t.sidebar,
      borderRadius: isMobile ? '0 20px 20px 0' : 20,
      display: 'flex', flexDirection: 'column',
      padding: '24px 0',
      transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
      boxShadow: t.shadow,
    }}>
      <div style={{ padding: '0 20px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flexShrink: 0 }}><LogoMark /></div>
        {(expanded || isMobile) && (
          <span style={{ fontWeight: 700, fontSize: 20, color: t.text, whiteSpace: 'nowrap', letterSpacing: '-0.5px' }}>
            PersonaVK
          </span>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px' }}>
        {NAV_ITEMS.map(item => {
          const active = activeTab === item.id;
          return (
            <button key={item.id}
              onClick={() => { setActiveTab(item.id); if (isMobile) setMobileOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 12px', borderRadius: 14, border: 'none',
                cursor: 'pointer',
                background: active ? t.navActive : 'transparent',
                color: active ? t.navActiveText : t.navText,
                transition: 'all 0.15s', whiteSpace: 'nowrap',
                textAlign: 'left', width: '100%',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = t.hover; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ flexShrink: 0 }}>
                <SvgIcon path={item.icon} size={18} color={active ? t.navActiveText : t.navText} />
              </span>
              {(expanded || isMobile) && (
                <span style={{ fontSize: 14, fontWeight: active ? 600 : 500 }}>{item.label}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '16px 12px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button
          onClick={() => setDarkMode(d => !d)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 12px', borderRadius: 14, border: 'none',
            cursor: 'pointer', background: 'transparent', color: t.muted,
            width: '100%', transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = t.hover}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title={darkMode ? 'Aydınlık Mod' : 'Karanlık Mod'}
        >
          <span style={{ flexShrink: 0 }}>
            {darkMode
              ? <SvgIcon path="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" size={18} color={t.muted} />
              : <SvgIcon path="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" size={18} color={t.muted} />
            }
          </span>
          {(expanded || isMobile) && (
            <span style={{ fontSize: 14, fontWeight: 500 }}>{darkMode ? 'Aydınlık Mod' : 'Karanlık Mod'}</span>
          )}
        </button>

        {!isMobile && (
          <button onClick={() => setExpanded(e => !e)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 12px', borderRadius: 14, border: 'none',
              cursor: 'pointer', background: 'transparent', color: t.muted, width: '100%',
            }}
            onMouseEnter={e => e.currentTarget.style.background = t.hover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <SvgIcon path={expanded ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} size={18} color={t.muted} />
            {expanded && <span style={{ fontSize: 13, fontWeight: 500 }}>Daralt</span>}
          </button>
        )}
      </div>

      <div style={{
        padding: '16px 20px 0', borderTop: `1px solid ${t.borderLine}`,
        marginTop: 12, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: t.cardDark,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.cardDarkText, fontWeight: 700, fontSize: 14, flexShrink: 0,
        }}>V</div>
        {(expanded || isMobile) && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Volkan</div>
            <div style={{ fontSize: 11, color: t.muted }}>Kişisel Panel</div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="desktop-sidebar" style={{ height: '100%', flexShrink: 0 }}>
        {sidebarContent(false)}
      </div>
      {mobileOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)',
        }} onClick={() => setMobileOpen(false)}>
          <div style={{ height: '100%', width: 240 }} onClick={e => e.stopPropagation()}>
            {sidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
