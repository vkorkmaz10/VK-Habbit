import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import RSSParser from 'rss-parser';

const rssParser = new RSSParser();

// AI/Tech keywords for pivot strategy — prioritize these
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

// Multi-source RSS feeds — no API keys needed
const RSS_SOURCES = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk' },
  { url: 'https://cointelegraph.com/rss', name: 'CoinTelegraph' },
  { url: 'https://decrypt.co/feed', name: 'Decrypt' },
  { url: 'https://www.theblock.co/rss.xml', name: 'TheBlock' },
];

// In-memory cache for RSS results (5 min TTL)
let rssCache = { items: null, timestamp: 0 };
const RSS_CACHE_TTL = 5 * 60 * 1000;

// Custom Vite plugin for all API middleware
function apiMiddleware(env = {}) {
  return {
    name: 'api-middleware',
    configureServer(server) {

      // /api/news — Multi-source crypto RSS → JSON (no API key needed)
      server.middlewares.use('/api/news', async (req, res) => {
        try {
          // Return cached if fresh
          const now = Date.now();
          if (rssCache.items && (now - rssCache.timestamp < RSS_CACHE_TTL)) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ items: rssCache.items }));
            return;
          }

          // Fetch all feeds in parallel
          const feedResults = await Promise.allSettled(
            RSS_SOURCES.map(async (src) => {
              const rssRes = await fetch(src.url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LifeOSBot/1.0)' },
              });
              if (!rssRes.ok) return [];
              const xml = await rssRes.text();
              const feed = await rssParser.parseString(xml);
              return (feed.items || []).slice(0, 10).map(item => ({
                title: item.title || '',
                url: item.link || '#',
                sourceUrl: item.link || '#',
                sourceName: src.name,
                publishedAt: item.isoDate ? new Date(item.isoDate).getTime() : Date.now(),
                category: isAiTech(item.title) ? 'ai_tech' : 'crypto',
              }));
            })
          );

          // Merge, deduplicate by title, sort
          const seen = new Set();
          let items = [];
          for (const result of feedResults) {
            if (result.status === 'fulfilled') {
              for (const item of result.value) {
                const key = item.title.toLowerCase().trim();
                if (!seen.has(key)) {
                  seen.add(key);
                  items.push({ ...item, id: `rss_${items.length}_${Date.now()}` });
                }
              }
            }
          }

          // Sort by date only (newest first)
          items.sort((a, b) => b.publishedAt - a.publishedAt);

          items = items.slice(0, 35);

          // Cache
          rssCache = { items, timestamp: Date.now() };

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ items }));
        } catch (e) {
          console.error('RSS parse error:', e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      // /api/cp-news — CryptoCompare News API
      // Reads CRYPTOCOMPARE_API_KEY from .env (no VITE_ prefix — stays server-side)
      let ccCache = { items: null, timestamp: 0 };

      function normalizeSentiment(val) {
        if (!val) return 'neutral';
        const v = val.toLowerCase();
        if (v === 'positive') return 'positive';
        if (v === 'negative') return 'negative';
        return 'neutral';
      }

      server.middlewares.use('/api/cp-news', async (req, res) => {
        const urlParams = new URL(req.url, 'http://localhost').searchParams;
        const clientKey = urlParams.get('key');
        const apiKey = clientKey || env.CRYPTOCOMPARE_API_KEY || process.env.CRYPTOCOMPARE_API_KEY;

        if (!apiKey) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'CRYPTOCOMPARE_API_KEY must be set in .env' }));
          return;
        }

        try {
          const now = Date.now();
          if (ccCache.items && (now - ccCache.timestamp < RSS_CACHE_TTL)) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ items: ccCache.items }));
            return;
          }

          const apiRes = await fetch(
            `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${apiKey}`,
            { headers: { 'User-Agent': 'LifeOSBot (lifeos, 1.0)' } }
          );
          if (!apiRes.ok) throw new Error(`CryptoCompare API ${apiRes.status}`);
          const json = await apiRes.json();
          const articles = json.Data || [];

          const items = articles.slice(0, 20).map((news) => ({
            id: `cc_${news.id}`,
            title: news.title || '',
            url: news.url || '#',
            sourceUrl: news.url || '#',
            sourceName: news.source_info?.name || news.source || 'CryptoCompare',
            publishedAt: news.published_on ? news.published_on * 1000 : Date.now(),
            category: isAiTech(news.title) ? 'ai_tech' : 'crypto',
            sentiment: normalizeSentiment(news.sentiment),
          }));

          ccCache = { items, timestamp: Date.now() };
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ items }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      // /api/x-followers → Livecounts.io proxy (X follower count)
      // Mirrors functions/api/x-followers.js for parity in dev
      let xfCache = { data: null, timestamp: 0 };
      const XF_TTL = 15 * 1000;
      server.middlewares.use('/api/x-followers', async (req, res) => {
        try {
          const u = new URL(req.url, 'http://localhost');
          const user = (u.searchParams.get('user') || 'vkorkmaz10').replace(/[^a-zA-Z0-9_]/g, '');
          const now = Date.now();
          if (xfCache.data && xfCache.data.user === user && (now - xfCache.timestamp < XF_TTL)) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(xfCache.data));
            return;
          }
          const r = await fetch(`https://api.livecounts.io/twitter-live-follower-counter/stats/${user}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Origin': 'https://livecounts.io',
              'Referer': 'https://livecounts.io/',
              'Accept': 'application/json, text/plain, */*',
            },
          });
          if (!r.ok) {
            res.statusCode = r.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `upstream ${r.status}`, user }));
            return;
          }
          const data = await r.json();
          if (typeof data.followerCount !== 'number') {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'unexpected upstream shape', user }));
            return;
          }
          const payload = { user, followerCount: data.followerCount, cached: !!data.cache, ts: now };
          xfCache = { data: payload, timestamp: now };
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(payload));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      // /api/fetch-url → URL content scraper
      server.middlewares.use('/api/fetch-url', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const { url } = JSON.parse(Buffer.concat(chunks).toString());

        try {
          const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LifeOSBot/1.0)' },
          });
          const html = await response.text();
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 3000);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ text }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL .env vars (no prefix filter) — these stay server-side, never in client bundle
  const env = loadEnv(mode, process.cwd(), '');

  return {
  plugins: [
    apiMiddleware(env),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png'],
      manifest: {
        name: 'LifeOS',
        short_name: 'LifeOS',
        description: 'Personal productivity & life operating system',
        theme_color: '#121826',
        background_color: '#121826',
        display: "standalone",
        icons: [
          {
            src: 'icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  };
})
