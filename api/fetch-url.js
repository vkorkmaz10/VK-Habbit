// Vercel Serverless Function — URL Content Scraper
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VKGymBot/1.0)' },
    });
    const html = await response.text();

    // Strip non-content HTML elements
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

    // ---- Comprehensive junk removal for crypto/tech news sites ----

    // 1) Trailing sections that signal end of article content
    const TRAILING_CUTOFFS = [
      /Coin Prices[\s\S]*$/i,
      /Trending (?:Coins|Tokens|News|Stories)[\s\S]*$/i,
      /Market (?:Data|Cap|Overview|Highlights)[\s\S]*$/i,
      /Top (?:Coins|Cryptocurrencies|Assets|Stories)[\s\S]*$/i,
      /Price Ticker[\s\S]*$/i,
      /Newsletter[\s\S]*$/i,
      /Subscribe (?:to|for|now)[\s\S]*$/i,
      /Sign up (?:for|to)[\s\S]*$/i,
      /Related (?:Articles|Stories|News|Posts|Coverage)[\s\S]*$/i,
      /Recommended (?:Articles|Stories|For You)[\s\S]*$/i,
      /Popular (?:Stories|Articles|News)[\s\S]*$/i,
      /More (?:Stories|Articles|News|From)[\s\S]*$/i,
      /Read (?:More|Next|Also)[\s\S]*$/i,
      /Don't Miss[\s\S]*$/i,
      /You (?:May|Might) (?:Also )?Like[\s\S]*$/i,
      /Editor'?s? (?:Pick|Choice)s?[\s\S]*$/i,
      /Advertisement[\s\S]*$/i,
      /Sponsored (?:Content|Post)[\s\S]*$/i,
      /About (?:the )?Author[\s\S]*$/i,
      /Share (?:this|article)[\s\S]*$/i,
      /Tags:[\s\S]*$/i,
      /Disclaimer[\s\S]*$/i,
      /(?:Latest|Breaking|Top) (?:News|Headlines|Stories)[\s\S]*$/i,
      /Stay (?:up to date|informed|connected)[\s\S]*$/i,
      /Join (?:our|the) (?:community|newsletter|telegram)[\s\S]*$/i,
      /Follow us on[\s\S]*$/i,
      /Get the (?:latest|best|top)[\s\S]*$/i,
      /©\s*\d{4}[\s\S]*$/i,
      /All Rights Reserved[\s\S]*$/i,
    ];

    // 2) Inline junk patterns (repeated price tickers, percentage changes)
    const INLINE_JUNK = [
      // "BTC $72,789.00 2.05% ETH $2,231.78 1.31% ..."
      /\b(?:BTC|ETH|XRP|BNB|SOL|DOGE|ADA|AVAX|SHIB|LINK|DOT|MATIC|UNI|ATOM|FIL|APT|ARB|OP|NEAR|FTM|ALGO|MANA|SAND|AXS|ICP|LDO|CRV|MKR|AAVE|SNX|COMP|SUSHI|YFI|BAL|UMA|REN|KNC|ZRX|USDT|USDC|USDS|BUSD|DAI|TUSD|PYUSD|WBT|HYPE|LEO|BCH|XMR|ZEC|LTC|TRX|HBAR|SUI|TAO|FIGR_HELOC|USD1|USDE|RAIN|CC)\s*\$[\d,.]+\s*-?[\d.]+%/g,
      // "$72,789.00 +2.05%" standalone price patterns
      /\$[\d,]+\.[\d]+\s+[+-]?[\d.]+%\s*/g,
      // Cookie consent, GDPR
      /(?:We use cookies|This (?:site|website) uses cookies|Cookie (?:Policy|Settings|Consent))[\s\S]{0,500}(?:Accept|Got it|I agree|OK|Manage)/gi,
    ];

    let text = cleaned;
    for (const p of TRAILING_CUTOFFS) text = text.replace(p, '');
    for (const p of INLINE_JUNK) text = text.replace(p, '');
    // Clean up leftover whitespace
    text = text.replace(/\s{3,}/g, ' ').trim().slice(0, 3000);

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
