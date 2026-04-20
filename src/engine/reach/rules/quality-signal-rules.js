// Ported from AytuncYildizli/reach-optimizer (MIT)

const POSITIVE_WORDS = new Set([
  'love','amazing','incredible','awesome','great','excellent','fantastic','brilliant','beautiful',
  'wonderful','perfect','excited','thrilled','grateful','thankful','proud','inspired','inspiring',
  'helpful','valuable','powerful','impressive','remarkable','outstanding','game-changer',
  'breakthrough','milestone','achievement','win','congrats','congratulations','bravo','appreciate',
  'recommend','learned','growth','progress','opportunity','celebrate','happy','joy','hope',
  'optimistic','best',
  // Turkish
  'harika','muhteşem','inanılmaz','güzel','mükemmel','heyecanlı','minnettar','gururlu','ilham',
  'değerli','güçlü','etkileyici','başarı','tebrikler','öğrendim','büyüme','ilerleme','fırsat',
  'umut','iyimser',
]);

const NEGATIVE_WORDS = new Set([
  'hate','terrible','awful','horrible','disgusting','pathetic','useless','worthless','worst',
  'toxic','disaster','failure','ruined','destroyed','broken','annoying','frustrating',
  'disappointed','depressing','miserable','nightmare','scam','fraud','stealing','lying',
  'corrupt','incompetent','clueless','embarrassing','shameful','disgraceful','ridiculous',
  'absurd','outrageous','unacceptable','never','nobody','nothing',
  // Turkish
  'nefret','berbat','korkunç','iğrenç','yetersiz','değersiz','toksik','felaket','başarısız',
  'mahvolmuş','kırık','rahatsız','can sıkıcı','hayal kırıklığı','depresif','kabus','dolandırıcı',
  'çürük','beceriksiz','utanç verici','saçma','kabul edilemez','asla',
]);

const CONSTRUCTIVE_PATTERNS = /\b(here'?s how|how to|my advice|lesson|takeaway|what I learned|pro tip|the key is|try this|instead of|better way|tip:|insight:|işte nasıl|nasıl|önerim|ders|öğrendiğim|ipucu|anahtar|şunu dene|bunun yerine|daha iyi yol)\b/i;

const CYNICAL_PATTERNS = /\b(wake up|sheep|sheeple|clown world|cope|copium|mid|L take|ratio|cry about it|seethe|stay mad|die mad|uyan|koyun|palyaço|ratio yedi)\b/i;

export const sentimentToneRule = {
  id: 'quality-sentiment-tone',
  name: 'Sentiment & Tone',
  category: 'bonus',
  evaluate: (input) => {
    const words = input.text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    for (const word of words) {
      const clean = word.replace(/[^a-zçğıöşü-]/g, '');
      if (POSITIVE_WORDS.has(clean)) positiveCount++;
      if (NEGATIVE_WORDS.has(clean)) negativeCount++;
    }
    const hasConstructive = CONSTRUCTIVE_PATTERNS.test(input.text);
    const hasCynical = CYNICAL_PATTERNS.test(input.text);
    const netSentiment = positiveCount - negativeCount;

    if (hasCynical) {
      return {
        ruleId: 'quality-sentiment-tone', triggered: true, points: -5, severity: 'warning',
        suggestion: 'Sinik/küçümseyici ton — Grok yüksek etkileşimde bile negatifliği cezalandırır.',
      };
    }
    if (netSentiment <= -2 && negativeCount >= 3) {
      return {
        ruleId: 'quality-sentiment-tone', triggered: true, points: -4, severity: 'warning',
        suggestion: 'Negatif ton — yapıcı/pozitif içerik Grok altında daha geniş dağıtım alır.',
      };
    }
    if (hasConstructive && netSentiment >= 1) {
      return {
        ruleId: 'quality-sentiment-tone', triggered: true, points: 5, severity: 'positive',
        suggestion: 'Yapıcı, pozitif ton — Grok daha geniş dağıtımla ödüllendirir.',
      };
    }
    if (netSentiment >= 2 && positiveCount >= 2) {
      return {
        ruleId: 'quality-sentiment-tone', triggered: true, points: 3, severity: 'positive',
        suggestion: 'Pozitif ton tespit edildi — Grok sentiment skoruna yardımcı olur.',
      };
    }
    return { ruleId: 'quality-sentiment-tone', triggered: false, points: 0, severity: 'info' };
  },
};

function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 2) return 1;
  const vowelGroups = w.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;
  if (w.endsWith('e') && count > 1) count--;
  if (w.endsWith('le') && w.length > 2 && !/[aeiouy]/.test(w.charAt(w.length - 3))) count++;
  return Math.max(1, count);
}

function fleschKincaidGradeLevel(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.replace(/[^a-z]/gi, '').length > 0);
  if (sentences.length === 0 || words.length === 0) return 8;
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = totalSyllables / words.length;
  const grade = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  return Math.max(1, Math.min(16, grade));
}

export const readabilityRule = {
  id: 'quality-readability',
  name: 'Readability Score',
  category: 'structure',
  evaluate: (input) => {
    const text = input.text;
    if (text.length < 50) {
      return { ruleId: 'quality-readability', triggered: false, points: 0, severity: 'info' };
    }
    const grade = fleschKincaidGradeLevel(text);
    if (grade <= 8) {
      return { ruleId: 'quality-readability', triggered: true, points: 4, severity: 'positive', suggestion: 'Net, okunaklı dil — etkileşim için optimal.' };
    }
    if (grade <= 10) {
      return { ruleId: 'quality-readability', triggered: true, points: 1, severity: 'info' };
    }
    return {
      ruleId: 'quality-readability', triggered: true, points: -3, severity: 'warning',
      suggestion: `Okuma seviyesi: Sınıf ${Math.round(grade)} — çok karmaşık. Geniş erişim için sadeleştir.`,
    };
  },
};

const CONTRAST_PATTERNS = [
  /\$[\d,]+[MKBmkb]?.{0,30}\b0\b/,
  /\b0\b.{0,30}\$[\d,]+[MKBmkb]?/,
  /\b\d{3,}[MKBmkb]?.{0,30}\b(zero|none|nothing|0|sıfır|hiç)\b/i,
  /\b(zero|none|nothing|0|sıfır|hiç)\b.{0,30}\b\d{3,}[MKBmkb]?/i,
  /\b(months?|years?|weeks?|ay|yıl|hafta) ago.{0,40}(now|today|şimdi|bugün)/i,
  /\b(before|was|önce|önceden).{0,40}\b(after|now|today|became|sonra|şimdi|bugün|oldu)/i,
  /\b(everyone|they all|most people|herkes|çoğu insan)\s+(say|think|believe|der|düşünür|inanır).{0,40}\b(but|except|wrong|actually|reality|ama|aslında|gerçek)/i,
  /\b\d+\s*(years?|months?|weeks?|days?|hours?|yıl|ay|hafta|gün|saat).{0,30}(minutes?|seconds?|instantly|overnight|dakika|saniye|anında)/i,
];

export const contrastSurpriseRule = {
  id: 'hook-contrast-surprise',
  name: 'Contrast/Surprise Hook',
  category: 'hook',
  evaluate: (input) => {
    const firstPart = input.text.slice(0, 150);
    for (const pattern of CONTRAST_PATTERNS) {
      if (pattern.test(firstPart)) {
        return {
          ruleId: 'hook-contrast-surprise', triggered: true, points: 6, severity: 'positive',
          suggestion: 'Kontrast/sürpriz — beklenti kırma yüksek dwell time ve paylaşım çeker.',
        };
      }
    }
    return { ruleId: 'hook-contrast-surprise', triggered: false, points: 0, severity: 'info' };
  },
};
