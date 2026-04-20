// Netlify Function — Multi-source RSS News Aggregator
// No API keys needed — uses public RSS feeds

const RSS_SOURCES = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk', forceCategory: null },
  { url: 'https://cointelegraph.com/rss', name: 'CoinTelegraph', forceCategory: null },
  { url: 'https://decrypt.co/feed', name: 'Decrypt', forceCategory: null },
  { url: 'https://www.theblock.co/rss.xml', name: 'TheBlock', forceCategory: null },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch AI', forceCategory: 'ai_tech' },
  { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: 'The Verge AI', forceCategory: 'ai_tech' },
  { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', name: 'Ars Technica', forceCategory: 'ai_tech' },
];

const AI_KEYWORDS = [
  'artificial intelligence', ' ai ', ' ai,', 'machine learning', 'deep learning',
  'gpt', 'llm', 'openai', 'anthropic', 'neural', 'automation',
  'chatbot', 'generative', 'transformer', 'copilot', 'gemini',
  'claude', 'midjourney', 'stable diffusion', 'robotics',
  'nvidia', 'gpu', 'apple intelligence', 'siri', 'alexa',
  'hugging face', 'meta ai', 'google ai', 'microsoft ai',
  'chatgpt', 'dall-e', 'sora', 'perplexity', 'mistral',
];

function isAiTech(title) {
  const t = (title || '').toLowerCase();
  return AI_KEYWORDS.some(kw => t.includes(kw));
}

function parseRssXml(xml, sourceName, forceCategory) {
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
        category: forceCategory || (isAiTech(title) ? 'ai_tech' : 'crypto'),
      });
    }
  }
  return items;
}

let cache = { items: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000;

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' });
  }

  try {
    const now = Date.now();
    if (cache.items && (now - cache.timestamp < CACHE_TTL)) {
      return json(200, { items: cache.items });
    }

    const results = await Promise.allSettled(
      RSS_SOURCES.map(async (src) => {
        const response = await fetch(src.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VKGymBot/1.0)' },
        });
        if (!response.ok) return [];
        const xml = await response.text();
        return parseRssXml(xml, src.name, src.forceCategory);
      })
    );

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

    items.sort((a, b) => b.publishedAt - a.publishedAt);
    items = items.slice(0, 35);
    cache = { items, timestamp: now };

    return json(200, { items });
  } catch (e) {
    console.error('RSS fetch error:', e);
    return json(500, { error: e.message });
  }
};
