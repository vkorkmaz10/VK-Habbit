// Netlify Function — CryptoCompare News API
// Required env var (Netlify Dashboard → Site settings → Environment variables):
//   CRYPTOCOMPARE_API_KEY

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

function normalizeSentiment(val) {
  if (!val) return 'neutral';
  const v = val.toLowerCase();
  if (v === 'positive') return 'positive';
  if (v === 'negative') return 'negative';
  return 'neutral';
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  const apiKey = event.queryStringParameters?.key || process.env.CRYPTOCOMPARE_API_KEY;

  if (!apiKey) {
    return json(503, {
      error: 'CRYPTOCOMPARE_API_KEY not configured. Set it in Netlify environment variables.',
    });
  }

  try {
    const response = await fetch(
      `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${apiKey}`,
      { headers: { 'User-Agent': 'VKGymBot (vkgym, 1.0)' } }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`CryptoCompare API ${response.status}: ${body}`);
    }

    const data = await response.json();
    const articles = data.Data || [];

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

    return json(200, { items });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
