// PersonaVK theme tokens. mkTheme(darkMode) returns inline-style values.
// CSS variables (--pvk-*) are also written to document.documentElement on
// theme change so legacy CSS-class components can react.

export function mkTheme(dark) {
  return {
    pageBg:    dark ? '#0d0d0f' : '#f0f0f2',
    sidebar:   dark ? '#161618' : '#ffffff',
    card:      dark ? '#1c1c1f' : '#ffffff',
    cardDark:  dark ? '#242428' : '#111111',
    cardDarkText: dark ? '#e8e8ec' : '#ffffff',
    text:      dark ? '#e8e8ec' : '#111111',
    textInv:   dark ? '#111111' : '#e8e8ec',
    muted:     dark ? 'rgba(232,232,236,0.4)' : '#aaaaaa',
    border:    dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
    borderLine:dark ? '#2a2a2e' : '#f0f0f2',
    hover:     dark ? '#252529' : '#f4f4f6',
    input:     dark ? '#111114' : '#fafafa',
    inputBorder:dark ? '#2e2e32' : '#eeeeee',
    shadow:    dark ? '0 4px 28px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.4)' : '0 4px 28px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
    cardShadow:dark ? '0 4px 20px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.35)' : '0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
    cardBorder:dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
    accent:    dark ? '#e8e8ec' : '#111111',
    accentText:dark ? '#111111' : '#ffffff',
    navActive:    dark ? '#e8e8ec' : '#111111',
    navActiveText:dark ? '#111111' : '#ffffff',
    navHover:     dark ? '#252529' : '#f4f4f6',
    navText:      dark ? 'rgba(232,232,236,0.55)' : '#555555',
    barBg:     dark ? 'rgba(255,255,255,0.08)' : '#f0f0f2',
    progressTrack: dark ? 'rgba(255,255,255,0.1)' : '#f0f0f2',
  };
}

// Sync a subset of theme tokens to CSS variables so legacy class-based
// components inherit the dark/light palette without per-prop refactor.
export function syncThemeVars(dark) {
  const t = mkTheme(dark);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.setProperty('--pvk-page-bg', t.pageBg);
  root.style.setProperty('--pvk-card', t.card);
  root.style.setProperty('--pvk-text', t.text);
  root.style.setProperty('--pvk-muted', t.muted);
  root.style.setProperty('--pvk-border', t.border);
  root.style.setProperty('--pvk-border-line', t.borderLine);
  root.style.setProperty('--pvk-input', t.input);
  root.style.setProperty('--pvk-input-border', t.inputBorder);
  root.style.setProperty('--pvk-hover', t.hover);
  root.style.setProperty('--pvk-card-shadow', t.cardShadow);
  root.style.setProperty('--pvk-accent', t.accent);
  root.style.setProperty('--pvk-accent-text', t.accentText);
}
