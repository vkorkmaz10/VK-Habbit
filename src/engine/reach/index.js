/**
 * ReachOS v3.0 — Public API.
 * Replaces legacy src/engine/reachOS.js + src/config/reachos_rules.js.
 */

import { ScoreEngine } from './engine';
import { allClientRules, VOLKAN_PROTECTED_RULES } from './all-client-rules';

const engine = new ScoreEngine(allClientRules);

/**
 * Score a tweet.
 * @param {string} text
 * @param {object} opts - { hasMedia?: boolean, isThread?: boolean, threadLength?: number }
 * @returns {{
 *   reachScore: number,
 *   tier: string,
 *   breakdown: {hook, structure, engagement, penalties, bonuses},
 *   suggestions: Array,
 *   highlights: Array,
 *   rawResults: Array,
 * }}
 */
export function scoreTweet(text, opts = {}) {
  return engine.evaluate({
    text: text || '',
    hasMedia: !!opts.hasMedia,
    isThread: !!opts.isThread,
    threadLength: opts.threadLength,
  });
}

/**
 * Build prompt for boost (rewrite to fix violations) while preserving Volkan persona.
 * Skips Volkan-protected rules — those won't be "fixed".
 *
 * @param {string} originalText
 * @param {object} analysis - result of scoreTweet()
 * @returns {string}
 */
export function buildBoostPrompt(originalText, analysis) {
  const failingRules = (analysis.rawResults || [])
    .filter(r => r.triggered && r.points < 0)
    .filter(r => !VOLKAN_PROTECTED_RULES.has(r.ruleId));

  // Also include critical positive rules that didn't trigger but should
  const missingPositives = (analysis.rawResults || [])
    .filter(r => !r.triggered && r.suggestion)
    .filter(r => ['hook-open-loop', 'engagement-cta-presence', 'hook-number-data'].includes(r.ruleId));

  if (failingRules.length === 0 && missingPositives.length === 0) {
    return `Önceki tweet:\n"${originalText}"\n\nBu tweet'i Volkan'ın sesini koruyarak biraz daha keskin ve dikkat çekici yap. Sadece yeni tweet metnini yaz, açıklama ekleme.`;
  }

  const instructions = [
    ...failingRules.map(r => `- ${r.suggestion}`),
    ...missingPositives.map(r => `- Eksik fırsat: ${r.suggestion}`),
  ].join('\n');

  return `Önceki tweet:
"${originalText}"

Bu tweet'te şu Reach kuralları sorun çıkarıyor. Volkan'ın sesini ve persona kurallarını ("bana göre", "nacizane", "arkadaşlar" gibi imza ifadeleri ve VSE direktifleri) KORUYARAK yalnızca aşağıdaki ihlalleri düzelt:

${instructions}

Sadece düzeltilmiş yeni tweet metnini yaz. Açıklama, başlık, tırnak veya meta bilgi ekleme.`;
}

export { forecastReach, whatIfScenarios, isPeakHourUTC } from './forecast';
export { VOLKAN_PROTECTED_RULES } from './all-client-rules';
