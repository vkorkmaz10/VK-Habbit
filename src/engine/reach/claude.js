/**
 * Claude API wrapper — opsiyonel AI-augmented checks.
 * Cloudflare Function /api/claude-score üzerinden proxy'lenir (CORS + key güvenliği).
 *
 * Fallback: key yoksa veya hata olursa null döner; UI client-side skoru kullanmaya devam eder.
 */

const CLAUDE_MODEL = 'claude-sonnet-4-5';
const PROXY_URL = '/api/claude-score';

/**
 * AI slop verification + hook quality (6 dimensions) + 3 rewrite suggestions.
 * @param {string} apiKey - Anthropic API key (BYOK)
 * @param {string} tweetText
 * @returns {Promise<{slopScore: number, hookScore: number, hookDimensions: object, rewrites: string[], reasoning: string} | null>}
 */
export async function analyzeWithClaude(apiKey, tweetText) {
  if (!apiKey || !tweetText || tweetText.length < 3) return null;

  const systemPrompt = `Sen X (Twitter) erişim optimizasyonu uzmanısın. Verilen tweet'i analiz et ve SADECE aşağıdaki JSON şemasında yanıt döndür:

{
  "slopScore": 0-100,           // 0 = doğal insan, 100 = tamamen AI üretimi
  "hookScore": 0-100,           // ilk satırın kalitesi
  "hookDimensions": {
    "curiosity": 0-10,          // merak uyandırıyor mu
    "specificity": 0-10,        // somut detay var mı
    "novelty": 0-10,            // taze bakış mı
    "emotion": 0-10,            // duygusal tetikleme
    "clarity": 0-10,            // anlaşılırlık
    "promise": 0-10             // okuyucuya değer vaadi
  },
  "rewrites": ["alt1", "alt2", "alt3"],   // 3 alternatif rewrite (her biri Volkan persona'ya saygılı)
  "reasoning": "kısa açıklama (max 200 char)"
}

Volkan persona: kripto yatırımcısı, dengeli, "bana göre", "arkadaşlar", "haliyle" gibi ifadeler kullanır. Bu ifadeleri SLOP saymazsın.`;

  const userPrompt = `Tweet:\n"""\n${tweetText}\n"""\n\nJSON döndür.`;

  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        model: CLAUDE_MODEL,
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 800,
      }),
    });
    if (!res.ok) {
      console.warn('[Claude] proxy error', res.status);
      return null;
    }
    const data = await res.json();
    const content = data?.content?.[0]?.text || data?.text || '';
    // Strip code fences if present
    const jsonStr = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn('[Claude] analyze failed', e.message);
    return null;
  }
}

/**
 * Auto-Optimize: 5 rounds of iterative rewriting, returns best version by score.
 * @param {string} apiKey
 * @param {string} originalText
 * @param {function} scoreFn - scoreTweet from index.js
 * @param {object} opts - { rounds?: number, persona?: string }
 * @returns {Promise<{best: string, score: number, history: Array} | null>}
 */
export async function autoOptimize(apiKey, originalText, scoreFn, opts = {}) {
  if (!apiKey) return null;
  const rounds = opts.rounds || 3;
  let current = originalText;
  let best = { text: originalText, score: scoreFn(originalText).reachScore };
  const history = [{ text: originalText, score: best.score, round: 0 }];

  for (let i = 1; i <= rounds; i++) {
    const analysis = await analyzeWithClaude(apiKey, current);
    if (!analysis?.rewrites?.length) break;
    let roundBest = best;
    for (const rewrite of analysis.rewrites) {
      const s = scoreFn(rewrite).reachScore;
      history.push({ text: rewrite, score: s, round: i });
      if (s > roundBest.score) roundBest = { text: rewrite, score: s };
    }
    if (roundBest.score > best.score) best = roundBest;
    current = roundBest.text;
    if (best.score >= 90) break; // good enough
  }
  return { best: best.text, score: best.score, history };
}
