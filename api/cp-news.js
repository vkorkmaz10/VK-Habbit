// Vercel Serverless Function — CryptoCompare News API
// Docs: https://min-api.cryptocompare.com/documentation?key=News&cat=latestNewsArticles
//
// Required env var (Vercel Dashboard → Settings → Environment Variables):
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

// Normalize CryptoCompare sentiment values to lowercase
function normalizeSentiment(val) {
  if (!val) return 'neutral';
  const v = val.toLowerCase();
  if (v === 'positive') return 'positive';
  if (v === 'negative') return 'negative';
  return 'neutral';
}

export default async function handler(req, res) {
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: 'CRYPTOCOMPARE_API_KEY not configured. Set it in Vercel environment variables.',
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

    const json = await response.json();
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

    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
