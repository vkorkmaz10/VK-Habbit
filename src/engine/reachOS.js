/**
 * ReachOS — DEPRECATED shim. Re-exports v3.0 engine from src/engine/reach/.
 *
 * Yeni kod doğrudan `import { scoreTweet, ... } from './reach'` kullansın.
 * Bu dosya geriye dönük uyumluluk için kalmıştır.
 */

export {
  scoreTweet,
  buildBoostPrompt,
  forecastReach,
  whatIfScenarios,
  isPeakHourUTC,
  VOLKAN_PROTECTED_RULES,
} from './reach';
