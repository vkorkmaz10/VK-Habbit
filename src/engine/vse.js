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
[SINIFLANDIRMA]: Önce haberi zihninde sınıflandır:
- Kategori: macro (ETF, FED, regülasyon) | project (ortaklık, lansman) | onchain (miner, whale, veri) | sentiment (hype, narrativ) | other
- Etki: high | medium | low
- Piyasa yönelimi: bullish | bearish | neutral | mixed
Bu sınıflandırmayı içeriğe yansıt — ton buradan doğsun. Sınıflandırmayı yazıya dökmene gerek yok, sadece kullan.`;

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
- Maksimum 280 karakter
- Yapı: güçlü açılış → ana insight → çatışma/nüans → yumuşak sonuç
- Maksimum 1 emoji
- Gereksiz giriş cümlesi yok
- Hashtag spam yok${goldenExamples}`;
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

function buildUserPrompt(newsInput, mode) {
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
    userPrompt: buildUserPrompt(newsInput, 'tweet'),
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
    userPrompt: buildUserPrompt(newsInput, 'thread'),
  };
}

export { STYLE_CONFIG };
