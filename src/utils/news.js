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

// Scrape article content for deeper analysis
export async function scrapeArticle(url) {
  try {
    const res = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.text || null;
  } catch {
    return null;
  }
}
