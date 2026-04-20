// Aggregates all 36 rules. Order matches original repo for consistency.

import {
  genericHookRule, hookLengthRule, numberDataHookRule,
  multiSentenceHookRule, firstPersonVoiceRule,
} from './rules/hook-rules';
import {
  openLoopRule, contrarianClaimRule, storyOpenerRule,
  patternInterruptRule, boldClaimRule, listPromiseRule, compoundHookRule,
} from './rules/advanced-hook-rules';
import {
  characterLengthRule, hashtagCountRule, emojiCountRule,
  threadLengthRule, lineBreaksRule,
} from './rules/structure-rules';
import { ctaPresenceRule, bookmarkValueRule } from './rules/engagement-rules';
import { engagementBaitRule, textWallRule } from './rules/penalty-rules';
import { linkDetectionRule } from './rules/link-detection';
import {
  aiSlopWordsRule, aiSlopStructureRule, staleFormulaRule, hedgingOpenerRule,
} from './rules/ai-detection-rules';
import {
  sentimentToneRule, readabilityRule, contrastSurpriseRule,
} from './rules/quality-signal-rules';
import {
  choiceQuestionRule, deadEndingRule, combativeToneRule,
  mediaPresenceRule, grammarCheckRule, hashtagPlacementRule, allCapsSpamRule,
} from './rules/reply-potential-rules';

export const allClientRules = [
  // Hook
  genericHookRule, hookLengthRule, numberDataHookRule,
  multiSentenceHookRule, firstPersonVoiceRule,
  // Advanced hook
  openLoopRule, contrarianClaimRule, storyOpenerRule,
  patternInterruptRule, boldClaimRule, listPromiseRule, compoundHookRule,
  contrastSurpriseRule,
  // Structure
  characterLengthRule, hashtagCountRule, emojiCountRule,
  threadLengthRule, lineBreaksRule, readabilityRule,
  // Engagement
  ctaPresenceRule, bookmarkValueRule, choiceQuestionRule,
  // Penalty
  linkDetectionRule, engagementBaitRule, textWallRule,
  aiSlopWordsRule, aiSlopStructureRule, staleFormulaRule, hedgingOpenerRule,
  deadEndingRule, combativeToneRule, hashtagPlacementRule, allCapsSpamRule,
  // Bonus / quality
  mediaPresenceRule, grammarCheckRule, sentimentToneRule,
];

// Rules that should NOT be auto-corrected by boost (Volkan persona protection)
export const VOLKAN_PROTECTED_RULES = new Set([
  'penalty-hedging-opener',     // "bana göre", "nacizane" — Volkan imzası
  'penalty-combative-tone',     // Viral stilde gerekli olabilir
  'engagement-cta-presence',    // CTA Volkan tarzında zaten doğal
]);
