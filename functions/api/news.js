// Cloudflare Pages Function — Multi-source RSS News Aggregator
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
const isAiTech = (t) => AI_KEYWORDS.some(k => (t || '').toLowerCase().includes(k));

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

const json = (status, body, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300', // 5 dk edge cache
      ...extraHeaders,
    },
  });

export async function onRequestGet() {
  try {
    const now = Date.now();
    const results = await Promise.allSettled(
      RSS_SOURCES.map(async (src) => {
        const r = await fetch(src.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VKGymBot/1.0)' },
        });
        if (!r.ok) return [];
        return parseRssXml(await r.text(), src.name, src.forceCategory);
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

    return json(200, { items });
  } catch (e) {
    return json(500, { error: e.message });
  }
}
