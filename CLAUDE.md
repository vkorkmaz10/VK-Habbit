# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Rules
- **Important:** Always output the design/plan in "plan mode" before implementing any changes. Plan first, write code second.

## Commands

```bash
npm run dev       # Start dev server (localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Preview production build
npm run lint      # ESLint check
```

No test suite is configured.

## Architecture

**Stack:** React 19 + Vite, vanilla CSS (no Tailwind), `date-fns` for time, `lucide-react` for icons. Deployed as a PWA via `vite-plugin-pwa`.

**Data layer:** All data lives in `localStorage` under the key `vkgym_data`. No backend. Schema:
```json
{
  "startDate": "2026-03-23",
  "days": {
    "2026-04-05": {
      "w": 75.50,        // weight (kg) or null
      "c": [1,0,1,...],  // 12-element array of habit checks (0/1)
      "m": ["Chest"],    // muscle groups trained
      "t": [...]         // to-do tasks
    }
  },
  "calendarEvents": [...]
}
```

All storage reads/writes go through `src/utils/storage.js`. Never read/write `localStorage` directly from components.

**Date logic:** The "active day" resets at 03:00 (not midnight). `getActiveDateString()` in `src/utils/date.js` subtracts 3 hours before formatting — always use this instead of `new Date()` directly. `START_DATE_STR = '2026-03-23'` is the app's epoch for week numbering.

**Scoring (`calculateDayScore` in `storage.js`):**
- Workout day (check index 8 = 1): score = `(all_checked / 12) × 100`
- Rest day: score = `(core_checked / 9) × maxScore`, where `maxScore` is 70/90/100 based on weekly workout count (<4/4/5+)
- Core indices: `[0,2,3,4,5,6,7,10,11]` — Workout-conditional indices: `[1,8,9]`

**Tab routing:** `App.jsx` manages a `currentTab` state with 5 tabs: `habit`, `todo`, `calendar`, `content`, `page5`. Each tab has its own independent `selectedDateStr` and `refreshTrigger` state. Tab switching is rendered via conditional blocks, not React Router.

**Components (`src/components/`):**
- `Header.jsx` — Week navigator with SVG day-score progress rings; blocks navigation to future weeks
- `DailyView.jsx` — Weight slider + habit checkboxes; triggers muscle modal when workout (index 8) is checked
- `WeeklyReport.jsx` — Weekly stats, weight feedback, and muscle group badges
- `TodoView.jsx` — Per-day to-do list; unfinished tasks roll over to today on app open (`performRollover`)
- `CalendarView.jsx` — Calendar events view; listens for `calendarDateSelect` custom window event for month-modal date selection
- `ContentView.jsx` — Content feed (Reddit/crypto/news proxied through Vite dev server)
- `BodyHighlighter.jsx` — SVG body heatmap component (infrastructure exists, integrated into WeeklyReport)

**Habit constants (`src/data/constants.js`):** The 12-item `CHECKBOX_ITEMS` array is the source of truth for habit labels and indices. Index positions are hardcoded in scoring logic — changing order breaks scoring.

**Dev server proxies (vite.config.js):** `/api/reddit`, `/api/cryptocompare`, `/api/anthropic` proxy to their respective external APIs in dev. In production (Vercel), these need separate serverless function handling or environment config.
