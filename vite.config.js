import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Custom plugin: proxies /api/chat and /api/fetch-url to Anthropic & URL scraper
function anthropicProxy() {
  let apiKey = '';
  return {
    name: 'anthropic-proxy',
    configResolved(config) {
      apiKey = loadEnv(config.mode, config.root, '')['ANTHROPIC_API_KEY'] || '';
    },
    configureServer(server) {
      // /api/chat → Anthropic Messages API
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString());

        try {
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
              system: body.system || '',
              messages: body.messages || [],
            }),
          });
          const data = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(data);
        } catch (e) {
          res.statusCode = 500;
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
          // Extract text content: strip tags, collapse whitespace
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
export default defineConfig({
  server: {
    proxy: {
      '/api/reddit': {
        target: 'https://www.reddit.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/reddit/, ''),
      },
      '/api/cryptocompare': {
        target: 'https://min-api.cryptocompare.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cryptocompare/, ''),
      },
    },
  },
  plugins: [
    anthropicProxy(),
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
})
