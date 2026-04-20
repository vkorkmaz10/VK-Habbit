/**
 * ReachOS — VSE çıktısını X (Twitter) algoritması açısından puanlayan ve
 * iyileştirme talimatı üreten katman.
 *
 * Public API:
 *   scoreTweet(text) → { score, breakdown }
 *   buildBoostPrompt(originalText, breakdown) → string
 */

import { RULES } from '../config/reachos_rules';

/**
 * Verilen metni tüm kurallara karşı test eder, 0-100 arası skor döner.
 *
 * @param {string} text
 * @returns {{
 *   score: number,
 *   breakdown: Array<{
 *     id: string, weight: number, passed: boolean, severity: string,
 *     message: string, okMessage: string|undefined,
 *   }>
 * }}
 */
export function scoreTweet(text) {
  if (!text || typeof text !== 'string') {
    return { score: 0, breakdown: [] };
  }

  let score = 0;
  const breakdown = RULES.map(rule => {
    let passed = false;
    try {
      passed = !!rule.test(text);
    } catch {
      passed = false;
    }
    if (passed) score += rule.weight;
    return {
      id: rule.id,
      weight: rule.weight,
      severity: rule.severity,
      passed,
      message: rule.message,
      okMessage: rule.okMessage,
    };
  });

  return { score: Math.round(score), breakdown };
}

/**
 * Düşük skorlu kuralların boost talimatlarını birleştirir, 2. Gemini çağrısı
 * için user prompt üretir. System prompt aynı kalır (persona korunur).
 *
 * @param {string} originalText
 * @param {Array} breakdown
 * @returns {string}
 */
export function buildBoostPrompt(originalText, breakdown) {
  const failing = breakdown.filter(b => !b.passed);
  if (failing.length === 0) {
    // Skor zaten yüksek, sadece "biraz daha keskinleştir"
    return `Önceki tweet:\n"${originalText}"\n\nBu tweet'i Volkan'ın sesini koruyarak biraz daha keskin ve dikkat çekici yap. Sadece düzeltilmiş tweet'i yaz, açıklama ekleme.`;
  }

  const instructions = failing
    .map(b => {
      const rule = RULES.find(r => r.id === b.id);
      return `- ${rule?.boostInstruction || b.message}`;
    })
    .join('\n');

  return `Önceki tweet:
"${originalText}"

Bu tweet'te şu Reach kuralları ihlal edildi. Volkan'ın sesini ve persona kurallarını koruyarak yalnızca aşağıdaki ihlalleri düzelt:

${instructions}

Sadece düzeltilmiş yeni tweet metnini yaz. Açıklama, başlık veya meta bilgi ekleme.`;
}
