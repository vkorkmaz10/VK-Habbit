// Vercel Serverless Function — Multi-source RSS News Aggregator
// No API keys needed — uses public RSS feeds

const RSS_SOURCES = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk' },
  { url: 'https://cointelegraph.com/rss', name: 'CoinTelegraph' },
  { url: 'https://decrypt.co/feed', name: 'Decrypt' },
  { url: 'https://www.theblock.co/rss.xml', name: 'TheBlock' },
];

const AI_KEYWORDS = [
  'artificial intelligence', ' ai ', 'machine learning', 'deep learning',
  'gpt', 'llm', 'openai', 'anthropic', 'neural', 'automation',
  'chatbot', 'generative', 'transformer', 'copilot', 'gemini',
  'claude', 'midjourney', 'stable diffusion', 'robotics',
];

function isAiTech(title) {
  const t = (title || '').toLowerCase();
  return AI_KEYWORDS.some(kw => t.includes(kw));
}

// Simple XML RSS parser — no dependencies needed
function parseRssXml(xml, sourceName) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
    const block = match[1];
    const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
    const link = (block.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/) || [])[1] || '#';
    const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';

    if (title) {
      items.push({
        title: title.trim(),
        url: link.trim(),
        sourceUrl: link.trim(),
        sourceName,
        publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
        category: isAiTech(title) ? 'ai_tech' : 'crypto',
      });
    }
  }
  return items;
}

// In-memory cache (persists across warm invocations)
let cache = { items: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Return cached if fresh
    const now = Date.now();
    if (cache.items && (now - cache.timestamp < CACHE_TTL)) {
      return res.status(200).json({ items: cache.items });
    }

    // Fetch all feeds in parallel
    const results = await Promise.allSettled(
      RSS_SOURCES.map(async (src) => {
        const response = await fetch(src.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VKGymBot/1.0)' },
        });
        if (!response.ok) return [];
        const xml = await response.text();
        return parseRssXml(xml, src.name);
      })
    );

    // Merge and deduplicate
    const seen = new Set();
    let items = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const item of result.value) {
          const key = item.title.toLowerCase().trim();
          if (!seen.has(key)) {
            seen.add(key);
            items.push({ ...item, id: `rss_${items.length}_${now}` });
          }
        }
      }
    }

    // Sort: Crypto first, then AI/Tech, within each group by date (newest first)
    items.sort((a, b) => {
      if (a.category === 'crypto' && b.category !== 'crypto') return -1;
      if (b.category === 'crypto' && a.category !== 'crypto') return 1;
      return b.publishedAt - a.publishedAt;
    });

    items = items.slice(0, 25);
    cache = { items, timestamp: now };

    return res.status(200).json({ items });
  } catch (e) {
    console.error('RSS fetch error:', e);
    return res.status(500).json({ error: e.message });
  }
}
