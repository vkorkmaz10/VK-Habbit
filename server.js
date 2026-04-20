// Render.com Web Service — Express server
// Serves built SPA (dist/) + /api/* endpoints (ported from Netlify Functions)

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// ---------- /api/cp-news ----------
const AI_KEYWORDS_CC = [
  'artificial intelligence', ' ai ', 'machine learning', 'deep learning',
  'gpt', 'llm', 'openai', 'anthropic', 'neural', 'automation',
  'chatbot', 'generative', 'transformer', 'copilot', 'gemini',
  'claude', 'midjourney', 'stable diffusion', 'robotics',
];
const isAiTechCC = (t) => AI_KEYWORDS_CC.some(k => (t || '').toLowerCase().includes(k));
const normalizeSentiment = (v) => {
  if (!v) return 'neutral';
  const x = v.toLowerCase();
  return x === 'positive' ? 'positive' : x === 'negative' ? 'negative' : 'neutral';
};

app.get('/api/cp-news', async (req, res) => {
  const apiKey = req.query.key || process.env.CRYPTOCOMPARE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'CRYPTOCOMPARE_API_KEY not configured.' });
  }
  try {
    const r = await fetch(
      `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${apiKey}`,
      { headers: { 'User-Agent': 'VKGymBot (vkgym, 1.0)' } }
    );
    if (!r.ok) throw new Error(`CryptoCompare ${r.status}: ${await r.text().catch(() => '')}`);
    const json = await r.json();
    const items = (json.Data || []).slice(0, 20).map(n => ({
      id: `cc_${n.id}`,
      title: n.title || '',
      url: n.url || '#',
      sourceUrl: n.url || '#',
      sourceName: n.source_info?.name || n.source || 'CryptoCompare',
      publishedAt: n.published_on ? n.published_on * 1000 : Date.now(),
      category: isAiTechCC(n.title) ? 'ai_tech' : 'crypto',
      sentiment: normalizeSentiment(n.sentiment),
    }));
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- /api/news ----------
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

let newsCache = { items: null, timestamp: 0 };
const NEWS_CACHE_TTL = 5 * 60 * 1000;

app.get('/api/news', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const now = Date.now();
    if (newsCache.items && now - newsCache.timestamp < NEWS_CACHE_TTL) {
      return res.json({ items: newsCache.items });
    }
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
    newsCache = { items, timestamp: now };
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- /api/fetch-url ----------
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

function isBlockedResponse(html, status) {
  if (status === 403 || status === 429) return true;
  if (!html || html.length < 500) return true;
  const lower = html.toLowerCase();
  return (
    lower.includes('cf-browser-verification') ||
    lower.includes('just a moment') ||
    lower.includes('enable javascript and cookies') ||
    lower.includes('checking your browser') ||
    lower.includes('ddos-guard') ||
    lower.includes('access denied') ||
    lower.includes('403 forbidden') ||
    lower.includes('bot detection') ||
    (lower.includes('cloudflare') && lower.includes('ray id'))
  );
}

function extractText(html) {
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const TRAILING_CUTOFFS = [
    /Coin Prices[\s\S]*$/i, /Trending (?:Coins|Tokens|News|Stories)[\s\S]*$/i,
    /Market (?:Data|Cap|Overview|Highlights)[\s\S]*$/i,
    /Top (?:Coins|Cryptocurrencies|Assets|Stories)[\s\S]*$/i,
    /Price Ticker[\s\S]*$/i, /Newsletter[\s\S]*$/i,
    /Subscribe (?:to|for|now)[\s\S]*$/i, /Sign up (?:for|to)[\s\S]*$/i,
    /Related (?:Articles|Stories|News|Posts|Coverage)[\s\S]*$/i,
    /Recommended (?:Articles|Stories|For You)[\s\S]*$/i,
    /Popular (?:Stories|Articles|News)[\s\S]*$/i,
    /More (?:Stories|Articles|News|From)[\s\S]*$/i,
    /Read (?:More|Next|Also)[\s\S]*$/i, /Don't Miss[\s\S]*$/i,
    /You (?:May|Might) (?:Also )?Like[\s\S]*$/i,
    /Advertisement[\s\S]*$/i, /Sponsored (?:Content|Post)[\s\S]*$/i,
    /About (?:the )?Author[\s\S]*$/i, /Share (?:this|article)[\s\S]*$/i,
    /Tags:[\s\S]*$/i, /Disclaimer[\s\S]*$/i,
    /(?:Latest|Breaking|Top) (?:News|Headlines|Stories)[\s\S]*$/i,
    /Stay (?:up to date|informed|connected)[\s\S]*$/i,
    /Join (?:our|the) (?:community|newsletter|telegram)[\s\S]*$/i,
    /Follow us on[\s\S]*$/i, /Get the (?:latest|best|top)[\s\S]*$/i,
    /©\s*\d{4}[\s\S]*$/i, /All Rights Reserved[\s\S]*$/i,
  ];

  const INLINE_JUNK = [
    /\b(?:BTC|ETH|XRP|BNB|SOL|DOGE|ADA|AVAX|SHIB|LINK|DOT|MATIC|UNI|ATOM|FIL|APT|ARB|OP|NEAR|FTM|ALGO|MANA|SAND|AXS|ICP|LDO|CRV|MKR|AAVE|SNX|COMP|SUSHI|YFI|BAL|UMA|REN|KNC|ZRX|USDT|USDC|USDS|BUSD|DAI|TUSD|PYUSD|WBT|HYPE|LEO|BCH|XMR|ZEC|LTC|TRX|HBAR|SUI|TAO)\s*\$[\d,.]+\s*-?[\d.]+%/g,
    /\$[\d,]+\.[\d]+\s+[+-]?[\d.]+%\s*/g,
    /(?:We use cookies|This (?:site|website) uses cookies|Cookie (?:Policy|Settings|Consent))[\s\S]{0,500}(?:Accept|Got it|I agree|OK|Manage)/gi,
  ];

  let text = cleaned;
  for (const p of TRAILING_CUTOFFS) text = text.replace(p, '');
  for (const p of INLINE_JUNK) text = text.replace(p, '');
  return text.replace(/\s{3,}/g, ' ').trim().slice(0, 4000);
}

async function fetchDirect(url) {
  const r = await fetch(url, { headers: BROWSER_HEADERS });
  const html = await r.text();
  if (isBlockedResponse(html, r.status)) return null;
  const text = extractText(html);
  return text.length > 200 ? text : null;
}

async function fetchViaJina(url) {
  const r = await fetch(`https://r.jina.ai/${url}`, {
    headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' },
  });
  if (!r.ok) return null;
  const text = await r.text();
  return text && text.length > 200 ? text.slice(0, 4000) : null;
}

app.post('/api/fetch-url', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    const direct = await fetchDirect(url);
    if (direct) return res.json({ text: direct, method: 'direct', blocked: false });
    const jina = await fetchViaJina(url);
    if (jina) return res.json({ text: jina, method: 'jina', blocked: false });
    res.json({ text: null, method: null, blocked: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- /api/chat ----------
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  try {
    const { system, messages } = req.body || {};
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: system || '',
        messages: messages || [],
      }),
    });
    const data = await upstream.json();
    res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Static SPA + fallback ----------
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA fallback — non-/api unknown routes serve index.html
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`VK-Habbit server listening on :${PORT}`);
});
