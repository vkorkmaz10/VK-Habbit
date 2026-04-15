// Vercel Serverless Function — CryptoPanic via Discord Bot API
// Token & Channel ID come from process.env — never from the frontend.
//
// Required env vars (Vercel Dashboard → Settings → Environment Variables):
//   DISCORD_BOT_TOKEN  — Discord bot token (Bot → Reset Token)
//   DISCORD_CHANNEL_ID — Channel ID (Developer Mode → right-click channel → Copy ID)

const AI_KEYWORDS = [
  'artificial intelligence', ' ai ', 'machine learning', 'gpt', 'llm',
  'openai', 'anthropic', 'neural', 'chatbot', 'generative', 'claude', 'gemini',
  'deep learning', 'automation', 'transformer', 'copilot', 'midjourney',
  'stable diffusion', 'robotics',
];

function isAiTech(title) {
  const t = (title || '').toLowerCase();
  return AI_KEYWORDS.some(kw => t.includes(kw));
}

// Parse sentiment from emoji / keywords in message text
function parseSentiment(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('🐂') || t.includes('bullish')) return 'bullish';
  if (t.includes('🐻') || t.includes('bearish')) return 'bearish';
  return 'neutral';
}

// Parse a single Discord message into a news item.
// Strategy: embed fields first (stable), then content regex fallback.
function parseDiscordMessage(msg, index) {
  const embed = msg.embeds?.[0];
  const rawText = embed?.description || msg.content || '';

  let title = '';
  let url = '';
  let sourceName = 'CryptoPanic';
  let publishedAt = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now();

  if (embed?.title && embed?.url) {
    // Embed path — most stable
    title = embed.title;
    url = embed.url;
    sourceName = embed.footer?.text || embed.author?.name || 'CryptoPanic';
  } else {
    // Regex fallback on message content
    const titleMatch = (msg.content || '').match(/\*\*(.+?)\*\*/);
    const urlMatch = (msg.content || '').match(/https:\/\/cryptopanic\.com\/news\/\S+/);
    title = titleMatch ? titleMatch[1] : '';
    url = urlMatch ? urlMatch[0] : '#';

    // Try to extract source from last non-empty line
    const lines = (msg.content || '').split('\n').map(l => l.trim()).filter(Boolean);
    const lastLine = lines[lines.length - 1] || '';
    // Source lines look like "🔸 CoinDesk | 2 hours ago"
    const srcMatch = lastLine.match(/[^\w]*([A-Za-z0-9 ]+?)\s*\|/);
    if (srcMatch) sourceName = srcMatch[1].trim();
  }

  if (!title) return null; // Skip unparseable messages

  const sentiment = parseSentiment(rawText + ' ' + (msg.content || ''));

  return {
    id: `cp_${index}_${msg.id || Date.now()}`,
    title,
    url,
    sourceUrl: url,
    sourceName,
    publishedAt,
    category: isAiTech(title) ? 'ai_tech' : 'crypto',
    sentiment,
  };
}

export default async function handler(req, res) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channel = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channel) {
    return res.status(503).json({
      error: 'Discord credentials not configured. Set DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID in Vercel environment variables.',
    });
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channel}/messages?limit=15`,
      {
        headers: {
          Authorization: `Bot ${token}`,
          'User-Agent': 'VKGymBot (vkgym, 1.0)',
        },
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Discord API ${response.status}: ${body}`);
    }

    const messages = await response.json();
    const items = messages
      .map((msg, i) => parseDiscordMessage(msg, i))
      .filter(Boolean); // drop nulls (unparseable messages)

    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
