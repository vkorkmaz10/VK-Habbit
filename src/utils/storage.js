import { START_DATE_STR } from './date';
import { getDefaultChecks } from '../data/constants';

const STORAGE_KEY = 'vkgym_data';

/**
 * Veri Yapısı:
 * {
 *   "startDate": "2026-03-23",
 *   "days": {
 *      "2026-03-23": { "w": 75.55, "c": [1,0,1,1,1....] }
 *   }
 * }
 */

const getRawData = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    return { startDate: START_DATE_STR, days: {} };
  }
  return JSON.parse(data);
};

const saveRawData = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const getDayData = (dateStr) => {
  const raw = getRawData();
  const def = { w: null, c: getDefaultChecks() };
  if (!raw.days[dateStr]) {
    return def;
  }
  // c might be missing if previous versions didn't have it initialized
  const day = raw.days[dateStr];
  return {
    w: day.w !== undefined ? day.w : null,
    c: day.c || getDefaultChecks()
  };
};

// En son girilen kiloyu bulur (kaydırıcı varsayılanı için)
// Eğer hiç kilo girilmemişse, varsayılan bir değer döndür
export const getLatestWeight = (currentDateStr) => {
  const raw = getRawData();
  const dates = Object.keys(raw.days).sort();
  for (let i = dates.length - 1; i >= 0; i--) {
     const d = dates[i];
     // current date string'den önce veya eşit olan en son null olmayan değer.
     if (d <= currentDateStr && raw.days[d].w !== null) {
        return raw.days[d].w;
     }
  }
  return 75.00; // Varsayılan Başlangıç Kilosu
};

export const updateWeight = (dateStr, weightVal) => {
  const raw = getRawData();
  if (!raw.days[dateStr]) {
    raw.days[dateStr] = { w: null, c: getDefaultChecks() };
  }
  raw.days[dateStr].w = weightVal;
  saveRawData(raw);
};

export const updateCheck = (dateStr, checkIndex, valueBool) => {
  const raw = getRawData();
  if (!raw.days[dateStr]) {
    raw.days[dateStr] = { w: null, c: getDefaultChecks() };
  }
  if (!raw.days[dateStr].c) {
    raw.days[dateStr].c = getDefaultChecks();
  }
  raw.days[dateStr].c[checkIndex] = valueBool ? 1 : 0;
  saveRawData(raw);
};

export const calculateDayScore = (dateStr) => {
  const data = getDayData(dateStr);
  const total = data.c.length;
  const checks = data.c.reduce((sum, val) => sum + val, 0);
  return Math.round((checks / total) * 100);
};

export const getStoreSummary = () => {
    return getRawData();
}
