// Cloudflare Pages Function — CryptoCompare News API
// Required env var (Cloudflare Dashboard → Settings → Environment variables):
//   CRYPTOCOMPARE_API_KEY

const AI_KEYWORDS = [
  'artificial intelligence', ' ai ', 'machine learning', 'deep learning',
  'gpt', 'llm', 'openai', 'anthropic', 'neural', 'automation',
  'chatbot', 'generative', 'transformer', 'copilot', 'gemini',
  'claude', 'midjourney', 'stable diffusion', 'robotics',
];
const isAiTech = (t) => AI_KEYWORDS.some(k => (t || '').toLowerCase().includes(k));
const normalizeSentiment = (v) => {
  if (!v) return 'neutral';
  const x = v.toLowerCase();
  return x === 'positive' ? 'positive' : x === 'negative' ? 'negative' : 'neutral';
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const apiKey = url.searchParams.get('key') || env.CRYPTOCOMPARE_API_KEY;

  if (!apiKey) {
    return json(503, {
      error: 'CRYPTOCOMPARE_API_KEY not configured. Set it in Cloudflare environment variables.',
    });
  }

  try {
    const r = await fetch(
      `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${apiKey}`,
      { headers: { 'User-Agent': 'VKGymBot (vkgym, 1.0)' } }
    );
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`CryptoCompare ${r.status}: ${body}`);
    }
    const data = await r.json();
    const items = (data.Data || []).slice(0, 20).map(n => ({
      id: `cc_${n.id}`,
      title: n.title || '',
      url: n.url || '#',
      sourceUrl: n.url || '#',
      sourceName: n.source_info?.name || n.source || 'CryptoCompare',
      publishedAt: n.published_on ? n.published_on * 1000 : Date.now(),
      category: isAiTech(n.title) ? 'ai_tech' : 'crypto',
      sentiment: normalizeSentiment(n.sentiment),
    }));
    return json(200, { items });
  } catch (e) {
    return json(500, { error: e.message });
  }
}
