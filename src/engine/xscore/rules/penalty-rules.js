/**
 * Penalty kuralları — Reach Öldürenler
 * X algoritması: dış link -%30-50, offensive -%80'e kadar, spam = bastırma.
 */

// ─── Dış link (−15) ──────────────────────────────────────────────────────────
const LINK_RE = /https?:\/\/[^\s]+|www\.[^\s]+/i;
const INTERNAL_LINK = /^https?:\/\/(www\.)?(x\.com|twitter\.com)(\/|$)/i;
const MEDIA_LINK = /^https?:\/\/pic\.(x\.com|twitter\.com)\//i;

export const externalLinkRule = {
  id: 'pen-external-link',
  name: 'Dış Link',
  category: 'penalty',
  evaluate: (input) => {
    const m = LINK_RE.exec(input.text);
    if (!m) return { ruleId: 'pen-external-link', triggered: false, points: 0, severity: 'info' };
    const url = m[0];
    if (INTERNAL_LINK.test(url) || MEDIA_LINK.test(url)) {
      return { ruleId: 'pen-external-link', triggered: false, points: 0, severity: 'info' };
    }
    return {
      ruleId: 'pen-external-link', triggered: true, points: -15, severity: 'critical',
      suggestion: 'Dış link doğrudan post\'ta — erişimi %30–50 düşürür. Link\'i ilk reply\'e taşı.',
      highlight: { start: m.index, end: m.index + m[0].length, severity: 'critical' },
    };
  },
};

// ─── AI slop kelimeleri (−7 / −14) ───────────────────────────────────────────
const AI_WORDS = /\b(delve|tapestry|landscape|labyrinth|crucible|beacon|embark|unveil|leverage|synergy|holistic|paramount|endeavor|utilize|facilitate|aforementioned|comprehensive|multifaceted|paradigm|ever-evolving|realm|harness|vibrant|robust|compelling|navigate|crucial|nihayetinde|söylenebilir ki|değerlendirildiğinde|bilindiği üzere|öncelikle belirtmek gerekir|nezdinde|akabinde|münhasıran|paradigma|holistik|sinerji|kompleks)\b/gi;
const AI_PHRASES = /it's worth noting|in today's digital age|in the realm of|at the end of the day|it goes without saying|dive (deep )?into|şunu belirtmek gerekir|günümüz dijital çağında|sonuç olarak değerlendirildiğinde|nihai noktada|son tahlilde/gi;

export const aiSlopRule = {
  id: 'pen-ai-slop',
  name: 'AI Yazım Kalıbı',
  category: 'penalty',
  evaluate: (input) => {
    const wordMatches = input.text.match(AI_WORDS);
    const phraseMatches = input.text.match(AI_PHRASES);
    const count = (wordMatches?.length || 0) + (phraseMatches?.length || 0);
    if (count >= 4) {
      return {
        ruleId: 'pen-ai-slop', triggered: true, points: -14, severity: 'critical',
        suggestion: `Yoğun AI yazım kalıbı (${count} işaret) — etkileşim hızını öldürür. Kendi sesinle yaz.`,
      };
    }
    if (count >= 2) {
      return {
        ruleId: 'pen-ai-slop', triggered: true, points: -7, severity: 'warning',
        suggestion: `AI yazım kalıbı (${count} işaret) — daha doğal bir dil kullan.`,
      };
    }
    return { ruleId: 'pen-ai-slop', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Saldırgan dil (−12) ─────────────────────────────────────────────────────
const OFFENSIVE = /\b(idiot|stupid|dumb|moron|trash|garbage|shut up|stfu|gtfo|brain\s?dead|clown|aptal|salak|gerizekalı|çöp|kapa çeneni|ahmak|geri zekalı)\b/i;

export const offensiveRule = {
  id: 'pen-offensive',
  name: 'Saldırgan Dil',
  category: 'penalty',
  evaluate: (input) => {
    if (OFFENSIVE.test(input.text)) {
      return {
        ruleId: 'pen-offensive', triggered: true, points: -12, severity: 'critical',
        suggestion: 'Saldırgan dil — Block/Report = algoritmada -148× ila -738× etkileşim. Grok sentiment analizi cezalandırır.',
      };
    }
    return { ruleId: 'pen-offensive', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── AI yapısal kalıplar (−6) ────────────────────────────────────────────────
const EM_DASH = /\u2014/g;
const STRUCTURAL_AI = /^(Furthermore|Moreover|Additionally|In conclusion|It's worth noting|Bunun yanı sıra|Ek olarak|Sonuç olarak|Şunu belirtmek gerekir)/im;

export const aiStructureRule = {
  id: 'pen-ai-structure',
  name: 'AI Yapı Kalıbı',
  category: 'penalty',
  evaluate: (input) => {
    const text = input.text;
    let penalty = 0;
    if ((text.match(EM_DASH) || []).length >= 3) penalty -= 3;
    if (STRUCTURAL_AI.test(text)) penalty -= 4;
    if (penalty === 0) return { ruleId: 'pen-ai-structure', triggered: false, points: 0, severity: 'info' };
    return {
      ruleId: 'pen-ai-structure', triggered: true,
      points: Math.max(-6, penalty), severity: 'warning',
      suggestion: 'Yapısal AI kalıpları — kısa cümleler ve doğal geçişler kullan.',
    };
  },
};

// ─── All caps spam (−5) ──────────────────────────────────────────────────────
export const allCapsRule = {
  id: 'pen-all-caps',
  name: 'Büyük Harf Spam',
  category: 'penalty',
  evaluate: (input) => {
    const words = input.text.split(/\s+/).filter(w => w.length >= 3);
    if (!words.length) return { ruleId: 'pen-all-caps', triggered: false, points: 0, severity: 'info' };
    const caps = words.filter(w => w === w.toUpperCase() && /[A-ZÇĞİÖŞÜ]/.test(w));
    if (caps.length / words.length > 0.3 && caps.length >= 3) {
      return {
        ruleId: 'pen-all-caps', triggered: true, points: -5, severity: 'warning',
        suggestion: 'Aşırı büyük harf — algoritma cezası. Vurgu için seyrek kullan.',
      };
    }
    return { ruleId: 'pen-all-caps', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Hashtag ile başlama (−4) ────────────────────────────────────────────────
export const hashtagStartRule = {
  id: 'pen-hashtag-start',
  name: 'Hashtag Açılışı',
  category: 'penalty',
  evaluate: (input) => {
    if (/^#\w+/.test(input.text)) {
      return {
        ruleId: 'pen-hashtag-start', triggered: true, points: -4, severity: 'warning',
        suggestion: 'Hashtag ile başlamak hook\'u harcar ve algoritmik ceza alır.',
      };
    }
    return { ruleId: 'pen-hashtag-start', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Dilbilgisi (−3 per hata, maks −9) ──────────────────────────────────────
const GRAMMAR = [
  { pattern: /\bshould of\b/i,   label: 'should of → should have' },
  { pattern: /\bcould of\b/i,    label: 'could of → could have' },
  { pattern: /\bwould of\b/i,    label: 'would of → would have' },
  { pattern: /\balot\b/i,        label: 'alot → a lot' },
  { pattern: /\bseperate\b/i,    label: 'seperate → separate' },
  { pattern: /\brecieve\b/i,     label: 'recieve → receive' },
  { pattern: /\bthe\s+the\b/i,   label: "tekrarlanan 'the the'" },
  { pattern: /\b(yapıcam|gelicem|gidicem|yapıyom|geliyom|gidiyom)\b/i, label: 'yazım hatası' },
];

export const grammarRule = {
  id: 'pen-grammar',
  name: 'Yazım / Dilbilgisi',
  category: 'penalty',
  evaluate: (input) => {
    const issues = GRAMMAR.filter(({ pattern }) => pattern.test(input.text)).map(g => g.label);
    if (!issues.length) return { ruleId: 'pen-grammar', triggered: false, points: 0, severity: 'info' };
    return {
      ruleId: 'pen-grammar', triggered: true,
      points: -Math.min(issues.length * 3, 9),
      severity: issues.length >= 3 ? 'critical' : 'warning',
      suggestion: `Yazım: ${issues.join(', ')}. Düşük kalite sinyali.`,
    };
  },
};
