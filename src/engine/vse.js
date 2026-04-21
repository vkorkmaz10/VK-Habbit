/**
 * VSE – Volkan Style Engine
 * Pure JS module. No React, no API calls. Builds prompts only.
 *
 * Exports:
 *   buildTweetPrompt(newsInput, style)  → { systemPrompt, userPrompt }
 *   buildThreadPrompt(newsInput, style) → { systemPrompt, userPrompt }
 *   buildGoldenExamplesFromFeedback(mode, style) → string (injected into system prompt)
 */

import { getFeedbackLog } from '../utils/storage';

// ─── Style Config ───────────────────────────────────────────────────────────

const STYLE_CONFIG = {
  prime: {
    label: 'Dengeli',
    description: 'Sakin, analitik, risk dengeli',
    tone: 'balanced',
    sharpness: 0.6,
    emotion: 0.4,
    toneDesc: 'Dengeli ve sakin bir ton kullan. Ne abartılı iyimser ne de gereksiz karamsar. Her iki tarafı da göster.',
  },
  viral: {
    label: 'Viral',
    description: 'Hafif sert, dikkat çekici, keskin',
    tone: 'slightly provocative',
    sharpness: 0.8,
    emotion: 0.6,
    toneDesc: 'Hafif sert, dikkat çekici ve keskin bir dil kullan. Provoke edici ama manipülatif değil. Okuyucuyu durduracak bir açılış yap.',
  },
  clean: {
    label: 'Sade',
    description: 'Net, profesyonel, az süslü',
    tone: 'professional',
    sharpness: 0.4,
    emotion: 0.2,
    toneDesc: 'Net, profesyonel ve sade bir dil kullan. Süslü ifade yok, direkt nokta. Gazeteci gibi yaz.',
  },
};

// ─── Volkan Base Identity ────────────────────────────────────────────────────

const VOLKAN_BASE = `Sen Volkan Korkmaz (@vkorkmaz10) için içerik üretiyorsun.

VOLKAN KİMDİR:
- 2017'den beri aktif kripto yatırımcısı ve trader
- Altcointurk kurucu ortağı, KriptoCuma organizatörü
- Borsa İstanbul çalışanı, programcı, girişimci

VOLKAN'IN SESİ:
- Direkt ve özlü — lafı dolandırmaz
- Analitik ama erişilebilir — teknik bilgiyi sade dille aktarır
- Güven veren — yıllık piyasa deneyiminden gelen özgüven
- Topluluk odaklı — "biz", "hep birlikte göreceğiz" doğal gelir
- Türkçe ama global bakış açısı

VOLKAN FİLTRESİ – BUNLARI KALDIR:
- Kesin yön tahmini ("Bu coin 100x yapar!")
- Abartı / hype dili
- Clickbait başlıklar
- ALL CAPS sensasyonalizm
- Coin fiyat tabloları

VOLKAN FİLTRESİ – BUNLARI UYGULA:
- Her zaman opsiyon bırak, senaryo sun
- Riski açıkça belirt
- Sade anlat, basit cümleler kur
- Gerekirse kişisel yorum ekle ("bana göre", "nacizane")
- Finansal tavsiye çerçevesi: "kendi araştırmanı yap"`;

// ─── Classification Instruction ─────────────────────────────────────────────

const CLASSIFICATION_BLOCK = `
[İÇ ANALİZ — ÇIKTIYA YAZMA]: Yazmadan önce haberin makro/proje/onchain/sentiment etkisini ve piyasa yönelimini zihninde değerlendir. Bu değerlendirmeyi doğrudan tona yansıt. Hiçbir etiket, başlık veya meta bilgi çıktıya girmesin.`;

// ─── ReachOS Directives (Tweet için) ────────────────────────────────────────
// X (Twitter) algoritmasının cezalandırdığı/ödüllendirdiği faktörler.
// Bu blok yalnızca tek tweet üretiminde enjekte edilir; thread'de değil.

const REACHOS_DIRECTIVES = `
[REACH OPTİMİZASYONU — X ALGORİTMASI]
- İlk cümle merak uyandırsın: soru, somut sayı veya karşıt iddia ile başla. Düz bilgi cümlesi açılışı yasak.
- Link varsa SADECE en sona koy. Metnin ortasındaki link erişimi düşürür.
- Hashtag kullanma; zorunluysa maksimum 1 tane.
- Yapay/AI tarzı ifadeler yasak: "delve into", "leverage", "navigate the landscape", "in conclusion", "bilindiği üzere", "en nihayetinde", "söylenebilir ki", "değerlendirildiğinde".
- Karakter aralığı: SWEET SPOT 71-110 (en yüksek etkileşim), İYİ 111-280 (bağlamlı içerik). Hesap Premium olduğu için 280 sınırı YOK ama uzatma diye padding/giriş cümlesi/tekrar yasak.
- 280'i AŞARSAN: ilk 280 karakter "Daha fazla göster" kesim noktasıdır → o kısım stand-alone okutmalı (hook + ana fikir). Devamı sadece DEĞER eklerse yaz (somut veri, açıklayıcı örnek). Boş yere uzatma.
- 700+ karakter gerekiyorsa thread'e böl, tek tweet olarak gönderme.
- Doğal CTA: "Sence?", "Ne düşünüyorsun?", "Kaydet" — forced değil, organik.
- Uzun tweet'lerde okunabilirlik için satır boşluğu bırak.
- ALL CAPS spam yok (sadece coin tickerları büyük kalabilir: BTC, ETH).
- Mümkünse kaydedilebilir format (numaralı liste, "şu 3 şey", framework).`;

// ─── Golden Examples from Feedback ──────────────────────────────────────────

export function buildGoldenExamplesFromFeedback(mode, style) {
  try {
    const log = getFeedbackLog();
    const relevant = log
      .filter(e => e.mode === mode && e.style === style && e.edited)
      .slice(-3); // son 3 düzenleme

    if (relevant.length === 0) return '';

    const examples = relevant
      .map(e => `"${e.edited.slice(0, 400)}"`)
      .join('\n---\n');

    return `\n\nALTIN ÖRNEKLER (kullanıcının düzenlediği gerçek içerikler — bu tonu ve yapıyı taklit et):\n${examples}`;
  } catch {
    return '';
  }
}

// ─── System Prompt Builders ──────────────────────────────────────────────────

function getTweetSystemPrompt(style) {
  const cfg = STYLE_CONFIG[style] || STYLE_CONFIG.prime;
  const goldenExamples = buildGoldenExamplesFromFeedback('tweet', style);

  return `${VOLKAN_BASE}
${CLASSIFICATION_BLOCK}

[GÖREV]: Tek bir tweet üret.

[STIL: ${cfg.label.toUpperCase()}]:
${cfg.toneDesc}

FORMAT KURALLARI:
- Türkçe yaz, her zaman
- Hedef uzunluk: 71-280 karakter (ideal). Hesap Premium → sert 280 sınırı yok, ama UZUNLUK İÇİN UZATMA YASAK. Sadece içerik gerçekten daha uzun açıklamayı hak ediyorsa 280-560 arası yazabilirsin.
- 560+ yazma; o noktada thread daha doğru.
- Yapı: güçlü açılış → ana insight → çatışma/nüans → yumuşak sonuç
- Maksimum 1 emoji
- Gereksiz giriş cümlesi yok ("Bugün size...", "Şunu söyleyeyim ki..." gibi padding yasak)
- Hashtag spam yok
${REACHOS_DIRECTIVES}${goldenExamples}`;
}

function getThreadSystemPrompt(style) {
  const cfg = STYLE_CONFIG[style] || STYLE_CONFIG.prime;
  const goldenExamples = buildGoldenExamplesFromFeedback('thread', style);

  return `${VOLKAN_BASE}
${CLASSIFICATION_BLOCK}

[GÖREV]: Derinlemesine bir thread üret. Tweet özeti değil — katmanlı analiz.

[STIL: ${cfg.label.toUpperCase()}]:
${cfg.toneDesc}

[KAYNAK ZORUNLULUĞU]: Haberin içeriğindeki spesifik verileri, sayıları, tarihleri ve şirket isimlerini MUTLAKA kullan. Veri uydurmak kesinlikle yasak.

THREAD YAPISI — minimum 5, maksimum 10 tweet. Konunun derinliğine göre karar ver:
- Basit haber (tek gelişme) → 5-6 tweet
- Orta derinlik (birden fazla boyut) → 7-8 tweet
- Karmaşık konu (çok faktörlü, senaryo gerektiren) → 9-10 tweet

Kullanabileceğin bloklar (hepsini kullanmak zorunda değilsin, konuya göre seç):
• intro — headline'ı kır, merak uyandır. Okutmalık açılış.
• explainContext — olayın arka planı, neden şimdi önemli
• expandDriver: bull — yükseliş argümanı (haberdeki veriye dayalı)
• expandDriver: bear — risk faktörleri, görmezden gelinen detaylar
• addExtraData — haber içeriğinden spesifik veri/sayı/tarih/şirket
• interpretConflict — neden aynı anda bullish ve bearish olunabilir
• scenarioA — olası pozitif senaryo
• scenarioB — olası negatif senaryo
• personalTake — Volkan'ın yorumu ("bana göre" tarzında, kesin değil)
• conclusion — açık kapı bırakan kapanış, "Sizce?" ile bitir

ZORUNLU: intro ile başla, conclusion ile bitir. Aradakileri konuya göre seç.

FORMAT KURALLARI:
- Türkçe yaz, her zaman
- Her tweet 1/ formatında numaralanmış (toplam sayısız: "1/" değil "1/7" gibi)
- Her tweet max 280 karakter
- 🧵 hook ile başla (ilk tweetin başına)
- Emoji minimal, anlamlı${goldenExamples}`;
}

// ─── User Prompt Builder ─────────────────────────────────────────────────────

function buildUserPrompt(newsInput) {
  const { title, content, source } = newsInput;
  const contentBlock = content
    ? `\n\nHaber içeriği:\n${content.slice(0, 1200)}`
    : '';
  const sourceBlock = source ? `\nKaynak: ${source}` : '';

  return `Başlık: "${title}"${sourceBlock}${contentBlock}\n\nİçeriği üret.`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Builds tweet prompt for a given style.
 * @param {object} newsInput - { title, content?, source?, style? }
 * @param {string} style - 'prime' | 'viral' | 'clean'
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildTweetPrompt(newsInput, style = 'prime') {
  return {
    systemPrompt: getTweetSystemPrompt(style),
    userPrompt: buildUserPrompt(newsInput),
  };
}

/**
 * Builds thread prompt for a given style.
 * @param {object} newsInput - { title, content?, source? }
 * @param {string} style - 'prime' | 'viral' | 'clean'
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildThreadPrompt(newsInput, style = 'prime') {
  return {
    systemPrompt: getThreadSystemPrompt(style),
    userPrompt: buildUserPrompt(newsInput),
  };
}

export { STYLE_CONFIG };
