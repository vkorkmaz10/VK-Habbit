/**
 * Spread kuralları — Retweet / Quote / Bookmark
 * X algoritması: Retweet = 20×, Quote = 25×, Bookmark = 10×
 */

// ─── Bookmark formatı (+12) ──────────────────────────────────────────────────
const BOOKMARK = /\d+[.)]\s|\bstep\b|how to\b|\bguide\b|\bframework\b|\bchecklist\b|\btemplate\b|\btips?\b|\blesson\b|\brule\b|\bplaybook\b|\bliste\b|adım\s|nasıl\s|\brehber\b|\bkontrol listesi\b|\bşablon\b|\bipucu\b|\bders\b|\bkural\b|\byol haritası\b|\bsistem\b/i;

export const bookmarkFormatRule = {
  id: 'spread-bookmark-format',
  name: 'Kaydet Formatı',
  category: 'spread',
  evaluate: (input) => {
    if (BOOKMARK.test(input.text)) {
      return {
        ruleId: 'spread-bookmark-format', triggered: true, points: 12, severity: 'positive',
        suggestion: 'Kaydedilebilir format — Bookmark = 10×. Liste/rehber formatı en çok kaydedilen içerik tipi.',
      };
    }
    return { ruleId: 'spread-bookmark-format', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Paylaşılabilir iddia (+8) ───────────────────────────────────────────────
const BOLD = /^(The (best|worst|biggest|fastest|most|only|single|real|true)|No one|Everyone|Every single|There is no|Nothing beats|En (iyi|kötü|büyük|hızlı|tek|gerçek)|Hiç kimse|Herkes|Tek bir)/i;
const INTERRUPT = /^(Stop |Never |Don'?t |Quit |Forget |Avoid |Skip |Delete |Bırak |Asla |Yapma |Unutma |Sakın )/i;
const CONTRARIAN_SPREAD = /\b(overrated|underrated|wrong about|nobody talks about|aksine|yanlış biliniyor|aslında|gerçek şu ki)\b/i;

export const shareableClaimRule = {
  id: 'spread-shareable-claim',
  name: 'Paylaşılabilir İddia',
  category: 'spread',
  evaluate: (input) => {
    const first80 = input.text.slice(0, 80);
    if (BOLD.test(first80) || INTERRUPT.test(input.text) || CONTRARIAN_SPREAD.test(first80)) {
      return {
        ruleId: 'spread-shareable-claim', triggered: true, points: 8, severity: 'positive',
        suggestion: 'Güçlü iddia — Quote Tweet (25×) ve Retweet (20×) tetikler. Cesur beyanlar yayılır.',
      };
    }
    return { ruleId: 'spread-shareable-claim', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Görsel/video (+5) ───────────────────────────────────────────────────────
export const mediaRule = {
  id: 'spread-media',
  name: 'Görsel / Video',
  category: 'spread',
  evaluate: (input) => {
    if (input.hasMedia) {
      return {
        ruleId: 'spread-media', triggered: true, points: 5, severity: 'positive',
        suggestion: 'Medya eklendi — algoritma görsel içeriğe otomatik erişim bonusu verir.',
      };
    }
    return { ruleId: 'spread-media', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Birinci tekil kişi (+3) ─────────────────────────────────────────────────
const FIRST_PERSON = /\bI\s|\bI'|\bbenim?\b|\bbence\b/i;

export const firstPersonRule = {
  id: 'spread-first-person',
  name: 'Kişisel Ses',
  category: 'spread',
  evaluate: (input) => {
    if (FIRST_PERSON.test(input.text)) {
      return {
        ruleId: 'spread-first-person', triggered: true, points: 3, severity: 'positive',
        suggestion: 'Kişisel anlatım — özgün deneyim içeriği daha fazla Quote Tweet çeker.',
      };
    }
    return { ruleId: 'spread-first-person', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Bayat formül (−5) ───────────────────────────────────────────────────────
const STALE = /^(Unpopular opinion:|Hot take:|Here's the thing:|Let that sink in|Read that again|This\.|Thread\s*🧵|Popüler olmayan görüş:|Sıcak yorum:|Bunu bir daha okuyun)/iu;

export const staleFormulaRule = {
  id: 'spread-stale-formula',
  name: 'Bayat Formül',
  category: 'spread',
  evaluate: (input) => {
    if (STALE.test(input.text)) {
      return {
        ruleId: 'spread-stale-formula', triggered: true, points: -5, severity: 'warning',
        suggestion: 'Aşırı kullanılmış açılış kalıbı — düşük kalite sinyali, paylaşım oranını düşürür.',
      };
    }
    return { ruleId: 'spread-stale-formula', triggered: false, points: 0, severity: 'info' };
  },
};

// ─── Hashtag spam (−6) ───────────────────────────────────────────────────────
const HASHTAG_RE = /#\w+/g;

export const hashtagSpamRule = {
  id: 'spread-hashtag-spam',
  name: 'Hashtag Spam',
  category: 'spread',
  evaluate: (input) => {
    const count = (input.text.match(HASHTAG_RE) || []).length;
    if (count >= 3) {
      return {
        ruleId: 'spread-hashtag-spam', triggered: true, points: -6, severity: 'warning',
        suggestion: `${count} hashtag var — 3+ hashtag erişimi ~%40 düşürür. Maks 1 kullan.`,
      };
    }
    return { ruleId: 'spread-hashtag-spam', triggered: false, points: 0, severity: 'info' };
  },
};
