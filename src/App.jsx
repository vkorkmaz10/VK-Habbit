import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import TodoPage from './components/TodoPage';
import CalendarPage from './components/CalendarPage';
import ContentPage from './components/ContentPage';
import ContentEngine from './components/ContentEngine';
import SettingsView from './components/SettingsView';
import Sidebar from './components/Sidebar';
import HomePage from './components/HomePage';
import StatsPage from './components/StatsPage';
import HabitsPage from './components/HabitsPage';
import { getActiveDateString } from './utils/date';
import { performRollover } from './utils/storage';
import { mkTheme, syncThemeVars } from './theme';

// Persisted UI state keys (PersonaVK)
const LS_TAB = 'pvk_tab';
const LS_SIDEBAR = 'pvk_sidebar';
const LS_DARK = 'pvk_dark';

function readLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function writeLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function App() {
  // ── New shell state ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(() => readLS(LS_TAB, 'habits'));
  const [expanded, setExpanded] = useState(() => readLS(LS_SIDEBAR, false));
  const [darkMode, setDarkMode] = useState(() => readLS(LS_DARK, true));
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist + sync CSS vars on theme change
  useEffect(() => { writeLS(LS_TAB, activeTab); }, [activeTab]);
  useEffect(() => { writeLS(LS_SIDEBAR, expanded); }, [expanded]);
  useEffect(() => { writeLS(LS_DARK, darkMode); syncThemeVars(darkMode); }, [darkMode]);

  // ── Existing per-tab state (preserved as-is) ───────────────────
  const [selectedDateStr, setSelectedDateStr] = useState(getActiveDateString());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [todoDateStr, setTodoDateStr] = useState(getActiveDateString());
  const [todoRefresh, setTodoRefresh] = useState(0);
  const [calDateStr, setCalDateStr] = useState(getActiveDateString());
  const [calRefresh, setCalRefresh] = useState(0);

  useEffect(() => { performRollover(getActiveDateString()); }, []);

  const handleDataChange = () => setRefreshTrigger(p => p + 1);
  const handleTodoDataChange = () => setTodoRefresh(p => p + 1);
  const handleCalDataChange = () => setCalRefresh(p => p + 1);

  // Calendar month modal
  useEffect(() => {
    const handler = (e) => setCalDateStr(e.detail);
    window.addEventListener('calendarDateSelect', handler);
    return () => window.removeEventListener('calendarDateSelect', handler);
  }, []);

  // ContentView → "settings tab" yönlendirmesi (geri uyumluluk)
  useEffect(() => {
    const handler = () => setActiveTab('settings');
    window.addEventListener('vkgym_goto_settings', handler);
    return () => window.removeEventListener('vkgym_goto_settings', handler);
  }, []);

  const t = mkTheme(darkMode);

  return (
    <div style={{
      minHeight: '100vh',
      background: t.pageBg,
      fontFamily: 'Spline Sans, sans-serif',
      transition: 'background 0.25s, color 0.25s',
    }}>
      <div className="app-layout" style={{
        display: 'flex', height: '100vh',
        padding: 12, gap: 12,
        boxSizing: 'border-box', overflow: 'hidden',
      }}>

        <Sidebar
          activeTab={activeTab} setActiveTab={setActiveTab}
          expanded={expanded} setExpanded={setExpanded}
          mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}
          darkMode={darkMode} setDarkMode={setDarkMode}
        />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Mobile header */}
          <div className="mobile-header" style={{
            display: 'none', alignItems: 'center', gap: 12,
            padding: '10px 0 14px', marginBottom: 4,
          }}>
            <button onClick={() => setMobileOpen(true)} style={{
              width: 40, height: 40, borderRadius: 12,
              background: t.card, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: t.cardShadow,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span style={{ fontSize: 18, fontWeight: 700, color: t.text }}>PersonaVK</span>
            <button onClick={() => setDarkMode(d => !d)} style={{
              marginLeft: 'auto', width: 36, height: 36, borderRadius: 10,
              background: t.card, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {darkMode
                  ? <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
                  : <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                }
              </svg>
            </button>
          </div>

          {/* Page area — scroll container */}
          <div className="main-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>

            {activeTab === 'home' && <HomePage darkMode={darkMode} setActiveTab={setActiveTab} />}

            {activeTab === 'habits' && (
              <>
                <HabitsPage
                  darkMode={darkMode}
                  selectedDateStr={selectedDateStr}
                  setSelectedDateStr={setSelectedDateStr}
                  refreshTrigger={refreshTrigger}
                  onDataChange={handleDataChange}
                />
              </>
            )}

            {activeTab === 'todo' && (
              <TodoPage
                darkMode={darkMode}
                selectedDateStr={todoDateStr}
                setSelectedDateStr={setTodoDateStr}
                refreshTrigger={todoRefresh}
                onDataChange={handleTodoDataChange}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarPage
                darkMode={darkMode}
                selectedDateStr={calDateStr}
                setSelectedDateStr={setCalDateStr}
                refreshTrigger={calRefresh}
                onDataChange={handleCalDataChange}
              />
            )}

            {/* ContentPage — her zaman mount, gizli kalır (sessionStorage / cache korunur) */}
            <div style={{ display: activeTab === 'content' ? 'block' : 'none' }}>
              <ContentPage darkMode={darkMode} />
            </div>

            {activeTab === 'engine' && <ContentEngine darkMode={darkMode} setActiveTab={setActiveTab} />}

            {activeTab === 'stats' && <StatsPage darkMode={darkMode} />}

            {activeTab === 'settings' && <SettingsView darkMode={darkMode} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
