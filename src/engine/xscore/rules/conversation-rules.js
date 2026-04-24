/**
 * Conversation kuralları — Reply & Konuşma Zinciri
 * X algoritması: Reply = 13.5–27×, Reply+Yazar cevabı = 75–150× (en güçlü sinyal)
 */

// ─── Seçim sorusu (+15) ──────────────────────────────────────────────────────
const CHOICE_REGEX = /\b(which|A or B|choose|pick one|team \w+ or team \w+|hangisi|seç(?:er misin)?|tercihin|A mı[,.]? B mi|mi[,.]? yoksa)\b.*\?/i;

export const choiceQuestionRule = {
  id: 'conv-choice-question',
  name: 'Seçim Sorusu',
  category: 'conversation',
  evaluate: (input) => {
    if (CHOICE_REGEX.test(input.text)) {
      return {
        ruleId: 'conv-choice-question', triggered: true, points: 15, severity: 'positive',
        suggestion: 'Seçim sorusu — düşük efor, yüksek yanıt (Reply = 27×, Author reply = 75–150×).',
      };
    }
    return { ruleId: 'conv-choice-question', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Doğrudan soru (+10) ─────────────────────────────────────────────────────
const DIRECT_CTA = /sence|ne düşünüyorsun|fikrin ne|bana yaz|siz nasıl|sen ne|what do you think|tell me|have you|what's your|how do you/i;

export const directQuestionRule = {
  id: 'conv-direct-question',
  name: 'Doğrudan Soru',
  category: 'conversation',
  evaluate: (input) => {
    const tail = input.text.slice(-140);
    const hasQ = tail.includes('?');
    const hasCta = DIRECT_CTA.test(tail);
    if (hasQ && hasCta) {
      return {
        ruleId: 'conv-direct-question', triggered: true, points: 10, severity: 'positive',
        suggestion: 'Doğrudan soru — yanıt tetikler. Reply zinciri algoritma\'yı rokete çevirir.',
      };
    }
    return { ruleId: 'conv-direct-question', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Karşıt iddia (+8) ───────────────────────────────────────────────────────
const CONTRARIAN = /\b(overrated|underrated|wrong about|nobody talks about|unpopular|controversial|myth|lie|truth is|fazla değerli|az değerli|kimse konuşmuyor|aksine|yanlış biliniyor|aslında|herkes yanlış|gerçek şu ki)\b/i;

export const contrarianRule = {
  id: 'conv-contrarian',
  name: 'Karşıt İddia',
  category: 'conversation',
  evaluate: (input) => {
    const first80 = input.text.slice(0, 80);
    if (CONTRARIAN.test(first80)) {
      return {
        ruleId: 'conv-contrarian', triggered: true, points: 8, severity: 'positive',
        suggestion: 'Karşıt iddia — tartışma ve yanıt zinciri çeker. Algoritma için güçlü sinyal.',
      };
    }
    return { ruleId: 'conv-contrarian', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Genel açık soru (+5) ────────────────────────────────────────────────────
// Seçim/direkt değil ama tweet soru işaretiyle bitiyor
const RHETORICAL = /değil mi\?|haksız mıyım\?|öyle değil mi\?|isn'?t it\?|don'?t you think\?|right\?/i;

export const openQuestionRule = {
  id: 'conv-open-question',
  name: 'Açık Soru',
  category: 'conversation',
  evaluate: (input) => {
    const trimmed = input.text.trimEnd();
    const endsQ = trimmed.endsWith('?');
    if (!endsQ) return { ruleId: 'conv-open-question', triggered: false, points: 0, severity: 'info' };
    // Seçim veya direkt zaten daha yüksek puan alır, çakışmayı önle
    if (CHOICE_REGEX.test(input.text) || DIRECT_CTA.test(input.text.slice(-140))) {
      return { ruleId: 'conv-open-question', triggered: false, points: 0, severity: 'info' };
    }
    if (RHETORICAL.test(input.text)) {
      return { ruleId: 'conv-open-question', triggered: false, points: 0, severity: 'info' };
    }
    return {
      ruleId: 'conv-open-question', triggered: true, points: 5, severity: 'positive',
      suggestion: 'Soru ile bitiyor — yanıt oranını artırır.',
    };
  },
};

// ─── Retorik soru (−5) ───────────────────────────────────────────────────────
export const rhetoricalRule = {
  id: 'conv-rhetorical',
  name: 'Retorik Soru',
  category: 'conversation',
  evaluate: (input) => {
    if (RHETORICAL.test(input.text)) {
      return {
        ruleId: 'conv-rhetorical', triggered: true, points: -5, severity: 'warning',
        suggestion: 'Retorik soru — cevaplanamaz. Gerçek yanıt isteyen bir soruya çevir.',
      };
    }
    return { ruleId: 'conv-rhetorical', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Ölü kapanış (−10) ───────────────────────────────────────────────────────
const CTA_SIGNAL = /\?|sence|ne düşünüyorsun|what do you think|tell me|share|paylaş|yorum|:\s*$|—\s*$|\.\.\.\s*$/i;

export const deadEndRule = {
  id: 'conv-dead-end',
  name: 'Ölü Kapanış',
  category: 'conversation',
  evaluate: (input) => {
    if (input.text.length < 60) return { ruleId: 'conv-dead-end', triggered: false, points: 0, severity: 'info' };
    if (CTA_SIGNAL.test(input.text)) return { ruleId: 'conv-dead-end', triggered: false, points: 0, severity: 'info' };
    return {
      ruleId: 'conv-dead-end', triggered: true, points: -10, severity: 'warning',
      suggestion: 'Yanıt çekecek hiçbir sinyal yok. Soru veya açık döngü ekle — Reply zinciri = 75–150× değer.',
    };
  },
};

// ─── Engagement bait (−15) ───────────────────────────────────────────────────
const BAIT = [
  /like if/i, /rt if/i, /retweet this/i, /retweet if/i,
  /follow for more/i, /follow me for/i,
  /beğen.{0,8}eğer/i, /rt yap/i, /takip et.{0,15}için/i,
  /paylaş.{0,8}eğer/i, /yorumla.{0,10}eğer/i,
];

export const engagementBaitRule = {
  id: 'conv-engagement-bait',
  name: 'Engagement Bait',
  category: 'conversation',
  evaluate: (input) => {
    for (const p of BAIT) {
      const m = p.exec(input.text);
      if (m) {
        return {
          ruleId: 'conv-engagement-bait', triggered: true, points: -15, severity: 'critical',
          suggestion: 'Engagement bait — algoritma cezası + shadow ban riski. Organik soruya çevir.',
          highlight: { start: m.index, end: m.index + m[0].length, severity: 'critical' },
        };
      }
    }
    return { ruleId: 'conv-engagement-bait', triggered: false, points: 0, severity: 'info' };
  },
};
