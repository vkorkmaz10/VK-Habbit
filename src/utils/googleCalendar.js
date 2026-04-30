/**
 * Google Calendar API Integration — multi-account + silent refresh.
 *
 * Storage:
 *   lifeos_google_accounts = {
 *     "user@gmail.com": { access_token, expiresAt, email, name, picture, color }
 *   }
 *   (Legacy `lifeos_google_token` migrated to first account on first read.)
 *
 * Auth: Google Identity Services token client.
 *  - First connect: prompt='consent select_account' (user picks account)
 *  - Silent refresh: prompt='', hint=email (transparent if consent still valid)
 *
 * Proactive refresh: token rotated 5 min before expiry.
 */

/* global google */

const CLIENT_ID = '199527058579-hedl229jb677cu2ivgnbk485gkgfgedf.apps.googleusercontent.com';
const SCOPES = 'openid email profile https://www.googleapis.com/auth/calendar.events.readonly';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const ACCOUNTS_KEY = 'lifeos_google_accounts';
const LEGACY_TOKEN_KEY = 'lifeos_google_token';
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh if <5 min remains
const ACCOUNT_PALETTE = ['#00d4ff', '#ff5252', '#34A853', '#f4c430', '#bd00ff', '#ff8c42'];

// ======= Storage =======

function readAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch { /* noop */ }
  // Legacy migration
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_TOKEN_KEY));
    if (legacy?.access_token) {
      const acc = {
        '__legacy__': {
          email: '__legacy__',
          name: 'Bağlı Hesap',
          picture: '',
          color: ACCOUNT_PALETTE[0],
          access_token: legacy.access_token,
          expiresAt: legacy.expiresAt,
        },
      };
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(acc));
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      return acc;
    }
  } catch { /* noop */ }
  return {};
}

function writeAccounts(map) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(map));
  notify();
}

function notify() {
  window.dispatchEvent(new CustomEvent('lifeos_google_accounts_changed'));
}

function colorFor(email, existing) {
  // Stable color: pick from palette by hash, prefer one not already used
  const used = new Set(Object.values(existing || {}).map(a => a.color));
  let hash = 0;
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  for (let i = 0; i < ACCOUNT_PALETTE.length; i++) {
    const cand = ACCOUNT_PALETTE[(hash + i) % ACCOUNT_PALETTE.length];
    if (!used.has(cand)) return cand;
  }
  return ACCOUNT_PALETTE[hash % ACCOUNT_PALETTE.length];
}

// ======= Public read =======

/**
 * @returns {Array<{email,name,picture,color,expiresAt,connected:boolean}>}
 */
export function getAccounts() {
  const map = readAccounts();
  return Object.values(map).map(a => ({
    email: a.email,
    name: a.name,
    picture: a.picture,
    color: a.color,
    expiresAt: a.expiresAt,
    connected: !!a.access_token && Date.now() < a.expiresAt,
    needsReauth: !!a.needsReauth || (!!a.access_token && Date.now() >= a.expiresAt),
  }));
}

export function hasAnyAccount() {
  return Object.keys(readAccounts()).length > 0;
}

// ======= GIS helpers =======

function gisReady() {
  return typeof google !== 'undefined' && google.accounts?.oauth2;
}

function requestToken({ hint, prompt = '' }) {
  return new Promise((resolve, reject) => {
    if (!gisReady()) return reject(new Error('Google Identity Services yüklenmedi'));
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        prompt,            // '' = silent (if possible), 'consent select_account' = full UI
        hint: hint || '',
        callback: (resp) => {
          if (resp.error) reject(new Error(resp.error_description || resp.error));
          else resolve(resp);
        },
        error_callback: (err) => reject(new Error(err?.message || 'OAuth iptal/hata')),
      });
      client.requestAccessToken();
    } catch (e) {
      reject(e);
    }
  });
}

async function fetchUserInfo(accessToken) {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error('userinfo fetch failed');
  return res.json(); // { email, name, picture, sub }
}

// ======= Public auth =======

/**
 * Add a new account. Always shows account picker (so user can add a different one).
 */
export async function addAccount() {
  const tok = await requestToken({ prompt: 'consent select_account' });
  const info = await fetchUserInfo(tok.access_token);
  const map = readAccounts();
  // If '__legacy__' placeholder exists, drop it now that we have real email
  if (map['__legacy__']) delete map['__legacy__'];
  const existing = map[info.email];
  map[info.email] = {
    email: info.email,
    name: info.name || info.email,
    picture: info.picture || '',
    color: existing?.color || colorFor(info.email, map),
    access_token: tok.access_token,
    expiresAt: Date.now() + (tok.expires_in * 1000),
  };
  writeAccounts(map);
  return map[info.email];
}

/**
 * Explicitly re-auth an existing account (user-initiated). Shows Google UI intentionally.
 */
export async function refreshAccount(email) {
  const tok = await requestToken({ hint: email, prompt: 'select_account' });
  const info = await fetchUserInfo(tok.access_token);
  const map = readAccounts();
  const target = email === '__legacy__' ? '__legacy__' : (info.email || email);
  if (map['__legacy__'] && target !== '__legacy__') delete map['__legacy__'];
  map[target] = {
    ...(map[target] || {}),
    email: info.email || email,
    name: info.name || info.email || email,
    picture: info.picture || '',
    color: map[target]?.color || colorFor(info.email || email, map),
    access_token: tok.access_token,
    expiresAt: Date.now() + (tok.expires_in * 1000),
    needsReauth: false,
  };
  writeAccounts(map);
  return map[target];
}

export function removeAccount(email) {
  const map = readAccounts();
  const acc = map[email];
  if (acc?.access_token && gisReady()) {
    try { google.accounts.oauth2.revoke(acc.access_token, () => {}); } catch { /* noop */ }
  }
  delete map[email];
  writeAccounts(map);
}

/**
 * Silent re-auth for an account. Returns updated account or throws.
 */
async function silentRefresh(email) {
  const tok = await requestToken({ hint: email, prompt: '' });
  const map = readAccounts();
  if (!map[email]) throw new Error('account vanished');
  map[email].access_token = tok.access_token;
  map[email].expiresAt = Date.now() + (tok.expires_in * 1000);
  writeAccounts(map);
  return map[email];
}

/**
 * Returns the stored access_token for `email` without triggering any UI.
 * Expired tokens are returned as-is — the caller handles 401 gracefully.
 * Silent refresh is only triggered by explicit user action (refreshAccount).
 */
async function ensureFreshToken(email) {
  const map = readAccounts();
  const acc = map[email];
  if (!acc || !acc.access_token) return null;
  return acc.access_token;
}

// ======= Background refresher =======
// No-op: tokens are only refreshed via explicit user action (refreshAccount).
// Removing proactive silentRefresh prevents uninvited Google UI popups.

let _refresherInterval = null;
export function startTokenRefresher() {}
export function stopTokenRefresher() {
  if (_refresherInterval) { clearInterval(_refresherInterval); _refresherInterval = null; }
}

// ======= API Calls =======

async function fetchOneAccount(email, params) {
  const token = await ensureFreshToken(email);
  if (!token) return [];
  const url = `${CALENDAR_API}/calendars/primary/events?${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 401) {
    // Token expired — mark account as needing re-auth, no auto-popup
    const map = readAccounts();
    if (map[email]) { map[email].needsReauth = true; writeAccounts(map); }
    return [];
  }

  if (!res.ok) return [];
  const data = await res.json();
  const map = readAccounts();
  const acc = map[email];
  return (data.items || [])
    .map(ev => mapGoogleEvent(ev, acc))
    .filter(Boolean);
}

/**
 * Fetch events for a single date — merged across all connected accounts.
 */
export async function fetchGoogleEvents(dateStr) {
  const map = readAccounts();
  const emails = Object.keys(map);
  if (!emails.length) return [];
  const params = new URLSearchParams({
    timeMin: `${dateStr}T00:00:00Z`,
    timeMax: `${dateStr}T23:59:59Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  }).toString();
  const all = await Promise.all(emails.map(em => fetchOneAccount(em, params).catch(() => [])));
  return all.flat();
}

/**
 * Fetch events for a whole month — merged across all accounts.
 */
export async function fetchGoogleEventsForMonth(year, month) {
  const map = readAccounts();
  const emails = Object.keys(map);
  if (!emails.length) return [];
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0);
  const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  const params = new URLSearchParams({
    timeMin: `${firstDay}T00:00:00Z`,
    timeMax: `${lastDayStr}T23:59:59Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  }).toString();
  const all = await Promise.all(emails.map(em => fetchOneAccount(em, params).catch(() => [])));
  return all.flat();
}

// ======= Mapping =======

function mapGoogleEvent(gEvent, acc) {
  if (!gEvent.start) return null;

  const startDt = gEvent.start.dateTime || gEvent.start.date;
  const endDt = gEvent.end?.dateTime || gEvent.end?.date || startDt;
  const startDate = new Date(startDt);
  const endDate = new Date(endDt);

  const dateStr = startDt.slice(0, 10);
  const timeStart = gEvent.start.dateTime
    ? `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
    : '00:00';
  const timeEnd = gEvent.end?.dateTime
    ? `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
    : '23:59';

  const isMeeting = !!(gEvent.hangoutLink || gEvent.conferenceData);
  const meetLink = gEvent.hangoutLink || gEvent.conferenceData?.entryPoints?.[0]?.uri || '';

  let platform = null;
  if (meetLink) {
    if (meetLink.includes('zoom.us')) platform = 'zoom';
    else if (meetLink.includes('meet.google') || meetLink.includes('hangouts')) platform = 'meet';
    else if (meetLink.includes('teams.microsoft')) platform = 'teams';
  }

  return {
    id: `g_${acc?.email || 'unknown'}_${gEvent.id}`,
    dateStr,
    timeStart,
    timeEnd,
    title: gEvent.summary || '(Başlıksız)',
    description: gEvent.description || '',
    type: isMeeting ? 'meeting' : 'event',
    platform,
    link: meetLink,
    isGoogle: true,
    accountEmail: acc?.email || '',
    accountName: acc?.name || '',
    accountPicture: acc?.picture || '',
    accountColor: acc?.color || ACCOUNT_PALETTE[0],
  };
}
