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
import { VOLKAN_BASE, CLASSIFICATION_BLOCK, STYLE_CONFIG } from '../config/vse_prompts';

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

// STYLE_CONFIG is imported from '../config/vse_prompts' and re-exported for consumers
export { STYLE_CONFIG };
