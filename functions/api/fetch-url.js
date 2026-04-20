// Cloudflare Pages Function — URL Content Scraper
// Strategy: direct fetch → Jina AI reader fallback → blocked

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

function isBlockedResponse(html, status) {
  if (status === 403 || status === 429) return true;
  if (!html || html.length < 500) return true;
  const lower = html.toLowerCase();
  return (
    lower.includes('cf-browser-verification') ||
    lower.includes('just a moment') ||
    lower.includes('enable javascript and cookies') ||
    lower.includes('checking your browser') ||
    lower.includes('ddos-guard') ||
    lower.includes('access denied') ||
    lower.includes('403 forbidden') ||
    lower.includes('bot detection') ||
    (lower.includes('cloudflare') && lower.includes('ray id'))
  );
}

function extractText(html) {
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const TRAILING_CUTOFFS = [
    /Coin Prices[\s\S]*$/i, /Trending (?:Coins|Tokens|News|Stories)[\s\S]*$/i,
    /Market (?:Data|Cap|Overview|Highlights)[\s\S]*$/i,
    /Top (?:Coins|Cryptocurrencies|Assets|Stories)[\s\S]*$/i,
    /Price Ticker[\s\S]*$/i, /Newsletter[\s\S]*$/i,
    /Subscribe (?:to|for|now)[\s\S]*$/i, /Sign up (?:for|to)[\s\S]*$/i,
    /Related (?:Articles|Stories|News|Posts|Coverage)[\s\S]*$/i,
    /Recommended (?:Articles|Stories|For You)[\s\S]*$/i,
    /Popular (?:Stories|Articles|News)[\s\S]*$/i,
    /More (?:Stories|Articles|News|From)[\s\S]*$/i,
    /Read (?:More|Next|Also)[\s\S]*$/i, /Don't Miss[\s\S]*$/i,
    /You (?:May|Might) (?:Also )?Like[\s\S]*$/i,
    /Advertisement[\s\S]*$/i, /Sponsored (?:Content|Post)[\s\S]*$/i,
    /About (?:the )?Author[\s\S]*$/i, /Share (?:this|article)[\s\S]*$/i,
    /Tags:[\s\S]*$/i, /Disclaimer[\s\S]*$/i,
    /(?:Latest|Breaking|Top) (?:News|Headlines|Stories)[\s\S]*$/i,
    /Stay (?:up to date|informed|connected)[\s\S]*$/i,
    /Join (?:our|the) (?:community|newsletter|telegram)[\s\S]*$/i,
    /Follow us on[\s\S]*$/i, /Get the (?:latest|best|top)[\s\S]*$/i,
    /©\s*\d{4}[\s\S]*$/i, /All Rights Reserved[\s\S]*$/i,
  ];

  const INLINE_JUNK = [
    /\b(?:BTC|ETH|XRP|BNB|SOL|DOGE|ADA|AVAX|SHIB|LINK|DOT|MATIC|UNI|ATOM|FIL|APT|ARB|OP|NEAR|FTM|ALGO|MANA|SAND|AXS|ICP|LDO|CRV|MKR|AAVE|SNX|COMP|SUSHI|YFI|BAL|UMA|REN|KNC|ZRX|USDT|USDC|USDS|BUSD|DAI|TUSD|PYUSD|WBT|HYPE|LEO|BCH|XMR|ZEC|LTC|TRX|HBAR|SUI|TAO)\s*\$[\d,.]+\s*-?[\d.]+%/g,
    /\$[\d,]+\.[\d]+\s+[+-]?[\d.]+%\s*/g,
    /(?:We use cookies|This (?:site|website) uses cookies|Cookie (?:Policy|Settings|Consent))[\s\S]{0,500}(?:Accept|Got it|I agree|OK|Manage)/gi,
  ];

  let text = cleaned;
  for (const p of TRAILING_CUTOFFS) text = text.replace(p, '');
  for (const p of INLINE_JUNK) text = text.replace(p, '');
  return text.replace(/\s{3,}/g, ' ').trim().slice(0, 4000);
}

async function fetchDirect(url) {
  const r = await fetch(url, { headers: BROWSER_HEADERS });
  const html = await r.text();
  if (isBlockedResponse(html, r.status)) return null;
  const text = extractText(html);
  return text.length > 200 ? text : null;
}

async function fetchViaJina(url) {
  const r = await fetch(`https://r.jina.ai/${url}`, {
    headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' },
  });
  if (!r.ok) return null;
  const text = await r.text();
  return text && text.length > 200 ? text.slice(0, 4000) : null;
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestPost({ request }) {
  let url;
  try {
    ({ url } = await request.json());
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }
  if (!url) return json(400, { error: 'URL required' });

  try {
    const direct = await fetchDirect(url);
    if (direct) return json(200, { text: direct, method: 'direct', blocked: false });
    const jina = await fetchViaJina(url);
    if (jina) return json(200, { text: jina, method: 'jina', blocked: false });
    return json(200, { text: null, method: null, blocked: true });
  } catch (e) {
    return json(500, { error: e.message });
  }
}
