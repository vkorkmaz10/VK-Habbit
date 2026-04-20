// Ported from AytuncYildizli/reach-optimizer (MIT)

const OPEN_LOOP_PATTERN = /:\s*$|—\s*$|\.\.\.\s*$|here'?s (what|how|why)|let me explain|şunu anlatayım|işte (nasıl|neden)/i;

export const openLoopRule = {
  id: 'hook-open-loop',
  name: 'Open Loop Hook',
  category: 'hook',
  evaluate: (input) => {
    const firstLine = input.text.split('\n')[0];
    if (OPEN_LOOP_PATTERN.test(firstLine)) {
      return {
        ruleId: 'hook-open-loop', triggered: true, points: 10, severity: 'positive',
        suggestion: 'Açık döngü — merak boşluğu yaratır. En viral hook kalıbı.',
      };
    }
    return { ruleId: 'hook-open-loop', triggered: false, points: 0, severity: 'info' };
  },
};

const CONTRARIAN_PATTERN = /\b(overrated|underrated|wrong about|nobody talks about|unpopular|controversial|against the grain|myth|lie|truth is|fazla değerli|az değerli|kimse konuşmuyor|aksine|yanlış biliniyor|aslında)\b/i;

export const contrarianClaimRule = {
  id: 'hook-contrarian-claim',
  name: 'Contrarian Claim Hook',
  category: 'hook',
  evaluate: (input) => {
    const first80 = input.text.slice(0, 80);
    if (CONTRARIAN_PATTERN.test(first80)) {
      return {
        ruleId: 'hook-contrarian-claim', triggered: true, points: 7, severity: 'positive',
        suggestion: 'Karşıt iddia — tartışma ve yanıt çeker (27x algoritma ağırlığı).',
      };
    }
    return { ruleId: 'hook-contrarian-claim', triggered: false, points: 0, severity: 'info' };
  },
};

const STORY_OPENER = /^(Last (week|month|year)|Yesterday|2 (months|years|weeks) ago|I (just|recently|spent|built|quit|lost|made|earned|saved|launched|shipped|failed)|Back in 20\d{2}|When I was|True story:|A few (months|weeks|years) ago|Geçen (hafta|ay|yıl)|Dün|\d+ (yıl|ay|hafta) önce|20\d{2}'de|Çocukken|Gerçek hikaye)/i;

export const storyOpenerRule = {
  id: 'hook-story-opener',
  name: 'Story Opener Hook',
  category: 'hook',
  evaluate: (input) => {
    const first80 = input.text.slice(0, 80);
    if (STORY_OPENER.test(first80)) {
      return {
        ruleId: 'hook-story-opener', triggered: true, points: 6, severity: 'positive',
        suggestion: 'Hikaye açılışı — kişisel anlatımlar 2-3x daha fazla etkileşim alır.',
      };
    }
    return { ruleId: 'hook-story-opener', triggered: false, points: 0, severity: 'info' };
  },
};

const PATTERN_INTERRUPT = /^(Stop |Never |Don't |Quit |Forget |Avoid |Skip |Delete |Remove |Ditch |Bırak |Asla |Yapma |Unutma |Sakın |Vazgeç )/i;

export const patternInterruptRule = {
  id: 'hook-pattern-interrupt',
  name: 'Pattern Interrupt Hook',
  category: 'hook',
  evaluate: (input) => {
    if (PATTERN_INTERRUPT.test(input.text)) {
      return {
        ruleId: 'hook-pattern-interrupt', triggered: true, points: 7, severity: 'positive',
        suggestion: 'Pattern interrupt — scroll kalıbını bozar. Güçlü hook.',
      };
    }
    return { ruleId: 'hook-pattern-interrupt', triggered: false, points: 0, severity: 'info' };
  },
};

const BOLD_CLAIM = /^(The (best|worst|biggest|fastest|most|only|single|real|true|#1)|No one|Everyone|Every single|There is no|Nothing beats|This is the|The entire|En (iyi|kötü|büyük|hızlı|tek|gerçek)|Hiç kimse|Herkes|Tek bir)/i;

export const boldClaimRule = {
  id: 'hook-bold-claim',
  name: 'Bold Claim Hook',
  category: 'hook',
  evaluate: (input) => {
    const first80 = input.text.slice(0, 80);
    if (BOLD_CLAIM.test(first80)) {
      return {
        ruleId: 'hook-bold-claim', triggered: true, points: 5, severity: 'positive',
        suggestion: 'Cesur iddia — güçlü beyan cümleleri etkileşimi artırır.',
      };
    }
    return { ruleId: 'hook-bold-claim', triggered: false, points: 0, severity: 'info' };
  },
};

const LIST_PROMISE = /\b\d+\s*(things|ways|tips|lessons|rules|steps|mistakes|reasons|habits|secrets|signs|tools|strategies|methods|principles|frameworks|hacks|takeaways|şey|yol|ipucu|ders|kural|adım|hata|sebep|alışkanlık|sır|işaret|araç|strateji|yöntem|prensip|çıkarım)\b/i;

export const listPromiseRule = {
  id: 'hook-list-promise',
  name: 'List Promise Hook',
  category: 'hook',
  evaluate: (input) => {
    const firstLine = input.text.split('\n')[0];
    if (LIST_PROMISE.test(firstLine)) {
      return {
        ruleId: 'hook-list-promise', triggered: true, points: 6, severity: 'positive',
        suggestion: 'Liste vaadi — kaydedilebilir format (bookmark = 20x like).',
      };
    }
    return { ruleId: 'hook-list-promise', triggered: false, points: 0, severity: 'info' };
  },
};

const COMPOUND_NUMBER = /\$[\d,]+|\d+%|\b\d{2,}\b/;
const COMPOUND_OPEN_LOOP = /:\s*$|—\s*$|\.\.\.\s*$|here'?s (what|how|why)/i;
const COMPOUND_CONTRARIAN = /\b(overrated|underrated|wrong about|nobody talks about|unpopular|controversial|myth|lie|aksine|yanlış)\b/i;
const COMPOUND_STORY = /^(Last |Yesterday|I (just|recently|spent|built|quit|lost|made)|Back in 20|When I was|True story:|Geçen|Dün|\d+ (yıl|ay) önce)/i;
const COMPOUND_INTERRUPT = /^(Stop |Never |Don't |Quit |Forget |Avoid |Skip |Bırak |Asla |Yapma )/i;
const COMPOUND_BOLD = /^(The (best|worst|biggest|fastest|most|only|single)|No one|Everyone|Every single|En (iyi|kötü|büyük)|Hiç kimse|Herkes)/i;
const COMPOUND_CONTRAST = /\b(million|billion|\d{3,}|zero|0\b|milyon|milyar|sıfır).{0,30}\b(zero|0\b|million|billion|\d{3,}|none|nothing|sıfır|milyon|milyar|hiç)/i;

export const compoundHookRule = {
  id: 'hook-compound-quality',
  name: 'Compound Hook Quality',
  category: 'hook',
  evaluate: (input) => {
    const first80 = input.text.slice(0, 80);
    const firstLine = input.text.split('\n')[0];
    const first150 = input.text.slice(0, 150);
    let signals = 0;
    if (COMPOUND_NUMBER.test(first80)) signals++;
    if (COMPOUND_OPEN_LOOP.test(firstLine)) signals++;
    if (COMPOUND_CONTRARIAN.test(first80)) signals++;
    if (COMPOUND_STORY.test(first80)) signals++;
    if (COMPOUND_INTERRUPT.test(input.text)) signals++;
    if (COMPOUND_BOLD.test(first80)) signals++;
    if (LIST_PROMISE.test(firstLine)) signals++;
    if (COMPOUND_CONTRAST.test(first150)) signals++;
    if (signals >= 2) {
      return {
        ruleId: 'hook-compound-quality', triggered: true, points: 7, severity: 'positive',
        suggestion: 'Çoklu hook sinyali — bileşik hook\'lar en viral kalıptır.',
      };
    }
    return { ruleId: 'hook-compound-quality', triggered: false, points: 0, severity: 'info' };
  },
};
