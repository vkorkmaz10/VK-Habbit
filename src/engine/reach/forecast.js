/**
 * Reach Forecast — followers + score + media + posting time'a göre tahmini erişim.
 * Repo: AytuncYildizli/reach-optimizer extension forecast-engine.
 */

const BASELINE_CTR = 0.10;          // ortalama: takipçinin %10'una ulaşır
const SCORE_MIN_MULT = 0.5;
const SCORE_MAX_MULT = 2.0;
const MEDIA_MULT = 2.0;
const PEAK_MULT = 1.3;
const TREND_MULT = 1.16;
const RANGE_LOW = 0.55;
const RANGE_HIGH = 1.45;

// UTC peak windows: Tue-Fri, 9AM-2PM UTC (X research)
function isPeakHourUTC(date = new Date()) {
  const day = date.getUTCDay();   // 0=Sun, 6=Sat
  const hour = date.getUTCHours();
  return day >= 2 && day <= 5 && hour >= 9 && hour <= 14;
}

export function forecastReach({ followers = 0, score = 50, hasMedia = false, atPeakTime = isPeakHourUTC() }) {
  if (!followers || followers < 1) {
    // No followers data → return null (UI will hide forecast block)
    return null;
  }
  const baseReach = followers * BASELINE_CTR;
  const scoreMult = SCORE_MIN_MULT + (score / 100) * (SCORE_MAX_MULT - SCORE_MIN_MULT);
  const mediaMult = hasMedia ? MEDIA_MULT : 1.0;
  const timeMult = atPeakTime ? PEAK_MULT : 1.0;
  const forecast = Math.round(baseReach * scoreMult * mediaMult * timeMult);
  return {
    forecast,
    range: [Math.round(forecast * RANGE_LOW), Math.round(forecast * RANGE_HIGH)],
    avgComparison: scoreMult * mediaMult * timeMult,   // 1.0 = ortalama
    isPeakTime: atPeakTime,
  };
}

export function whatIfScenarios({ followers = 0, score = 50, hasMedia = false }) {
  const base = forecastReach({ followers, score, hasMedia, atPeakTime: false });
  if (!base) return [];

  const scenarios = [];
  if (!hasMedia) {
    const withMedia = forecastReach({ followers, score, hasMedia: true, atPeakTime: false });
    scenarios.push({
      id: 'add-image', label: 'Görsel Ekle', emoji: '🖼',
      delta: Math.round((withMedia.forecast - base.forecast)),
      pct: Math.round(((withMedia.forecast / base.forecast) - 1) * 100),
      forecast: withMedia.forecast,
    });
  }
  const atPeak = forecastReach({ followers, score, hasMedia, atPeakTime: true });
  scenarios.push({
    id: 'peak-time', label: 'Peak Zamanda Paylaş', emoji: '⏰',
    sub: 'Salı-Cuma 9AM-2PM UTC',
    delta: Math.round((atPeak.forecast - base.forecast)),
    pct: Math.round(((atPeak.forecast / base.forecast) - 1) * 100),
    forecast: atPeak.forecast,
  });
  // Trend bonus (estimated)
  const trendForecast = Math.round(base.forecast * TREND_MULT);
  scenarios.push({
    id: 'trend', label: 'Trende Hizala', emoji: '🔥',
    sub: 'Trend topic\'ten bahset',
    delta: trendForecast - base.forecast,
    pct: Math.round((TREND_MULT - 1) * 100),
    forecast: trendForecast,
  });
  // All combined
  const allMult = (hasMedia ? 1 : MEDIA_MULT) * PEAK_MULT * TREND_MULT;
  const allForecast = Math.round(base.forecast * allMult);
  scenarios.push({
    id: 'all', label: 'Hepsi Birlikte', emoji: '🚀',
    sub: `${scenarios.length} optimizasyon birleşti`,
    delta: allForecast - base.forecast,
    pct: Math.round((allMult - 1) * 100),
    forecast: allForecast,
    highlight: true,
  });
  return scenarios;
}

export { isPeakHourUTC };
