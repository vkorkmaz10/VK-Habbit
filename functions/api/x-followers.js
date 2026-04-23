// Cloudflare Pages Function — X (Twitter) follower count proxy
// Livecounts.io API requires Origin/Referer headers; impossible from browser due to CORS.
// This function proxies the request server-side and adds permissive CORS for the SPA.

const DEFAULT_USER = 'vkorkmaz10';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const json = (status, body, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      // 15 sn edge cache → 3 sn polling büyük ölçüde cache'ten karşılanır
      'Cache-Control': 'public, max-age=15, s-maxage=15',
      ...extraHeaders,
    },
  });

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const user = (url.searchParams.get('user') || DEFAULT_USER).replace(/[^a-zA-Z0-9_]/g, '');
    if (!user) return json(400, { error: 'invalid user' });

    const upstream = `https://api.livecounts.io/twitter-live-follower-counter/stats/${user}`;
    const r = await fetch(upstream, {
      headers: {
        'User-Agent': UA,
        'Origin': 'https://livecounts.io',
        'Referer': 'https://livecounts.io/',
        'Accept': 'application/json, text/plain, */*',
      },
      // Cloudflare edge cache hint
      cf: { cacheTtl: 15, cacheEverything: true },
    });

    if (!r.ok) {
      return json(r.status, { error: `upstream ${r.status}`, user });
    }

    const data = await r.json();
    if (typeof data.followerCount !== 'number') {
      return json(502, { error: 'unexpected upstream shape', user });
    }

    return json(200, {
      user,
      followerCount: data.followerCount,
      cached: !!data.cache,
      ts: Date.now(),
    });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
}
