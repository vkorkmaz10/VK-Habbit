// Ported from AytuncYildizli/reach-optimizer (MIT)

const CTA_PATTERNS = [
  'what do you think', 'have you', 'which one', 'tell me', 'share your',
  "what's your", 'how do you', 'drop your', 'reply with', 'tag someone',
  // Turkish
  'sence', 'ne düşünüyorsun', 'siz nasıl', 'paylaşır mısın', 'yorumla',
  'sizin için', 'hangisi', 'sen ne', 'fikrin ne', 'bana yaz',
];

const RHETORICAL_PATTERNS = [
  'right?', "isn't it?", "don't you think?", "wouldn't you?",
  "isn't that", "don't we all",
  'değil mi?', 'öyle değil mi?', 'haksız mıyım?',
];

const OPEN_LOOP_ENDING = /:\s*$|—\s*$|\.\.\.\s*$/;
const OPEN_LOOP_CONTENT = /here'?s (what|how|why)|işte (nasıl|neden|ne)/i;

const BOOKMARK_PATTERNS = /\d+[.)]\s|step |how to |guide|framework|checklist|template|tips for|lesson|rule|playbook|roadmap|system|process|blueprint|formula|adım |nasıl |rehber|kontrol listesi|şablon|ipucu|ders|kural|yol haritası|sistem|süreç|plan|formül/i;

export const ctaPresenceRule = {
  id: 'engagement-cta-presence',
  name: 'CTA Presence',
  category: 'engagement',
  evaluate: (input) => {
    const text = input.text;
    const tail = text.slice(-120);
    const lowerTail = tail.toLowerCase();
    const lowerText = text.toLowerCase();
    const hasQuestionMark = tail.includes('?');
    const hasCtaPattern = CTA_PATTERNS.some(p => lowerTail.includes(p));

    if (hasQuestionMark) {
      const isRhetorical = RHETORICAL_PATTERNS.some(p => lowerText.includes(p));
      if (isRhetorical) {
        return {
          ruleId: 'engagement-cta-presence', triggered: true, points: -3, severity: 'warning',
          suggestion: 'Retorik soru — cevaplanabilir sorular daha fazla yanıt çeker (27x algoritma ağırlığı).',
        };
      }
    }
    if (hasQuestionMark || hasCtaPattern) {
      return {
        ruleId: 'engagement-cta-presence', triggered: true, points: 8, severity: 'positive',
        suggestion: 'Yanıt tetikleyici CTA var — yanıtlar like\'tan 27x değerli.',
      };
    }
    const lastLine = text.split('\n').filter(l => l.trim()).pop() || '';
    if (OPEN_LOOP_ENDING.test(lastLine) || OPEN_LOOP_CONTENT.test(text)) {
      return { ruleId: 'engagement-cta-presence', triggered: false, points: 0, severity: 'info' };
    }
    return {
      ruleId: 'engagement-cta-presence', triggered: true, points: -6, severity: 'warning',
      suggestion: 'CTA yok — yanıt tetiklemek için soru ekle (yanıtlar = 27x like).',
    };
  },
};

export const bookmarkValueRule = {
  id: 'engagement-bookmark-value',
  name: 'Bookmark Value',
  category: 'engagement',
  evaluate: (input) => {
    if (BOOKMARK_PATTERNS.test(input.text)) {
      return {
        ruleId: 'engagement-bookmark-value', triggered: true, points: 8, severity: 'positive',
        suggestion: 'Kaydedilebilir içerik — bookmark like\'tan 20x değerli.',
      };
    }
    return { ruleId: 'engagement-bookmark-value', triggered: false, points: 0, severity: 'info' };
  },
};
