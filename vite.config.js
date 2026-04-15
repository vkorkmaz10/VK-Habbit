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
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VKGymBot/1.0)' },
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

      // /api/cp-news — CryptoPanic via Discord Bot API
      // Reads DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID from .env (no VITE_ prefix — stays server-side)
      let cpCache = { items: null, timestamp: 0 };

      function parseCPSentiment(text) {
        const t = (text || '').toLowerCase();
        if (t.includes('🐂') || t.includes('bullish')) return 'bullish';
        if (t.includes('🐻') || t.includes('bearish')) return 'bearish';
        return 'neutral';
      }

      function parseDiscordMsg(msg, index) {
        const embed = msg.embeds?.[0];
        const rawText = embed?.description || msg.content || '';
        let title = '', url = '', sourceName = 'CryptoPanic';
        const publishedAt = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now();

        if (embed?.title && embed?.url) {
          title = embed.title;
          url = embed.url;
          sourceName = embed.footer?.text || embed.author?.name || 'CryptoPanic';
        } else {
          const titleMatch = (msg.content || '').match(/\*\*(.+?)\*\*/);
          const urlMatch = (msg.content || '').match(/https:\/\/cryptopanic\.com\/news\/\S+/);
          title = titleMatch ? titleMatch[1] : '';
          url = urlMatch ? urlMatch[0] : '#';
          const lines = (msg.content || '').split('\n').map(l => l.trim()).filter(Boolean);
          const srcMatch = (lines[lines.length - 1] || '').match(/[^\w]*([A-Za-z0-9 ]+?)\s*\|/);
          if (srcMatch) sourceName = srcMatch[1].trim();
        }

        if (!title) return null;

        return {
          id: `cp_${index}_${msg.id || Date.now()}`,
          title, url, sourceUrl: url, sourceName, publishedAt,
          category: isAiTech(title) ? 'ai_tech' : 'crypto',
          sentiment: parseCPSentiment(rawText + ' ' + (msg.content || '')),
        };
      }

      server.middlewares.use('/api/cp-news', async (req, res) => {
        const discordToken = env.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
        const channelId = env.DISCORD_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID;

        if (!discordToken || !channelId) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID must be set in .env' }));
          return;
        }

        try {
          const now = Date.now();
          if (cpCache.items && (now - cpCache.timestamp < RSS_CACHE_TTL)) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ items: cpCache.items }));
            return;
          }

          const apiRes = await fetch(
            `https://discord.com/api/v10/channels/${channelId}/messages?limit=15`,
            { headers: { Authorization: `Bot ${discordToken}`, 'User-Agent': 'VKGymBot (vkgym, 1.0)' } }
          );
          if (!apiRes.ok) throw new Error(`Discord API ${apiRes.status}`);
          const messages = await apiRes.json();
          const items = messages.map((m, i) => parseDiscordMsg(m, i)).filter(Boolean);

          cpCache = { items, timestamp: Date.now() };
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ items }));
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
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VKGymBot/1.0)' },
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
        name: 'VK10GYM Fitness Tracker',
        short_name: 'VK10GYM',
        description: 'An 8-week fitness tracking PWA',
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
