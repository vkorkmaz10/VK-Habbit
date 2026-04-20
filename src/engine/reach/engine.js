// Ported from AytuncYildizli/reach-optimizer (MIT)
// packages/rules-engine/src/engine.ts

import weights from './config/weights.json';

export class ScoreEngine {
  constructor(rules) {
    this.rules = rules;
  }

  evaluate(input) {
    if (!input.text || input.text.trim().length < 3) {
      return {
        reachScore: 0,
        tier: 'critical',
        breakdown: { hook: 0, structure: 0, engagement: 0, penalties: 0, bonuses: 0 },
        suggestions: [],
        highlights: [],
      };
    }

    const results = this.rules.map(rule => rule.evaluate(input));
    const breakdown = this.calculateBreakdown(results);
    const rawScore =
      weights.baseScore + breakdown.hook + breakdown.structure +
      breakdown.engagement + breakdown.penalties + breakdown.bonuses;
    const reachScore = Math.max(0, Math.min(100, Math.round(rawScore)));
    const tier = this.assignTier(reachScore);
    const suggestions = this.collectSuggestions(results);
    const highlights = this.collectHighlights(results);

    return { reachScore, tier, breakdown, suggestions, highlights, rawResults: results };
  }

  calculateBreakdown(results) {
    let hook = 0, structure = 0, engagement = 0, penalties = 0, bonuses = 0;

    for (const result of results) {
      if (!result.triggered) continue;
      const rule = this.rules.find(r => r.id === result.ruleId);
      if (!rule) continue;
      switch (rule.category) {
        case 'hook': hook += result.points; break;
        case 'structure': structure += result.points; break;
        case 'engagement': engagement += result.points; break;
        case 'penalty': penalties += result.points; break;
        case 'bonus': bonuses += result.points; break;
      }
    }

    if (hook < 0) { penalties += hook; hook = 0; }
    if (structure < 0) { penalties += structure; structure = 0; }
    if (engagement < 0) { penalties += engagement; engagement = 0; }

    hook = Math.min(weights.categories.hook.maxPoints, hook);
    structure = Math.min(weights.categories.structure.maxPoints, structure);
    engagement = Math.min(weights.categories.engagement.maxPoints, engagement);
    penalties = Math.max(weights.categories.penalty.maxPenalty, Math.min(0, penalties));
    bonuses = Math.max(0, Math.min(weights.categories.bonus.maxBonus, bonuses));

    return { hook, structure, engagement, penalties, bonuses };
  }

  assignTier(score) {
    const t = weights.tiers;
    if (score >= t.perfect.min) return 'perfect';
    if (score >= t.excellent.min) return 'excellent';
    if (score >= t.good.min) return 'good';
    if (score >= t.below_average.min) return 'below_average';
    return 'critical';
  }

  collectSuggestions(results) {
    return results
      .filter(r => r.triggered && r.suggestion)
      .map(r => {
        const rule = this.rules.find(d => d.id === r.ruleId);
        return {
          ruleId: r.ruleId,
          severity: r.severity,
          title: rule?.name || r.ruleId,
          description: r.suggestion,
          highlight: r.highlight,
        };
      });
  }

  collectHighlights(results) {
    return results.filter(r => r.triggered && r.highlight).map(r => r.highlight);
  }
}

export { weights };
