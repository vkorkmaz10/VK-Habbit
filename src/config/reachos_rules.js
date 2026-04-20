/**
 * ReachOS Rules — X (Twitter) algoritma sinyallerine dayalı reach optimizasyon kuralları.
 *
 * Her kural:
 *  - id: benzersiz tanımlayıcı
 *  - weight: 0-100 toplam puana katkısı (toplam tüm weight'ler = 100)
 *  - test(text) → boolean: kural geçti mi?
 *  - severity: 'high' | 'med' | 'low' — UI sıralaması için
 *  - message: kullanıcıya gösterilen kısa açıklama (düşerse)
 *  - okMessage: kural geçtiğinde gösterilecek kısa onay (opsiyonel)
 *  - boostInstruction: "Reach'i Artır" çağrısında Gemini'ye verilen düzeltme talimatı
 */

// AI/bot-tarzı kelimeler — Volkan'ın doğal sesini bozanlar
const SLOP_PATTERNS = [
  // İngilizce
  /\bdelve into\b/i, /\bleverage\b/i, /\bnavigate the landscape\b/i,
  /\bin conclusion\b/i, /\bmoreover\b/i, /\bunleash\b/i, /\bharness\b/i,
  /\bgame[- ]changer\b/i, /\bseamless\b/i, /\bcutting[- ]edge\b/i,
  /\bgroundbreaking\b/i, /\brevolutionize\b/i, /\bsynergy\b/i,
  /\bparadigm shift\b/i, /\btransformative\b/i, /\brobust solution\b/i,
  /\bin today'?s fast[- ]paced\b/i,
  // Türkçe AI tarzı klişeler
  /\bbilindi[ğg]i [üu]zere\b/i, /\bg[öo]zden ka[çc][ıi]r[ıi]lmamal[ıi]\b/i,
  /\ben nihayetinde\b/i, /\bs[öo]ylenebilir ki\b/i,
  /\bka[çc][ıi]n[ıi]lmaz olarak\b/i, /\bd[ee][ğg]erlendirildi[ğg]inde\b/i,
];

// Hook açılış kalıpları — ilk cümle/kelime
const HOOK_OPENERS = [
  /^[^.!?\n]{0,140}\?/,                                    // ilk cümlede soru
  /^(sence|neden|niye|nas[ıi]l|ne zaman|hangi|kim|ka[çc])\b/i, // soru kelimesi
  /^(asla|hi[çc]bir|kimse|herkes|tek|tarihte ilk|son)\b/i, // güçlü iddia
  /^(\$?\d+[.,]?\d*\s?(%|k|m|b|milyon|milyar|bin)?\b)/i,    // sayıyla başla
  /^(d[üu][şs][üu]n)\b/i,                                  // "düşün ki..."
];

// CTA / etkileşim tetikleyici kelimeler
const CTA_PATTERNS = [
  /\?[\s🤔🧐💭]*$/mu,                 // soru işareti ile biten satır
  /\bsence\b/i, /\bne d[üu][şs][üu]n/i,
  /\bkaydet\b/i, /\brt\b/i, /\bpaylaş/i,
  /\byorumla/i, /\bsiz nas[ıi]l\b/i,
];

// Bookmark-worthy formatlar (numaralı liste, framework, şu N şey)
const BOOKMARK_PATTERNS = [
  /^\s*\d+[.)]\s+/m,                        // "1. " veya "1) " satır başında
  /\b[şs]u (\d+|[üu][çc]|d[öo]rt|be[şs]|alt[ıi]) /i, // "şu 3", "şu 5"
  /\b(framework|sistem|y[öo]ntem|formul|ad[ıi]m|kural)\b/i,
  /^[•\-–]\s+/m,                            // madde işareti
];

// Emoji sayım regex'i (pictographic karakterler)
const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

// URL detection
const URL_REGEX = /https?:\/\/\S+/g;

// Hashtag
const HASHTAG_REGEX = /(?:^|\s)#\w+/g;

// ─── KURALLAR ────────────────────────────────────────────────────────────────

export const RULES = [
  {
    id: 'hook_strong',
    weight: 20,
    severity: 'high',
    test: (text) => {
      const firstChunk = text.trim().slice(0, 140);
      return HOOK_OPENERS.some(re => re.test(firstChunk));
    },
    message: 'Hook zayıf — ilk cümle merak uyandırmıyor',
    okMessage: 'Güçlü hook',
    boostInstruction:
      "Tweet'in ilk cümlesini bir soru, somut sayı veya karşıt iddia ile başlat. Okuyucuyu durdursun.",
  },
  {
    id: 'link_at_end',
    weight: 15,
    severity: 'high',
    test: (text) => {
      const matches = [...text.matchAll(URL_REGEX)];
      if (matches.length === 0) return true; // link yoksa ceza yok
      const lastIdx = matches[matches.length - 1].index;
      // Son URL metnin son %25'inde olmalı
      return lastIdx / Math.max(text.length, 1) > 0.75;
    },
    message: 'Link metnin ortasında — algoritma cezalandırıyor',
    okMessage: 'Link sonda',
    boostInstruction:
      "Tweet'teki link(ler)i sadece tweetin EN SONUNA koy. Link'i metnin ortasından çıkar, son satıra taşı.",
  },
  {
    id: 'no_hashtag_spam',
    weight: 10,
    severity: 'med',
    test: (text) => (text.match(HASHTAG_REGEX) || []).length <= 1,
    message: 'Çok hashtag var (max 1 önerilir)',
    okMessage: 'Hashtag temiz',
    boostInstruction: "Tweet'teki tüm hashtag'leri kaldır veya en fazla 1 taneye indir.",
  },
  {
    id: 'no_slop_words',
    weight: 15,
    severity: 'high',
    test: (text) => !SLOP_PATTERNS.some(re => re.test(text)),
    message: 'AI/bot tarzı kelimeler tespit edildi',
    okMessage: 'Doğal dil',
    boostInstruction:
      "Tweet'teki yapay/bot tarzı ifadeleri (delve, leverage, bilindiği üzere, en nihayetinde, söylenebilir ki vb.) çıkar. Volkan'ın doğal Türkçesini kullan.",
  },
  {
    id: 'cta_present',
    weight: 10,
    severity: 'med',
    test: (text) => CTA_PATTERNS.some(re => re.test(text)),
    message: 'Etkileşim çağrısı yok (soru veya CTA ekle)',
    okMessage: 'CTA mevcut',
    boostInstruction:
      "Tweet'in sonuna doğal bir soru veya etkileşim çağrısı ekle ('Sence?', 'Ne düşünüyorsun?', 'Kaydet' gibi). Forced olmasın.",
  },
  {
    id: 'bookmark_worthy',
    weight: 10,
    severity: 'med',
    test: (text) => BOOKMARK_PATTERNS.some(re => re.test(text)),
    message: 'Kaydedilesi format değil (liste/framework yok)',
    okMessage: 'Kaydedilesi format',
    boostInstruction:
      "Mümkünse içeriği numaralı liste veya 'şu 3 şey' / 'X adımda' gibi kaydedilebilir bir formata sok. İçerik buna uygun değilse zorlama.",
  },
  {
    id: 'emoji_balanced',
    weight: 5,
    severity: 'low',
    test: (text) => (text.match(EMOJI_REGEX) || []).length <= 2,
    message: 'Çok emoji var (max 2 önerilir)',
    okMessage: 'Emoji dengeli',
    boostInstruction: "Tweet'teki emoji sayısını maksimum 2'ye indir. Volkan minimal emoji kullanır.",
  },
  {
    id: 'character_efficient',
    weight: 10,
    severity: 'med',
    test: (text) => {
      const len = text.length;
      return len >= 140 && len <= 275; // 140-275 sweet spot
    },
    message: 'Karakter aralığı verimsiz (140-275 arası tercih edilir)',
    okMessage: 'Karakter optimum',
    boostInstruction:
      "Tweet'i 140-275 karakter aralığına getir. Çok kısaysa içerik zenginleştir, çok uzunsa gereksiz kelimeleri çıkar.",
  },
  {
    id: 'line_break_breathable',
    weight: 5,
    severity: 'low',
    test: (text) => {
      // Uzun (>180) tweet'lerde en az 1 satır boşluğu olmalı (\n\n)
      if (text.length <= 180) return true;
      return /\n\s*\n/.test(text) || (text.match(/\n/g) || []).length >= 2;
    },
    message: 'Uzun tweet için satır boşluğu yok (okunabilirlik düşük)',
    okMessage: 'Okunabilir yapı',
    boostInstruction:
      "Tweet'i okunabilir bloklara böl. Anahtar cümleler arasına boş satır koy.",
  },
  {
    id: 'no_caps_shouting',
    weight: 5,
    severity: 'low',
    test: (text) => {
      // 4+ harfli ALL CAPS kelime sayısı ≤ 1
      const caps = text.match(/\b[A-ZÇĞİÖŞÜ]{4,}\b/g) || [];
      return caps.length <= 1;
    },
    message: 'BÜYÜK HARF SPAM — sansasyonel duruyor',
    okMessage: 'Ton dengeli',
    boostInstruction:
      "Tweet'teki ALL CAPS (büyük harfli) kelimeleri normal yazıma döndür. Sadece coin tickerları (BTC, ETH gibi) büyük kalabilir.",
  },
];

// Toplam weight kontrolü (geliştirici sanity check)
// Tüm weight'lerin toplamı 100 olmalı
