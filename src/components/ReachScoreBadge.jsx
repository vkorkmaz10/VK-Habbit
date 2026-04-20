import { Zap, Undo2, Loader, TrendingUp, TrendingDown } from 'lucide-react';
import { forecastReach, whatIfScenarios } from '../engine/reach';

/**
 * ReachScoreBadge — ReachOS v3.0 UI.
 *
 * Props:
 *  - analysis: { reachScore, tier, breakdown:{hook,structure,engagement,penalties,bonuses},
 *                suggestions:[{ruleId,severity,title,description}], highlights, rawResults }
 *  - followers: number  (X follower count for forecast; 0 hides forecast block)
 *  - onBoost: () => void
 *  - onRevert: () => void | undefined
 *  - boosting: boolean
 */

const TIER_CLASS = {
  perfect: 'high',
  excellent: 'midhigh',
  good: 'mid',
  below_average: 'low',
  critical: 'critical',
};

const TIER_LABEL = {
  perfect: 'Mükemmel',
  excellent: 'Güçlü',
  good: 'Ortalama',
  below_average: 'Ortalama Altı',
  critical: 'Kritik',
};

const BAR_DEFS = [
  { key: 'hook',       label: 'Hook',       max: 30 },
  { key: 'structure',  label: 'Yapı',       max: 20 },
  { key: 'engagement', label: 'Etkileşim',  max: 30 },
  { key: 'penalties',  label: 'Cezalar',    max: 55, neg: true },
  { key: 'bonuses',    label: 'Bonuslar',   max: 15 },
];

function BreakdownBar({ label, score, max, neg }) {
  const abs = Math.abs(score);
  const pct = max > 0 ? Math.max(0, Math.min(100, (abs / max) * 100)) : 0;
  return (
    <div className="reach-bar-row">
      <div className="reach-bar-head">
        <span className="reach-bar-label">{label}</span>
        <span className="reach-bar-val">{score}<span className="reach-bar-max">/{neg ? `-${max}` : max}</span></span>
      </div>
      <div className="reach-bar-track">
        <div className={`reach-bar-fill ${neg ? 'neg' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const SEV_ORDER = { high: 0, med: 1, low: 2 };

export default function ReachScoreBadge({ analysis, followers = 0, onBoost, onRevert, boosting }) {
  if (!analysis) return null;
  const { reachScore = 0, tier = 'critical', breakdown = {}, suggestions = [] } = analysis;
  const tierClass = TIER_CLASS[tier] || 'mid';

  const sortedSuggestions = [...suggestions].sort(
    (a, b) => (SEV_ORDER[a.severity] ?? 3) - (SEV_ORDER[b.severity] ?? 3)
  );

  const forecast = followers > 0 ? forecastReach({ followers, score: reachScore }) : null;
  const scenarios = followers > 0 ? whatIfScenarios({ followers, score: reachScore }) : [];

  return (
    <div className={`reach-badge reach-${tierClass}`}>
      <div className="reach-badge-head">
        <div className="reach-score-block">
          <span className="reach-score-label">Reach</span>
          <span className="reach-score-value">{reachScore}<span className="reach-score-max">/100</span></span>
          <span className="reach-tier-label">{TIER_LABEL[tier] || tier}</span>
        </div>
        <div className="reach-badge-actions">
          {onRevert && (
            <button
              type="button"
              className="reach-btn reach-btn-revert"
              onClick={onRevert}
              disabled={boosting}
              title="Önceki sürüme dön"
            >
              <Undo2 size={12} /> Geri Al
            </button>
          )}
          {reachScore < 80 && (
            <button
              type="button"
              className="reach-btn reach-btn-boost"
              onClick={onBoost}
              disabled={boosting}
            >
              {boosting ? <><Loader size={12} className="cal-spin" /> Geliştiriliyor</> : <><Zap size={12} /> Reach'i Artır</>}
            </button>
          )}
        </div>
      </div>

      <div className="reach-bars">
        {BAR_DEFS.map(b => (
          <BreakdownBar
            key={b.key}
            label={b.label}
            score={breakdown[b.key] ?? 0}
            max={b.max}
            neg={!!b.neg}
          />
        ))}
      </div>

      {forecast && (
        <div className="reach-forecast">
          <div className="reach-forecast-head">
            <span className="reach-forecast-label">Tahmini Erişim</span>
            <span className="reach-forecast-value">{forecast.forecast.toLocaleString('tr-TR')}</span>
          </div>
          <div className="reach-forecast-meta">
            Aralık: {forecast.range[0].toLocaleString('tr-TR')} – {forecast.range[1].toLocaleString('tr-TR')}
            {forecast.isPeakTime && <span className="reach-peak"> · Peak saat ✓</span>}
          </div>
          {scenarios.length > 0 && (
            <ul className="reach-scenario-list">
              {scenarios.map((s) => (
                <li key={s.id} className={`reach-scenario ${s.highlight ? 'hl' : ''}`}>
                  <span className="reach-scenario-emoji">{s.emoji}</span>
                  <span className="reach-scenario-label">{s.label}</span>
                  <span className="reach-scenario-delta">
                    {s.delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {s.delta >= 0 ? '+' : ''}{s.pct}%
                  </span>
                  <span className="reach-scenario-val">{s.forecast.toLocaleString('tr-TR')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {sortedSuggestions.length > 0 ? (
        <ul className="reach-suggestions">
          {sortedSuggestions.slice(0, 6).map((s, i) => (
            <li key={s.ruleId || i} className={`reach-issue reach-sev-${s.severity || 'low'}`}>
              <span className="reach-issue-mark">⚠</span>
              <span className="reach-issue-text">
                {s.title && <strong>{s.title}: </strong>}{s.description}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="reach-all-good">Tüm kurallar geçti ✓</div>
      )}
    </div>
  );
}
