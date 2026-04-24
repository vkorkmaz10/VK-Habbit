/**
 * 𝕏 Score — Reach Forecast
 * 2026 X algoritması: followers × baseline CTR × skor/medya/zaman çarpanları.
 */

const BASELINE_CTR = 0.10;   // Takipçinin ~%10'una ulaşır
const SCORE_MIN_MULT = 0.5;  // Skor 0 → 0.5×
const SCORE_MAX_MULT = 2.0;  // Skor 100 → 2.0×
const MEDIA_MULT = 2.0;      // Görsel/video: 2× boost
const PEAK_MULT = 1.3;       // Peak saat: +30%
const TREND_MULT = 1.16;     // Trend topic: +16% tahmin
const RANGE_LOW = 0.55;
const RANGE_HIGH = 1.45;

// UTC peak: Salı–Cuma 09:00–14:00
export function isPeakHourUTC(date = new Date()) {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  return day >= 2 && day <= 5 && hour >= 9 && hour <= 14;
}

export function forecastReach({ followers = 0, score = 50, hasMedia = false, atPeakTime = isPeakHourUTC() }) {
  if (!followers || followers < 1) return null;
  const baseReach = followers * BASELINE_CTR;
  const scoreMult = SCORE_MIN_MULT + (score / 100) * (SCORE_MAX_MULT - SCORE_MIN_MULT);
  const mediaMult = hasMedia ? MEDIA_MULT : 1.0;
  const timeMult = atPeakTime ? PEAK_MULT : 1.0;
  const forecast = Math.round(baseReach * scoreMult * mediaMult * timeMult);
  return {
    forecast,
    range: [Math.round(forecast * RANGE_LOW), Math.round(forecast * RANGE_HIGH)],
    avgComparison: scoreMult * mediaMult * timeMult,
    isPeakTime: atPeakTime,
  };
}

export function whatIfScenarios({ followers = 0, score = 50, hasMedia = false }) {
  const base = forecastReach({ followers, score, hasMedia, atPeakTime: false });
  if (!base) return [];
  const scenarios = [];
  if (!hasMedia) {
    const wm = forecastReach({ followers, score, hasMedia: true, atPeakTime: false });
    scenarios.push({
      id: 'add-image', label: 'Görsel Ekle', emoji: '🖼',
      delta: wm.forecast - base.forecast,
      pct: Math.round(((wm.forecast / base.forecast) - 1) * 100),
      forecast: wm.forecast,
    });
  }
  const ap = forecastReach({ followers, score, hasMedia, atPeakTime: true });
  scenarios.push({
    id: 'peak-time', label: 'Peak Saatte Paylaş', emoji: '⏰',
    sub: 'Sal–Cum 09:00–14:00 UTC',
    delta: ap.forecast - base.forecast,
    pct: Math.round(((ap.forecast / base.forecast) - 1) * 100),
    forecast: ap.forecast,
  });
  const tf = Math.round(base.forecast * TREND_MULT);
  scenarios.push({
    id: 'trend', label: 'Trende Hizala', emoji: '🔥',
    sub: 'Trend topic\'ten bahset',
    delta: tf - base.forecast,
    pct: Math.round((TREND_MULT - 1) * 100),
    forecast: tf,
  });
  const allMult = (hasMedia ? 1 : MEDIA_MULT) * PEAK_MULT * TREND_MULT;
  const af = Math.round(base.forecast * allMult);
  scenarios.push({
    id: 'all', label: 'Hepsi Birlikte', emoji: '🚀',
    sub: `${scenarios.length} optimizasyon`,
    delta: af - base.forecast,
    pct: Math.round((allMult - 1) * 100),
    forecast: af,
    highlight: true,
  });
  return scenarios;
}
