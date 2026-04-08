/**
 * Google Calendar API Integration
 * Uses Google Identity Services (GIS) for OAuth 2.0 token-based auth.
 * Read-only access to user's Google Calendar.
 */

const CLIENT_ID = '199527058579-hedl229jb677cu2ivgnbk485gkgfgedf.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events.readonly';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const TOKEN_KEY = 'vkgym_google_token';

// ======= Token Management =======

export const getStoredToken = () => {
  try {
    const data = JSON.parse(localStorage.getItem(TOKEN_KEY));
    if (!data) return null;
    // Check if token is expired
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const storeToken = (tokenResponse) => {
  const data = {
    access_token: tokenResponse.access_token,
    expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(data));
  return data;
};

export const clearGoogleToken = () => {
  const token = getStoredToken();
  if (token) {
    // Revoke the token
    try {
      google.accounts.oauth2.revoke(token.access_token);
    } catch (e) { /* ignore */ }
  }
  localStorage.removeItem(TOKEN_KEY);
};

// ======= OAuth Flow =======

export const initiateGoogleLogin = () => {
  return new Promise((resolve, reject) => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error));
            return;
          }
          const stored = storeToken(tokenResponse);
          resolve(stored);
        },
      });
      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
};

// ======= API Calls =======

/**
 * Fetch events for a given date from Google Calendar.
 * Returns events mapped to our app's schema.
 */
export const fetchGoogleEvents = async (dateStr) => {
  const token = getStoredToken();
  if (!token) return [];

  const timeMin = `${dateStr}T00:00:00Z`;
  const timeMax = `${dateStr}T23:59:59Z`;

  try {
    const url = `${CALENDAR_API}/calendars/primary/events?` + new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50',
    });

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    if (res.status === 401) {
      // Token expired
      localStorage.removeItem(TOKEN_KEY);
      return [];
    }

    if (!res.ok) return [];

    const data = await res.json();
    return (data.items || []).map(mapGoogleEvent).filter(Boolean);
  } catch (err) {
    console.error('Google Calendar fetch error:', err);
    return [];
  }
};

/**
 * Fetch events for a whole month (for month dots).
 */
export const fetchGoogleEventsForMonth = async (year, month) => {
  const token = getStoredToken();
  if (!token) return [];

  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0);
  const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

  const timeMin = `${firstDay}T00:00:00Z`;
  const timeMax = `${lastDayStr}T23:59:59Z`;

  try {
    const url = `${CALENDAR_API}/calendars/primary/events?` + new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.items || []).map(mapGoogleEvent).filter(Boolean);
  } catch {
    return [];
  }
};

// ======= Mapping =======

function mapGoogleEvent(gEvent) {
  if (!gEvent.start) return null;

  // Extract start/end times
  const startDt = gEvent.start.dateTime || gEvent.start.date;
  const endDt = gEvent.end?.dateTime || gEvent.end?.date || startDt;

  const startDate = new Date(startDt);
  const endDate = new Date(endDt);

  const dateStr = startDt.slice(0, 10); // YYYY-MM-DD
  const timeStart = gEvent.start.dateTime
    ? `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
    : '00:00';
  const timeEnd = gEvent.end?.dateTime
    ? `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
    : '23:59';

  // Detect if it's a meeting (has conferenceData or hangoutLink)
  const isMeeting = !!(gEvent.hangoutLink || gEvent.conferenceData);
  const meetLink = gEvent.hangoutLink || gEvent.conferenceData?.entryPoints?.[0]?.uri || '';

  // Detect platform
  let platform = null;
  if (meetLink) {
    if (meetLink.includes('zoom.us')) platform = 'zoom';
    else if (meetLink.includes('meet.google') || meetLink.includes('hangouts')) platform = 'meet';
    else if (meetLink.includes('teams.microsoft')) platform = 'teams';
  }

  return {
    id: 'g_' + gEvent.id,
    dateStr,
    timeStart,
    timeEnd,
    title: gEvent.summary || '(Başlıksız)',
    description: gEvent.description || '',
    type: isMeeting ? 'meeting' : 'event',
    platform,
    link: meetLink,
    isGoogle: true, // Google'dan gelen etkinlik olduğunu belirt
  };
}
