// Ported from AytuncYildizli/reach-optimizer (MIT)
// packages/rules-engine/src/rules/hook-rules.ts

const GENERIC_PATTERNS = [
  "here's why",
  'let me explain',
  'i think that',
  'in this thread',
  'a thread on',
  'thread:',
  "let's talk about",
  'nobody asked but',
  'can we talk about',
  'i need to talk about',
  // Turkish additions
  'şimdi anlatayım',
  'şu konuyu konuşalım',
  'bu thread',
  'bir konu açacağım',
];

export const genericHookRule = {
  id: 'hook-generic-pattern',
  name: 'Generic Hook Pattern',
  category: 'hook',
  evaluate: (input) => {
    const first50 = input.text.slice(0, 50).toLowerCase();
    const matched = GENERIC_PATTERNS.some((p) => first50.includes(p));
    if (matched) {
      return {
        ruleId: 'hook-generic-pattern',
        triggered: true,
        points: -8,
        severity: 'warning',
        suggestion: 'Genel kalıp hook — somut sayı, cesur iddia veya soruyla aç.',
      };
    }
    return { ruleId: 'hook-generic-pattern', triggered: false, points: 0, severity: 'info' };
  },
};

export const hookLengthRule = {
  id: 'hook-length-check',
  name: 'Hook Length Check',
  category: 'structure',
  evaluate: (input) => {
    const firstLine = input.text.split('\n')[0];
    const len = firstLine.length;
    if (len <= 15) {
      return { ruleId: 'hook-length-check', triggered: true, points: -3, severity: 'warning', suggestion: 'Hook çok kısa — somut detay ekle.' };
    }
    if (len <= 80) {
      return { ruleId: 'hook-length-check', triggered: true, points: 5, severity: 'positive', suggestion: 'İdeal hook uzunluğu (mobil önizlemeye sığar).' };
    }
    if (len <= 120) {
      return { ruleId: 'hook-length-check', triggered: true, points: 2, severity: 'info' };
    }
    return {
      ruleId: 'hook-length-check', triggered: true,
      points: input.hasMedia ? -1 : -4,
      severity: 'warning',
      suggestion: 'Hook çok uzun — mobil için 120 karakter altına indir.',
    };
  },
};

const NUMBER_REGEX = /\$[\d,]+|\d+%|\b\d{2,}\b/;

export const numberDataHookRule = {
  id: 'hook-number-data',
  name: 'Number/Data in Hook',
  category: 'hook',
  evaluate: (input) => {
    const first80 = input.text.slice(0, 80);
    if (NUMBER_REGEX.test(first80)) {
      return {
        ruleId: 'hook-number-data', triggered: true, points: 8, severity: 'positive',
        suggestion: 'Hook\'ta sayı var — scroll\'u durdurur, dwell time\'ı artırır.',
      };
    }
    return { ruleId: 'hook-number-data', triggered: false, points: 0, severity: 'info' };
  },
};

export const multiSentenceHookRule = {
  id: 'hook-multi-sentence',
  name: 'Multi-Sentence Hook',
  category: 'hook',
  evaluate: (input) => {
    const firstLine = input.text.split('\n')[0];
    const sentences = firstLine.split(/[.!?]\s+/).filter(s => s.length > 0);
    if (sentences.length > 1) {
      const firstSentence = sentences[0];
      if (firstSentence && (firstSentence.length < 60 || firstSentence.includes('@'))) {
        return { ruleId: 'hook-multi-sentence', triggered: false, points: 0, severity: 'info' };
      }
      return {
        ruleId: 'hook-multi-sentence', triggered: true, points: -3, severity: 'warning',
        suggestion: 'Hook\'ta birden fazla cümle — tek güçlü cümle daha etkili.',
      };
    }
    return { ruleId: 'hook-multi-sentence', triggered: false, points: 0, severity: 'info' };
  },
};

const FIRST_PERSON_REGEX = /\bI\s|\bI'|\bben(im|ce)?\b|\bbenim\b/i;

export const firstPersonVoiceRule = {
  id: 'bonus-first-person',
  name: 'First-Person Voice',
  category: 'bonus',
  evaluate: (input) => {
    if (FIRST_PERSON_REGEX.test(input.text)) {
      return {
        ruleId: 'bonus-first-person', triggered: true, points: 4, severity: 'positive',
        suggestion: 'Birinci tekil ses — kişisel içerik genel ifadeden iyi performans gösterir.',
      };
    }
    return { ruleId: 'bonus-first-person', triggered: false, points: 0, severity: 'info' };
  },
};
