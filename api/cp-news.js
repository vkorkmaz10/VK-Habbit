// Vercel Serverless Function — CryptoPanic JSON API (free tier, requires token)
const AI_KEYWORDS = [
  'artificial intelligence', ' ai ', 'machine learning', 'gpt', 'llm',
  'openai', 'anthropic', 'neural', 'chatbot', 'generative', 'claude', 'gemini',
];

function isAiTech(title) {
  const t = (title || '').toLowerCase();
  return AI_KEYWORDS.some(kw => t.includes(kw));
}

export default async function handler(req, res) {
  const token = req.query?.token || new URL(req.url, 'http://localhost').searchParams.get('token');
  if (!token) {
    return res.status(400).json({ error: 'token required' });
  }

  try {
    const response = await fetch(
      `https://cryptopanic.com/api/free/v1/posts/?auth_token=${token}&public=true&limit=15`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VKGymBot/1.0)' } }
    );
    if (!response.ok) throw new Error(`CryptoPanic API ${response.status}`);
    const json = await response.json();
    const items = (json.results || []).map((post, i) => ({
      id: `cp_${i}_${Date.now()}`,
      title: post.title || '',
      url: post.url || '#',
      sourceUrl: post.url || '#',
      sourceName: post.source?.title || 'CryptoPanic',
      publishedAt: post.published_at ? new Date(post.published_at).getTime() : Date.now(),
      category: isAiTech(post.title) ? 'ai_tech' : 'crypto',
    }));
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
