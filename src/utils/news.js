// ======= News Engine =======
// Multi-source news aggregation with engagement scoring, filtering, and quota system.

// --- Source Configs ---
export const SOURCES = {
  reddit_bitcoin: { name: 'r/Bitcoin', emoji: '🟠', color: '#FF4500' },
  reddit_crypto: { name: 'r/CryptoCurrency', emoji: '🟠', color: '#FF4500' },
  coindesk: { name: 'CoinDesk', emoji: '📰', color: '#00d4ff' },
  decrypt: { name: 'Decrypt', emoji: '🔓', color: '#00d4ff' },
  techcrunch: { name: 'TechCrunch', emoji: '💚', color: '#0a0' },
  aibreakfast: { name: 'AI Breakfast', emoji: '🤖', color: '#bd00ff' },
  other: { name: 'Diğer', emoji: '🌐', color: '#888' },
};

const CRYPTOCOMPARE_KEY_STORAGE = 'vkgym_cryptocompare_key';

// --- AI/Tech Keywords ---
const AI_KEYWORDS = [
  'artificial intelligence', ' ai ', 'machine learning', 'deep learning',
  'gpt', 'llm', 'openai', 'anthropic', 'neural', 'automation',
  'chatbot', 'generative', 'transformer', 'copilot', 'gemini',
  'claude', 'midjourney', 'stable diffusion', 'robotics',
];

// --- Borsa Istanbul Filter ---
const BIST_PATTERNS = /borsa istanbul|bist|bist100|bist 100|xist/i;
const CRYPTO_KEYWORDS = /bitcoin|btc|ethereum|eth|crypto|blockchain|cbdc|dijital lira|kripto|stablecoin|defi/i;

function passesBorsaIstanbulFilter(item) {
  const text = (item.title + ' ' + (item.body || '')).toLowerCase();
  if (!BIST_PATTERNS.test(text)) return true;
  return CRYPTO_KEYWORDS.test(text);
}

// --- Category Detection ---
function detectCategory(item) {
  const text = (item.title + ' ' + (item.body || '')).toLowerCase();
  for (const kw of AI_KEYWORDS) {
    if (text.includes(kw)) return 'ai_tech';
  }
  return 'crypto';
}

// --- Source Detection (for CryptoCompare) ---
function detectSource(sourceName) {
  const lower = (sourceName || '').toLowerCase();
  if (lower.includes('coindesk')) return 'coindesk';
  if (lower.includes('decrypt')) return 'decrypt';
  if (lower.includes('techcrunch')) return 'techcrunch';
  return 'other';
}

// --- Reddit Fetch ---
async function fetchRedditSubreddit(subreddit, sourceKey) {
  try {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isDev
      ? `/api/reddit/r/${subreddit}/hot.json?limit=10`
      : `https://www.reddit.com/r/${subreddit}/hot.json?limit=10`;
    const res = await fetch(baseUrl);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data?.children || [])
      .filter(c => !c.data.stickied)
      .map(c => {
        const d = c.data;
        return {
          id: `reddit_${d.id}`,
          title: d.title,
          url: d.url_overridden_by_dest || `https://reddit.com${d.permalink}`,
          sourceUrl: `https://reddit.com${d.permalink}`,
          source: sourceKey,
          sourceName: SOURCES[sourceKey].name,
          body: d.selftext?.slice(0, 300) || '',
          publishedAt: d.created_utc * 1000,
          redditScore: d.score || 0,
          numComments: d.num_comments || 0,
          upvoteRatio: d.upvote_ratio || 0,
        };
      });
  } catch (e) {
    console.error(`Reddit r/${subreddit} fetch error:`, e);
    return [];
  }
}

// --- CryptoCompare Fetch ---
async function fetchCryptoCompareNews(apiKey) {
  try {
    if (!apiKey) return []; // CryptoCompare requires API key
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseHost = isDev ? '/api/cryptocompare' : 'https://min-api.cryptocompare.com';
    const url = `${baseHost}/data/v2/news/?lang=EN&sortOrder=popular&feeds=coindesk,decrypt,techcrunch,cointelegraph,bitcoinist&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const articles = Array.isArray(data.Data) ? data.Data : [];
    if (articles.length === 0) return [];
    return articles.slice(0, 15).map(item => ({
      id: 'cc_' + item.id,
      title: item.title,
      url: item.url,
      sourceUrl: item.url,
      source: detectSource(item.source_info?.name || item.source),
      sourceName: item.source_info?.name || item.source,
      body: item.body?.slice(0, 300) || '',
      publishedAt: item.published_on * 1000,
      redditScore: 0,
      numComments: 0,
      upvoteRatio: 0,
    }));
  } catch (e) {
    console.error('CryptoCompare fetch error:', e);
    return [];
  }
}

// --- Deduplication ---
function normalizeTitle(title) {
  return (title || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().slice(0, 60);
}

function mergeAndDedup(allItems) {
  const seen = new Map();
  const result = [];
  for (const item of allItems) {
    const norm = normalizeTitle(item.title);
    if (norm.length < 10) continue;
    const key = norm.slice(0, 40);
    if (seen.has(key)) {
      const existing = seen.get(key);
      if (item.redditScore > existing.redditScore) {
        const idx = result.indexOf(existing);
        if (idx !== -1) result[idx] = item;
        seen.set(key, item);
      }
    } else {
      seen.set(key, item);
      result.push(item);
    }
  }
  return result;
}

// --- Engagement Score ---
const SOURCE_PRIORITY = {
  reddit_bitcoin: 20,
  reddit_crypto: 18,
  coindesk: 15,
  decrypt: 12,
  techcrunch: 10,
  other: 0,
};

function calculateEngagement(item) {
  let score = 0;
  if (item.redditScore) score += Math.log10(item.redditScore + 1) * 20;
  if (item.numComments) score += Math.log10(item.numComments + 1) * 15;
  const hoursAgo = (Date.now() - item.publishedAt) / 3600000;
  score += Math.max(0, 50 * Math.exp(-hoursAgo / 4));
  score += SOURCE_PRIORITY[item.source] || 0;
  return score;
}

// --- Quota ---
function applyQuota(sorted) {
  const crypto = sorted.filter(n => n.category === 'crypto').slice(0, 7);
  const aiTech = sorted.filter(n => n.category === 'ai_tech').slice(0, 3);
  return [...crypto, ...aiTech];
}

// --- Trend Icons ---
function assignTrendIcons(items) {
  const total = items.length;
  return items.map((item, i) => ({
    ...item,
    trend: i < Math.ceil(total / 3) ? 'fire' : i < Math.ceil(total * 2 / 3) ? 'trending' : null,
  }));
}

// ======= Main Orchestrator =======
export async function fetchAllNews(cryptocompareKey) {
  const [redditBtc, redditCrypto, ccNews] = await Promise.all([
    fetchRedditSubreddit('Bitcoin', 'reddit_bitcoin'),
    fetchRedditSubreddit('CryptoCurrency', 'reddit_crypto'),
    fetchCryptoCompareNews(cryptocompareKey),
  ]);

  let all = [...redditBtc, ...redditCrypto, ...ccNews];

  // Dedup
  all = mergeAndDedup(all);

  // Borsa Istanbul filter
  all = all.filter(passesBorsaIstanbulFilter);

  // Categorize
  all = all.map(item => ({ ...item, category: detectCategory(item) }));

  // Score and sort
  all = all.map(item => ({ ...item, engagementScore: calculateEngagement(item) }));
  all.sort((a, b) => b.engagementScore - a.engagementScore);

  // Apply quota
  all = applyQuota(all);

  // Assign trend icons
  all = assignTrendIcons(all);

  return all;
}

// --- Storage helpers ---
export function getCryptoCompareKey() {
  return localStorage.getItem(CRYPTOCOMPARE_KEY_STORAGE) || '';
}

export function saveCryptoCompareKey(key) {
  if (key) {
    localStorage.setItem(CRYPTOCOMPARE_KEY_STORAGE, key);
  } else {
    localStorage.removeItem(CRYPTOCOMPARE_KEY_STORAGE);
  }
}
