// Cloudflare Pages Function — Claude API Proxy
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestPost({ request, env }) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { system, messages } = await request.json();
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
        system: system || '',
        messages: messages || [],
      }),
    });
    const data = await upstream.json();
    return json(upstream.ok ? 200 : upstream.status, data);
  } catch (e) {
    return json(500, { error: e.message });
  }
}
