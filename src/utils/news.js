// ======= News Engine — CryptoPanic Public RSS =======
// Fetches pre-parsed news from /api/news server endpoint.
// Server handles RSS fetch, XML→JSON parsing, AI/Tech prioritization.
// No API key needed — uses CryptoPanic's public RSS feed.

// Main fetch — calls server-side RSS endpoint
export async function fetchAllNews() {
  try {
    const res = await fetch('/api/news');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('News API error:', err.error || res.status);
      return [];
    }
    const data = await res.json();
    return data.items || [];
  } catch (e) {
    console.error('News fetch error:', e);
    return [];
  }
}

// Fetch CryptoPanic news via Discord Bot API (credentials stored server-side in env vars)
export async function fetchCPNews() {
  try {
    const res = await fetch('/api/cp-news');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('CP News error:', err.error || res.status);
      return [];
    }
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

// Scrape article content for deeper analysis.
// Returns { text: string|null, blocked: boolean }
export async function scrapeArticle(url) {
  try {
    const res = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return { text: null, blocked: true };
    const data = await res.json();
    return { text: data.text || null, blocked: data.blocked === true };
  } catch {
    return { text: null, blocked: true };
  }
}
