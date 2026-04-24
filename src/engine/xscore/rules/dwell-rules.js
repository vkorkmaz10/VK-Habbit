/**
 * Dwell kuralları — Kalma Süresi & Hook Kalitesi
 * X algoritması: Dwell time yüksek değişken etki, video 10sn+ büyük avantaj.
 * Hook = ilk 2-3 sn'de scroll durdurmak zorunda.
 */

// ─── Açık döngü (+8) ─────────────────────────────────────────────────────────
const OPEN_LOOP = /:\s*$|—\s*$|\u2014\s*$|\.\.\.\s*$/;

export const openLoopRule = {
  id: 'dwell-open-loop',
  name: 'Açık Döngü',
  category: 'dwell',
  evaluate: (input) => {
    const firstLine = input.text.split('\n')[0];
    if (OPEN_LOOP.test(firstLine)) {
      return {
        ruleId: 'dwell-open-loop', triggered: true, points: 8, severity: 'positive',
        suggestion: 'Açık döngü hook — merak boşluğu yaratır, "daha fazla göster" tıklamasını artırır.',
      };
    }
    return { ruleId: 'dwell-open-loop', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Sayı / veri (+6) ────────────────────────────────────────────────────────
const NUMBER_RE = /\$[\d,]+|\d+\s*%|\b\d{2,}\b/;

export const numberDataRule = {
  id: 'dwell-number-data',
  name: 'Sayı / Veri',
  category: 'dwell',
  evaluate: (input) => {
    const first80 = input.text.slice(0, 80);
    if (NUMBER_RE.test(first80)) {
      return {
        ruleId: 'dwell-number-data', triggered: true, points: 6, severity: 'positive',
        suggestion: 'Hook\'ta somut veri var — scroll durur, dwell time artar.',
      };
    }
    return { ruleId: 'dwell-number-data', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Hikaye açılışı (+4) ─────────────────────────────────────────────────────
const STORY = /^(Last (week|month|year)|Yesterday|I (just|recently|spent|built|quit|lost|made|earned)|Back in 20\d{2}|When I was|True story:|Geçen (hafta|ay|yıl)|Dün|\d+\s*(yıl|ay|hafta)\s*önce|20\d{2}'(de|da|te|ta)|Gerçek hikaye)/i;

export const storyOpenerRule = {
  id: 'dwell-story-opener',
  name: 'Hikaye Açılışı',
  category: 'dwell',
  evaluate: (input) => {
    if (STORY.test(input.text.slice(0, 80))) {
      return {
        ruleId: 'dwell-story-opener', triggered: true, points: 4, severity: 'positive',
        suggestion: 'Hikaye açılışı — kişisel deneyim anlatımı dwell time\'ı 2-3× artırır.',
      };
    }
    return { ruleId: 'dwell-story-opener', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Satır boşlukları (+4) ───────────────────────────────────────────────────
export const lineBreaksRule = {
  id: 'dwell-line-breaks',
  name: 'Satır Boşlukları',
  category: 'dwell',
  evaluate: (input) => {
    if (input.text.length >= 100 && input.text.includes('\n')) {
      return {
        ruleId: 'dwell-line-breaks', triggered: true, points: 4, severity: 'positive',
        suggestion: 'Satır boşlukları var — okunabilirliği artırır, scrool edilmeden okuttur.',
      };
    }
    return { ruleId: 'dwell-line-breaks', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Karakter uzunluğu (−5 / +4) ─────────────────────────────────────────────
export const charLengthRule = {
  id: 'dwell-char-length',
  name: 'Tweet Uzunluğu',
  category: 'dwell',
  evaluate: (input) => {
    const len = input.text.length;
    if (len < 30) {
      return {
        ruleId: 'dwell-char-length', triggered: true, points: -5, severity: 'warning',
        suggestion: 'Çok kısa — bağlam veya detay ekle. Dwell time sıfıra yakın.',
      };
    }
    if (len <= 200) {
      return {
        ruleId: 'dwell-char-length', triggered: true, points: 4, severity: 'positive',
        suggestion: '71–200 karakter sweet spot — hem hızlı okunur hem dwell time oluşturur.',
      };
    }
    if (len <= 560) {
      return { ruleId: 'dwell-char-length', triggered: false, points: 0, severity: 'info' };
    }
    if (!input.isThread) {
      return {
        ruleId: 'dwell-char-length', triggered: true, points: -3, severity: 'warning',
        suggestion: '560+ karakter tek tweet — thread\'e böl ya da kısalt.',
      };
    }
    return { ruleId: 'dwell-char-length', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Metin duvarı (−6) ───────────────────────────────────────────────────────
export const textWallRule = {
  id: 'dwell-text-wall',
  name: 'Metin Duvarı',
  category: 'dwell',
  evaluate: (input) => {
    if (input.hasMedia) return { ruleId: 'dwell-text-wall', triggered: false, points: 0, severity: 'info' };
    if (input.text.length > 280 && !input.isThread && !input.text.includes('\n')) {
      return {
        ruleId: 'dwell-text-wall', triggered: true, points: -6, severity: 'warning',
        suggestion: 'Metin duvarı — satır boşlukları ekle ya da thread\'e böl. Okunabilirlik dwell time\'ı doğrudan etkiler.',
      };
    }
    return { ruleId: 'dwell-text-wall', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Generik hook (−5) ───────────────────────────────────────────────────────
const GENERIC = [
  "here's why", 'let me explain', 'i think that', 'in this thread', 'a thread on',
  'thread:', "let's talk about", 'nobody asked but', 'can we talk about',
  'şimdi anlatayım', 'şu konuyu konuşalım', 'bu thread', 'bir konu açacağım',
  'thread geliyor',
];

export const genericHookRule = {
  id: 'dwell-generic-hook',
  name: 'Generik Hook',
  category: 'dwell',
  evaluate: (input) => {
    const first50 = input.text.slice(0, 50).toLowerCase();
    if (GENERIC.some(p => first50.includes(p))) {
      return {
        ruleId: 'dwell-generic-hook', triggered: true, points: -5, severity: 'warning',
        suggestion: 'Generik açılış — scroll durmuyor. Sayı, iddia ya da hikayeyle başla.',
      };
    }
    return { ruleId: 'dwell-generic-hook', triggered: false, points: 0, severity: 'info' };
  },
};
