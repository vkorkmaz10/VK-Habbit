// Ported from AytuncYildizli/reach-optimizer (MIT)

const ENGAGEMENT_BAIT_PATTERNS = [
  /like if/i, /rt if/i, /retweet this/i, /retweet if/i,
  /follow for more/i, /follow me for/i, /comment .* if/i,
  /who else/i, /share if/i, /share this/i,
  // Turkish
  /beğen.{0,5}eğer/i, /rt yap/i, /takip et.{0,15}için/i,
  /yorumla.{0,10}eğer/i, /paylaş.{0,5}eğer/i,
];

export const engagementBaitRule = {
  id: 'penalty-engagement-bait',
  name: 'Engagement Bait',
  category: 'penalty',
  evaluate: (input) => {
    for (const pattern of ENGAGEMENT_BAIT_PATTERNS) {
      const match = pattern.exec(input.text);
      if (match) {
        return {
          ruleId: 'penalty-engagement-bait', triggered: true, points: -12, severity: 'critical',
          suggestion: 'Engagement bait — kanıtlanmış algoritma cezası + shadow ban riski. Organik soruya çevir.',
          highlight: { start: match.index, end: match.index + match[0].length, severity: 'critical' },
        };
      }
    }
    return { ruleId: 'penalty-engagement-bait', triggered: false, points: 0, severity: 'info' };
  },
};

export const textWallRule = {
  id: 'penalty-text-wall',
  name: 'Text Wall',
  category: 'penalty',
  evaluate: (input) => {
    const text = input.text;
    const isLong = text.length > 280;
    const hasLineBreaks = text.includes('\n') || text.includes('\r');
    if (input.hasMedia) {
      return { ruleId: 'penalty-text-wall', triggered: false, points: 0, severity: 'info' };
    }
    if (isLong && !input.isThread && !hasLineBreaks) {
      return {
        ruleId: 'penalty-text-wall', triggered: true, points: -7, severity: 'warning',
        suggestion: 'Metin duvarı — paragraflara böl veya thread yap. Satır boşlukları %20-30 etkileşim artırır.',
      };
    }
    return { ruleId: 'penalty-text-wall', triggered: false, points: 0, severity: 'info' };
  },
};
