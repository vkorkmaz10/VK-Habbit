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

    // Remove crypto price tickers, market data, and site junk from all sources
    const JUNK_PATTERNS = [
      /Coin Prices[\s\S]*$/i,
      /Trending (Coins|Tokens)[\s\S]*$/i,
      /Market (Data|Cap|Overview)[\s\S]*$/i,
      /Top (Coins|Cryptocurrencies|Assets)[\s\S]*$/i,
      /Price Ticker[\s\S]*$/i,
      /Newsletter[\s\S]*$/i,
      /Subscribe[\s\S]*$/i,
      /Related (Articles|Stories|News)[\s\S]*$/i,
      /Read (More|Next)[\s\S]*$/i,
      /Popular (Stories|Articles)[\s\S]*$/i,
      /Don't Miss[\s\S]*$/i,
      /Sign up for[\s\S]*$/i,
      /Advertisement[\s\S]*$/i,
      // Repeated price patterns: "BTC $72,789.00 2.05% ETH $2,231.78 ..."
      /\b(BTC|ETH|XRP|BNB|SOL|DOGE|ADA|AVAX|SHIB|LINK|DOT)\s*\$[\d,.]+\s*[\d.]+%/g,
    ];

    let text = cleaned;
    for (const pattern of JUNK_PATTERNS) {
      text = text.replace(pattern, '');
    }
    text = text.trim().slice(0, 3000);

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
