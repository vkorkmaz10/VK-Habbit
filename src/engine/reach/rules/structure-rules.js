// Ported from AytuncYildizli/reach-optimizer (MIT)

export const characterLengthRule = {
  id: 'structure-char-length',
  name: 'Character Length',
  category: 'structure',
  evaluate: (input) => {
    const len = input.text.length;
    // Premium-aware: 280 hard limit yok ama "Daha fazla göster" kesim noktası hala 280.
    // 71-110 gerçek sweet spot (kanıtlanmış %17 boost). 280-560 arası içerik haklıysa OK.
    if (len < 30) {
      return { ruleId: 'structure-char-length', triggered: true, points: -5, severity: 'warning', suggestion: 'Çok kısa — bağlam veya detay ekle.' };
    }
    if (len <= 70) {
      return { ruleId: 'structure-char-length', triggered: true, points: 2, severity: 'info' };
    }
    if (len <= 110) {
      return { ruleId: 'structure-char-length', triggered: true, points: 7, severity: 'positive', suggestion: 'Optimal tweet uzunluğu — 71-110 karakter %17 daha fazla etkileşim alır.' };
    }
    if (len <= 200) {
      return { ruleId: 'structure-char-length', triggered: true, points: 5, severity: 'positive', suggestion: 'Bağlamlı içerik için iyi uzunluk.' };
    }
    if (len <= 280) {
      return { ruleId: 'structure-char-length', triggered: true, points: 4, severity: 'info', suggestion: '"Daha fazla göster" sınırına yakın — ilk 280 karakter stand-alone okutmalı.' };
    }
    if (len <= 560) {
      // Premium long-form: hafif pozitif (içerik haklıysa) ama "see more" cezası var
      return {
        ruleId: 'structure-char-length', triggered: true,
        points: input.hasMedia ? 2 : 0,
        severity: 'info',
        suggestion: 'Premium long-form. İlk 280 karakterin (hook + ana fikir) stand-alone okutması şart — devamı sadece somut veri/örnek eklediği için var olmalı.',
      };
    }
    if (len <= 900) {
      if (input.isThread) {
        return { ruleId: 'structure-char-length', triggered: false, points: 0, severity: 'info' };
      }
      return {
        ruleId: 'structure-char-length', triggered: true,
        points: input.hasMedia ? -2 : -4,
        severity: 'warning',
        suggestion: 'Çok uzun — bu noktada thread daha güçlü erişim alır. Tek tweet 560 karakteri geçmesin.',
      };
    }
    // 900+
    if (!input.isThread) {
      return {
        ruleId: 'structure-char-length', triggered: true,
        points: -6,
        severity: 'warning',
        suggestion: 'Tweet için fazla uzun — mutlaka thread\'e böl.',
      };
    }
    return { ruleId: 'structure-char-length', triggered: false, points: 0, severity: 'info' };
  },
};

const HASHTAG_REGEX = /#\w+/g;

export const hashtagCountRule = {
  id: 'penalty-hashtag-spam',
  name: 'Hashtag Spam Detection',
  category: 'penalty',
  evaluate: (input) => {
    const matches = input.text.match(HASHTAG_REGEX);
    const count = matches ? matches.length : 0;
    if (count >= 3) {
      return {
        ruleId: 'penalty-hashtag-spam', triggered: true, points: -6, severity: 'warning',
        suggestion: 'Çok fazla hashtag — 3+ hashtag etkileşimi ~%40 düşürür. Max 1-2 kullan.',
      };
    }
    return { ruleId: 'penalty-hashtag-spam', triggered: false, points: 0, severity: 'info' };
  },
};

// eslint-disable-next-line no-misleading-character-class
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu;

export const emojiCountRule = {
  id: 'penalty-emoji-spam',
  name: 'Emoji Spam Detection',
  category: 'penalty',
  evaluate: (input) => {
    const matches = input.text.match(EMOJI_REGEX);
    const count = matches ? matches.length : 0;
    if (count >= 5) {
      return {
        ruleId: 'penalty-emoji-spam', triggered: true, points: -3, severity: 'warning',
        suggestion: 'Çok fazla emoji — vurgu için 1-2 yeterli, dekoratif değil.',
      };
    }
    return { ruleId: 'penalty-emoji-spam', triggered: false, points: 0, severity: 'info' };
  },
};

export const threadLengthRule = {
  id: 'structure-thread-length',
  name: 'Thread Length',
  category: 'structure',
  evaluate: (input) => {
    if (!input.isThread || input.threadLength === undefined) {
      return { ruleId: 'structure-thread-length', triggered: false, points: 0, severity: 'info' };
    }
    const len = input.threadLength;
    if (len >= 5 && len <= 8) {
      return { ruleId: 'structure-thread-length', triggered: true, points: 6, severity: 'positive', suggestion: 'Thread uzunluğu sweet spot\'ta (5-8 tweet) — 2.4x etkileşim.' };
    }
    if (len <= 12) {
      return { ruleId: 'structure-thread-length', triggered: true, points: 3, severity: 'positive', suggestion: 'İyi thread uzunluğu.' };
    }
    if (len >= 3 && len <= 4) {
      return { ruleId: 'structure-thread-length', triggered: true, points: 0, severity: 'info' };
    }
    if (len < 3) {
      return { ruleId: 'structure-thread-length', triggered: true, points: -4, severity: 'warning', suggestion: 'Thread çok kısa — genişlet veya tek tweet olarak at.' };
    }
    if (len <= 15) {
      return { ruleId: 'structure-thread-length', triggered: true, points: -1, severity: 'info' };
    }
    return { ruleId: 'structure-thread-length', triggered: true, points: -3, severity: 'warning', suggestion: 'Thread çok uzun — birden fazla thread\'e bölmeyi düşün.' };
  },
};

export const lineBreaksRule = {
  id: 'structure-line-breaks',
  name: 'Line Break Formatting',
  category: 'structure',
  evaluate: (input) => {
    const text = input.text;
    if (text.length < 100) {
      return { ruleId: 'structure-line-breaks', triggered: false, points: 0, severity: 'info' };
    }
    if (text.includes('\n')) {
      return {
        ruleId: 'structure-line-breaks', triggered: true, points: 5, severity: 'positive',
        suggestion: 'İyi format — satır boşlukları okunabilirliği %20-30 artırır.',
      };
    }
    return { ruleId: 'structure-line-breaks', triggered: false, points: 0, severity: 'info' };
  },
};
