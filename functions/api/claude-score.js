// Cloudflare Pages Function — Anthropic Claude API proxy
// Client BYOK: api key request body'de gelir, server'da saklanmaz.

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...extra,
    },
  });

export async function onRequestOptions() {
  return json(204, {});
}

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { apiKey, model, system, user, maxTokens = 800 } = body;
  if (!apiKey) return json(400, { error: 'apiKey missing' });
  if (!user) return json(400, { error: 'user prompt missing' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-5',
        max_tokens: maxTokens,
        system: system || '',
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return json(r.status, { error: `Anthropic ${r.status}: ${txt.slice(0, 300)}` });
    }
    const data = await r.json();
    return json(200, data);
  } catch (e) {
    return json(500, { error: e.message });
  }
}
