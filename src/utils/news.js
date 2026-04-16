// ======= News Engine =======
// /api/news   — Multi-source crypto RSS feeds (CoinDesk, CoinTelegraph, etc.)
// /api/cp-news — CryptoCompare News API (requires CRYPTOCOMPARE_API_KEY in env)

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

// Fetch CryptoCompare news.
// apiKey: kullanıcının localStorage'dan girdiği key (önce denenir).
// Yoksa sunucu env varına düşer.
export async function fetchCPNews(apiKey = '') {
  try {
    const url = apiKey
      ? `/api/cp-news?key=${encodeURIComponent(apiKey)}`
      : '/api/cp-news';
    const res = await fetch(url);
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
