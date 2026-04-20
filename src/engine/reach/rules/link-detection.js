// Ported from AytuncYildizli/reach-optimizer (MIT)

const LINK_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+/i;
const INTERNAL_LINK = /^https?:\/\/(www\.)?(x\.com|twitter\.com)(\/|$)/i;
const MEDIA_LINK = /^https?:\/\/pic\.(x\.com|twitter\.com)\//i;

export const linkDetectionRule = {
  id: 'penalty-link-external',
  name: 'External Link Detection',
  category: 'penalty',
  evaluate: (input) => {
    const match = LINK_REGEX.exec(input.text);
    if (!match) {
      return { ruleId: 'penalty-link-external', triggered: false, points: 0, severity: 'info' };
    }
    const url = match[0];
    if (INTERNAL_LINK.test(url) || MEDIA_LINK.test(url)) {
      return { ruleId: 'penalty-link-external', triggered: false, points: 0, severity: 'info' };
    }
    return {
      ruleId: 'penalty-link-external', triggered: true, points: -8, severity: 'critical',
      suggestion: 'Link\'i ilk yanıta taşı. Dış link erişimi %30-50 düşürür (free hesaplar link postlarda neredeyse sıfır etkileşim alır).',
      highlight: { start: match.index, end: match.index + match[0].length, severity: 'critical' },
    };
  },
};
