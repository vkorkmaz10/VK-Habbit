/**
 * 𝕏 Score — Tüm kurallar tek array'de.
 * Boost'ta persona koruması için VOLKAN_PROTECTED_RULES set'i.
 */

import {
  choiceQuestionRule,
  directQuestionRule,
  contrarianRule,
  openQuestionRule,
  rhetoricalRule,
  deadEndRule,
  engagementBaitRule,
} from './rules/conversation-rules';

import {
  bookmarkFormatRule,
  shareableClaimRule,
  mediaRule,
  firstPersonRule,
  staleFormulaRule,
  hashtagSpamRule,
} from './rules/spread-rules';

import {
  openLoopRule,
  numberDataRule,
  storyOpenerRule,
  lineBreaksRule,
  charLengthRule,
  textWallRule,
  genericHookRule,
} from './rules/dwell-rules';

import {
  externalLinkRule,
  aiSlopRule,
  offensiveRule,
  aiStructureRule,
  allCapsRule,
  hashtagStartRule,
  grammarRule,
} from './rules/penalty-rules';

export const allRules = [
  // Conversation
  choiceQuestionRule,
  directQuestionRule,
  contrarianRule,
  openQuestionRule,
  rhetoricalRule,
  deadEndRule,
  engagementBaitRule,
  // Spread
  bookmarkFormatRule,
  shareableClaimRule,
  mediaRule,
  firstPersonRule,
  staleFormulaRule,
  hashtagSpamRule,
  // Dwell
  openLoopRule,
  numberDataRule,
  storyOpenerRule,
  lineBreaksRule,
  charLengthRule,
  textWallRule,
  genericHookRule,
  // Penalty
  externalLinkRule,
  aiSlopRule,
  offensiveRule,
  aiStructureRule,
  allCapsRule,
  hashtagStartRule,
  grammarRule,
];

/**
 * Boost akışında bu kurallar atlanır — Volkan'ın imzası ya da tarz gereği.
 */
export const VOLKAN_PROTECTED = new Set([
  'conv-dead-end',    // Volkan bazen kasıtlı açık bırakır
  'pen-offensive',    // Volkan tarzında bazen gerekli
  'conv-rhetorical',  // Volkan imzası
]);
