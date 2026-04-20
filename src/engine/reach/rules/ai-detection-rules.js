// Ported from AytuncYildizli/reach-optimizer (MIT) + Turkish slop additions

const AI_SLOP_WORDS = /\b(delve|tapestry|landscape|labyrinth|crucible|beacon|embark|unveil|leverage|synergy|holistic|paramount|endeavor|utilize|facilitate|aforementioned|henceforth|comprehensive|multifaceted|paradigm|ever-evolving|realm|harness|vibrant|robust|compelling|navigate|crucial|nihayetinde|söylenebilir ki|değerlendirildiğinde|bilindiği üzere|öncelikle belirtmek gerekir|nezdinde|akabinde|münhasıran|paradigma|holistik|sinerji|kompleks|çokyönlü)\b/gi;

const AI_SLOP_PHRASES = /it's worth noting|in today's digital age|in the realm of|at the end of the day|it goes without saying|dive (deep )?into|şunu belirtmek gerekir|günümüz dijital çağında|sonuç olarak değerlendirildiğinde|nihai noktada|son tahlilde/gi;

export const aiSlopWordsRule = {
  id: 'penalty-ai-slop-words',
  name: 'AI Slop Word Detection',
  category: 'penalty',
  evaluate: (input) => {
    const wordMatches = input.text.match(AI_SLOP_WORDS);
    const phraseMatches = input.text.match(AI_SLOP_PHRASES);
    const count = (wordMatches?.length || 0) + (phraseMatches?.length || 0);
    if (count >= 4) {
      return {
        ruleId: 'penalty-ai-slop-words', triggered: true, points: -14, severity: 'critical',
        suggestion: `Yoğun AI yazım kalıbı (${count} işaret). Doğal sesinle yeniden yaz — AI metni etkileşim hızını öldürür.`,
      };
    }
    if (count >= 2) {
      return {
        ruleId: 'penalty-ai-slop-words', triggered: true, points: -7, severity: 'warning',
        suggestion: `AI yazım kalıbı tespit edildi (${count} işaret). Doğal sesinle yeniden yaz.`,
      };
    }
    return { ruleId: 'penalty-ai-slop-words', triggered: false, points: 0, severity: 'info' };
  },
};

const EM_DASH_REGEX = /\u2014/g;
const STRUCTURAL_OPENER = /^(Furthermore|Moreover|Additionally|In conclusion|It's worth noting|Bunun yanı sıra|Ek olarak|Sonuç olarak|Şunu belirtmek gerekir)/im;

export const aiSlopStructureRule = {
  id: 'penalty-ai-slop-structure',
  name: 'AI Slop Structure Detection',
  category: 'penalty',
  evaluate: (input) => {
    const text = input.text;
    let penalty = 0;
    const emDashCount = (text.match(EM_DASH_REGEX) || []).length;
    if (emDashCount >= 3) penalty -= 4;
    if (STRUCTURAL_OPENER.test(text)) penalty -= 4;
    if (penalty === 0) {
      return { ruleId: 'penalty-ai-slop-structure', triggered: false, points: 0, severity: 'info' };
    }
    return {
      ruleId: 'penalty-ai-slop-structure', triggered: true,
      points: Math.max(-8, penalty), severity: 'warning',
      suggestion: 'Yapısal AI kalıpları — kısa cümleler ve doğal geçişler kullan.',
    };
  },
};

const STALE_FORMULA = /^(Unpopular opinion:|Hot take:|Here's the thing:|Let that sink in|Read that again|This\.|Thread \u{1F9F5}|Popüler olmayan görüş:|Sıcak yorum:|Şunu söyleyeyim:|Bunu bir daha okuyun)/iu;

export const staleFormulaRule = {
  id: 'penalty-stale-formula',
  name: 'Stale Formula Detection',
  category: 'penalty',
  evaluate: (input) => {
    if (STALE_FORMULA.test(input.text)) {
      return {
        ruleId: 'penalty-stale-formula', triggered: true, points: -5, severity: 'warning',
        suggestion: 'Aşırı kullanılmış formül — düşük kalite sinyali. Taze hook bul.',
      };
    }
    return { ruleId: 'penalty-stale-formula', triggered: false, points: 0, severity: 'info' };
  },
};

const HEDGING_OPENER = /^(I think (maybe|perhaps)|It might be|Could be worth|Not sure (if|but)|Honest(ly)?,?\s|Belki|Sanırım|Emin değilim|Bilemiyorum|Şahsen)/i;

export const hedgingOpenerRule = {
  id: 'penalty-hedging-opener',
  name: 'Hedging Opener Detection',
  category: 'penalty',
  evaluate: (input) => {
    if (HEDGING_OPENER.test(input.text)) {
      return {
        ruleId: 'penalty-hedging-opener', triggered: true, points: -5, severity: 'warning',
        suggestion: 'Çekingen açılış hook\'u zayıflatır. İddianı cesurca ortaya koy — cesur iddialar 2x etkileşim alır.',
      };
    }
    return { ruleId: 'penalty-hedging-opener', triggered: false, points: 0, severity: 'info' };
  },
};
