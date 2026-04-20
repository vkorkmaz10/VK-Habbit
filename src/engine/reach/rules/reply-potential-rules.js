// Ported from AytuncYildizli/reach-optimizer (MIT)

const CHOICE_QUESTION = /\b(which|what'?s your|A or B|choose|pick one|team \w+ or team \w+|hangisi|seç|tercihin|A mı B mi)\b.*\?/i;

export const choiceQuestionRule = {
  id: 'engagement-choice-question',
  name: 'Choice Question',
  category: 'engagement',
  evaluate: (input) => {
    if (CHOICE_QUESTION.test(input.text)) {
      return {
        ruleId: 'engagement-choice-question', triggered: true, points: 10, severity: 'positive',
        suggestion: 'Seçim sorusu — düşük efor yanıt zincirleri yaratır (yanıtlar = 27x algoritma ağırlığı).',
      };
    }
    return { ruleId: 'engagement-choice-question', triggered: false, points: 0, severity: 'info' };
  },
};

const CTA_KEYWORDS = /(\?|what do you think|tell me|share your|drop your|reply with|tag someone|here'?s (what|how|why)|\.\.\.|sence|ne düşünüyorsun|paylaş|yorumla|işte (ne|nasıl|neden))/i;

export const deadEndingRule = {
  id: 'penalty-dead-ending',
  name: 'Dead Ending Detection',
  category: 'penalty',
  evaluate: (input) => {
    const text = input.text;
    const notTriggered = { ruleId: 'penalty-dead-ending', triggered: false, points: 0, severity: 'info' };
    if (text.length < 71) return notTriggered;
    const trimmed = text.trimEnd();
    const lastChar = trimmed.charAt(trimmed.length - 1);
    if (lastChar === '?' || lastChar === ':' || trimmed.endsWith('...')) return notTriggered;
    const lastPortion = text.slice(-120);
    if (CTA_KEYWORDS.test(lastPortion)) return notTriggered;
    if (/\?/.test(text) || CTA_KEYWORDS.test(text)) return notTriggered;
    return {
      ruleId: 'penalty-dead-ending', triggered: true, points: -4, severity: 'warning',
      suggestion: 'Ölü kapanış — yanıt çekmek için soru veya açık döngü ekle (yanıtlar = 27x like).',
    };
  },
};

const COMBATIVE_WORDS = /\b(idiot|stupid|dumb|moron|trash|garbage|shut up|stfu|gtfo|brain ?dead|clown|aptal|salak|gerizekalı|çöp|kapa çeneni|ahmak|geri zekalı)\b/i;

export const combativeToneRule = {
  id: 'penalty-combative-tone',
  name: 'Combative Tone Detection',
  category: 'penalty',
  evaluate: (input) => {
    if (COMBATIVE_WORDS.test(input.text)) {
      return {
        ruleId: 'penalty-combative-tone', triggered: true, points: -10, severity: 'critical',
        suggestion: 'Saldırgan ton — Grok sentiment analizi agresif içeriği cezalandırır. Block/report = -148x to -738x like.',
      };
    }
    return { ruleId: 'penalty-combative-tone', triggered: false, points: 0, severity: 'info' };
  },
};

export const mediaPresenceRule = {
  id: 'bonus-media-present',
  name: 'Media Presence',
  category: 'bonus',
  evaluate: (input) => {
    if (input.hasMedia) {
      return {
        ruleId: 'bonus-media-present', triggered: true, points: 4, severity: 'positive',
        suggestion: 'Medya eklendi — algoritmada 2x Earlybird boost.',
      };
    }
    if (input.text.length > 100) {
      return {
        ruleId: 'bonus-media-present', triggered: true, points: 0, severity: 'info',
        suggestion: 'Görsel eklemeyi düşün — 2x algoritma boost. Ama metin de iyi performans gösterir.',
      };
    }
    return { ruleId: 'bonus-media-present', triggered: false, points: 0, severity: 'info' };
  },
};

const GRAMMAR_PATTERNS = [
  { pattern: /\bi (am|was|have|had|will|would|can|could|should|want|need|think|know|like|love|hate|did|do)\b/i, label: "küçük 'i'" },
  { pattern: /\bshould of\b/i, label: 'should of → should have' },
  { pattern: /\bcould of\b/i, label: 'could of → could have' },
  { pattern: /\bwould of\b/i, label: 'would of → would have' },
  { pattern: /\balot\b/i, label: 'alot → a lot' },
  { pattern: /\bdefinate(ly)?\b/i, label: 'definate → definite' },
  { pattern: /\bseperate\b/i, label: 'seperate → separate' },
  { pattern: /\brecieve\b/i, label: 'recieve → receive' },
  { pattern: /\bthe\s+the\b/i, label: "tekrarlanan 'the the'" },
  { pattern: /\b(yapıcam|gelicem|gidicem|yapıyom|geliyom|gidiyom)\b/i, label: 'konuşma dili → standart' },
  { pattern: /\b(mı|mi|mu|mü)\s/i, label: '' }, // valid usage
];

export const grammarCheckRule = {
  id: 'penalty-grammar',
  name: 'Grammar Check',
  category: 'penalty',
  evaluate: (input) => {
    const text = input.text;
    const issues = [];
    for (const { pattern, label } of GRAMMAR_PATTERNS) {
      if (!label) continue;
      if (pattern.test(text)) issues.push(label);
    }
    if (issues.length === 0) {
      return { ruleId: 'penalty-grammar', triggered: false, points: 0, severity: 'info' };
    }
    return {
      ruleId: 'penalty-grammar', triggered: true,
      points: -Math.min(issues.length * 3, 9),
      severity: issues.length >= 3 ? 'critical' : 'warning',
      suggestion: `Dilbilgisi: ${issues.join(', ')}. Algoritma düşük kaliteli dili cezalandırır.`,
    };
  },
};

export const hashtagPlacementRule = {
  id: 'penalty-hashtag-placement',
  name: 'Hashtag Placement',
  category: 'penalty',
  evaluate: (input) => {
    if (/^#\w+/.test(input.text)) {
      return {
        ruleId: 'penalty-hashtag-placement', triggered: true, points: -4, severity: 'warning',
        suggestion: 'Hashtag ile başlamak hook\'u harcar — algoritmik ceza kanıtlanmış.',
      };
    }
    return { ruleId: 'penalty-hashtag-placement', triggered: false, points: 0, severity: 'info' };
  },
};

export const allCapsSpamRule = {
  id: 'penalty-all-caps-spam',
  name: 'All-Caps Spam',
  category: 'penalty',
  evaluate: (input) => {
    const words = input.text.split(/\s+/).filter(w => w.length >= 3);
    if (words.length === 0) {
      return { ruleId: 'penalty-all-caps-spam', triggered: false, points: 0, severity: 'info' };
    }
    const capsWords = words.filter(w => w === w.toUpperCase() && /[A-ZÇĞİÖŞÜ]/.test(w));
    const capsRatio = capsWords.length / words.length;
    if (capsRatio > 0.3 && capsWords.length >= 3) {
      return {
        ruleId: 'penalty-all-caps-spam', triggered: true, points: -4, severity: 'warning',
        suggestion: 'Çok fazla BÜYÜK HARF — algoritma cezası. Vurgu için seyrek kullan.',
      };
    }
    return { ruleId: 'penalty-all-caps-spam', triggered: false, points: 0, severity: 'info' };
  },
};
