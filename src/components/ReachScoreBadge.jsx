import { Zap, Undo2, Loader } from 'lucide-react';

/**
 * ReachScoreBadge — Tweet altında gösterilen reach skoru ve kural ihlalleri.
 *
 * Props:
 *  - score: number (0-100)
 *  - breakdown: Array<{id, passed, severity, message, okMessage}>
 *  - onBoost: () => void  (Reach'i Artır butonu)
 *  - onRevert: () => void | undefined  (Geri Al — varsa görünür)
 *  - boosting: boolean  (boost API çağrısı sırasında loading)
 */
export default function ReachScoreBadge({ score, breakdown, onBoost, onRevert, boosting }) {
  const tier = score >= 85 ? 'high' : score >= 65 ? 'mid' : 'low';

  // Düşen kuralları severity'e göre sırala (high → low)
  const severityOrder = { high: 0, med: 1, low: 2 };
  const failing = breakdown
    .filter(b => !b.passed)
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const passing = breakdown.filter(b => b.passed);

  return (
    <div className={`reach-badge reach-${tier}`}>
      <div className="reach-badge-head">
        <div className="reach-score-block">
          <span className="reach-score-label">Reach</span>
          <span className="reach-score-value">{score}<span className="reach-score-max">/100</span></span>
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
          {score < 85 && (
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

      {failing.length > 0 && (
        <ul className="reach-issue-list">
          {failing.map(b => (
            <li key={b.id} className={`reach-issue reach-sev-${b.severity}`}>
              <span className="reach-issue-mark">⚠</span> {b.message}
            </li>
          ))}
        </ul>
      )}

      {failing.length === 0 && passing.length > 0 && (
        <div className="reach-all-good">Tüm kurallar geçti ✓</div>
      )}
    </div>
  );
}
