/**
 * 𝕏 Score v1.0 — Public API.
 * 2026 X algoritması tabanlı tweet skorlama motoru.
 */

import { ScoreEngine } from './engine';
import { allRules, VOLKAN_PROTECTED } from './all-rules';

const engine = new ScoreEngine(allRules);

/**
 * Bir tweet'i skorla.
 * @param {string} text
 * @param {{ hasMedia?: boolean, isThread?: boolean, threadLength?: number }} opts
 * @returns {{ score, tier, breakdown: { conversation, spread, dwell, penalties }, suggestions, highlights, rawResults }}
 */
export function scorePost(text, opts = {}) {
  return engine.evaluate({
    text: text || '',
    hasMedia: !!opts.hasMedia,
    isThread: !!opts.isThread,
    threadLength: opts.threadLength,
  });
}

/**
 * Boost prompt'u üret — Volkan persona kuralları korunarak ihlalleri düzeltir.
 * @param {string} originalText
 * @param {object} analysis - scorePost() çıktısı
 * @returns {string}
 */
export function buildBoostPrompt(originalText, analysis) {
  const failingRules = (analysis.rawResults || [])
    .filter(r => r.triggered && r.points < 0)
    .filter(r => !VOLKAN_PROTECTED.has(r.ruleId));

  const missingPositives = (analysis.rawResults || [])
    .filter(r => !r.triggered && r.suggestion)
    .filter(r => ['dwell-open-loop', 'conv-direct-question', 'dwell-number-data', 'conv-choice-question'].includes(r.ruleId));

  if (failingRules.length === 0 && missingPositives.length === 0) {
    return `Önceki tweet:\n"${originalText}"\n\nBu tweet'i Volkan'ın sesini koruyarak biraz daha keskin ve dikkat çekici yap. Sadece yeni tweet metnini yaz, açıklama ekleme.`;
  }

  const instructions = [
    ...failingRules.map(r => `- ${r.suggestion}`),
    ...missingPositives.map(r => `- Eksik fırsat: ${r.suggestion}`),
  ].join('\n');

  return `Önceki tweet:
"${originalText}"

Bu tweet'te şu 𝕏 Skor kuralları sorun çıkarıyor. Volkan'ın sesini ve persona kurallarını ("bana göre", "nacizane", "arkadaşlar" gibi imza ifadeleri ve VSE direktifleri) KORUYARAK yalnızca aşağıdaki sorunları düzelt:

${instructions}

Sadece düzeltilmiş yeni tweet metnini yaz. Açıklama, başlık, tırnak veya meta bilgi ekleme.`;
}

export { forecastReach, whatIfScenarios, isPeakHourUTC } from './forecast';
export { VOLKAN_PROTECTED } from './all-rules';
