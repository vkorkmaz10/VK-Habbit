export async function fetchAllNews() {
  try {
    const rssUrl = encodeURIComponent('https://www.coindesk.com/arc/outboundfeeds/rss/');
    const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
    const data = await response.json();
    if (data.status === 'ok') {
      return data.items.map((item, index) => ({
        id: `news-${index}`,
        title: item.title,
        sourceName: 'CoinDesk',
        sourceUrl: item.link,
        publishedAt: new Date(item.pubDate).getTime(),
        category: 'crypto',
        url: item.link
      }));
    }
    return [];
  } catch (error) {
    return [];
  }
}

export async function scrapeArticle(url) {
  return "Haber içeriği URL üzerinden analiz edilecek.";
}
