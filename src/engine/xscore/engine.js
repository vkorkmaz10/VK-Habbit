import weights from './config/weights.json';

export class ScoreEngine {
  constructor(rules) {
    this.rules = rules;
  }

  evaluate(input) {
    if (!input.text || input.text.trim().length < 3) {
      return {
        score: 0,
        tier: 'dead',
        breakdown: { conversation: 0, spread: 0, dwell: 0, penalties: 0 },
        suggestions: [],
        highlights: [],
        rawResults: [],
      };
    }

    const rawResults = this.rules.map(rule => rule.evaluate(input));
    const breakdown = this.calcBreakdown(rawResults);
    const rawScore =
      weights.baseScore +
      breakdown.conversation +
      breakdown.spread +
      breakdown.dwell +
      breakdown.penalties;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));
    const tier = this.assignTier(score);
    const suggestions = this.collectSuggestions(rawResults);
    const highlights = rawResults.filter(r => r.triggered && r.highlight).map(r => r.highlight);

    return { score, tier, breakdown, suggestions, highlights, rawResults };
  }

  calcBreakdown(results) {
    let conversation = 0, spread = 0, dwell = 0, penalties = 0;

    for (const res of results) {
      if (!res.triggered) continue;
      const rule = this.rules.find(r => r.id === res.ruleId);
      if (!rule) continue;
      switch (rule.category) {
        case 'conversation': conversation += res.points; break;
        case 'spread':       spread += res.points; break;
        case 'dwell':        dwell += res.points; break;
        case 'penalty':      penalties += res.points; break;
      }
    }

    // Negative category scores shift to penalties
    if (conversation < 0) { penalties += conversation; conversation = 0; }
    if (spread < 0)        { penalties += spread;       spread = 0; }
    if (dwell < 0)         { penalties += dwell;        dwell = 0; }

    // Cap each category
    conversation = Math.min(weights.categories.conversation.maxPoints, conversation);
    spread       = Math.min(weights.categories.spread.maxPoints,       spread);
    dwell        = Math.min(weights.categories.dwell.maxPoints,        dwell);
    penalties    = Math.max(weights.categories.penalty.maxPenalty, Math.min(0, penalties));

    return { conversation, spread, dwell, penalties };
  }

  assignTier(score) {
    const t = weights.tiers;
    if (score >= t.viral.min)   return 'viral';
    if (score >= t.strong.min)  return 'strong';
    if (score >= t.average.min) return 'average';
    if (score >= t.weak.min)    return 'weak';
    return 'dead';
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
}
