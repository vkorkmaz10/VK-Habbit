import { START_DATE_STR, getWeekDays } from './date';
import { getDefaultChecks } from '../data/constants';

const STORAGE_KEY = 'lifeos_data';

// Eski vkgym_data verisini bir defaya mahsus taşı
(function migrateStorage() {
  if (!localStorage.getItem('lifeos_data') && localStorage.getItem('vkgym_data')) {
    localStorage.setItem('lifeos_data', localStorage.getItem('vkgym_data'));
  }
})();

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
  const def = { w: null, c: getDefaultChecks(), m: [] };
  if (!raw.days[dateStr]) {
    return def;
  }
  const day = raw.days[dateStr];
  return {
    w: day.w !== undefined ? day.w : null,
    c: day.c || getDefaultChecks(),
    m: day.m || []
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
    raw.days[dateStr] = { w: null, c: getDefaultChecks(), m: [] };
  }
  if (!raw.days[dateStr].c) {
    raw.days[dateStr].c = getDefaultChecks();
  }
  raw.days[dateStr].c[checkIndex] = valueBool ? 1 : 0;
  saveRawData(raw);
};

export const updateMuscles = (dateStr, musclesArray) => {
  const raw = getRawData();
  if (!raw.days[dateStr]) {
    raw.days[dateStr] = { w: null, c: getDefaultChecks(), m: [] };
  }
  raw.days[dateStr].m = musclesArray;
  saveRawData(raw);
};

export const calculateDayScore = (dateStr) => {
  const data = getDayData(dateStr);
  const CORE_INDICES = [0, 2, 3, 4, 5, 6, 7, 10, 11];
  const WORKOUT_INDICES = [1, 8, 9];
  
  let coreChecked = 0;
  CORE_INDICES.forEach(i => { if (data.c[i]) coreChecked++; });
  
  let workoutChecked = 0;
  WORKOUT_INDICES.forEach(i => { if (data.c[i]) workoutChecked++; });

  const isWorkoutDay = data.c[8] === 1;

  if (isWorkoutDay) {
    return Math.round(((coreChecked + workoutChecked) / 12) * 100);
  } else {
    // Look at whole week to find out how many workouts were done
    const { days } = getWeekDays(new Date(dateStr));
    let weekWorkoutCount = 0;
    days.forEach(d => {
       const dData = getDayData(d.dateStr);
       if (dData.c[8] === 1) weekWorkoutCount++;
    });

    let maxScore = 70; // base penalty
    if (weekWorkoutCount >= 5) maxScore = 100;
    else if (weekWorkoutCount === 4) maxScore = 90;

    return Math.round((coreChecked / 9) * maxScore);
  }
};

export const getStoreSummary = () => {
    return getRawData();
};

// ========================
// To-Do Functions
// ========================

export const getTodoTasks = (dateStr) => {
  const raw = getRawData();
  if (!raw.days[dateStr] || !raw.days[dateStr].t) return [];
  return raw.days[dateStr].t;
};

export const getAllOpenTasks = () => {
  const raw = getRawData();
  // Ascending date sort → newer date overwrites older for same task ID
  const taskMap = new Map();
  Object.keys(raw.days).sort().forEach(dateStr => {
    const day = raw.days[dateStr];
    if (!day || !day.t) return;
    day.t.forEach(task => {
      taskMap.set(task.id, { ...task, _dateStr: dateStr });
    });
  });
  return [...taskMap.values()]
    .filter(task => !task.done)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
};

export const addTodoTask = (dateStr, task) => {
  const raw = getRawData();
  if (!raw.days[dateStr]) {
    raw.days[dateStr] = { w: null, c: getDefaultChecks(), m: [], t: [] };
  }
  if (!raw.days[dateStr].t) raw.days[dateStr].t = [];
  // createdAt eklenmemişse ekle
  if (!task.createdAt) task.createdAt = dateStr;
  raw.days[dateStr].t.push(task);
  saveRawData(raw);
};

export const insertTodoTaskAt = (dateStr, task, index) => {
  const raw = getRawData();
  if (!raw.days[dateStr]) {
    raw.days[dateStr] = { w: null, c: getDefaultChecks(), m: [], t: [] };
  }
  if (!raw.days[dateStr].t) raw.days[dateStr].t = [];
  if (!task.createdAt) task.createdAt = dateStr;
  const safeIndex = Math.min(index, raw.days[dateStr].t.length);
  raw.days[dateStr].t.splice(safeIndex, 0, task);
  saveRawData(raw);
};

export const updateTodoTask = (dateStr, taskId, updates) => {
  const raw = getRawData();
  if (!raw.days[dateStr] || !raw.days[dateStr].t) return;
  const idx = raw.days[dateStr].t.findIndex(t => t.id === taskId);
  if (idx === -1) return;
  raw.days[dateStr].t[idx] = { ...raw.days[dateStr].t[idx], ...updates };
  saveRawData(raw);
};

export const removeTodoTask = (dateStr, taskId) => {
  const raw = getRawData();
  if (!raw.days[dateStr] || !raw.days[dateStr].t) return;
  raw.days[dateStr].t = raw.days[dateStr].t.filter(t => t.id !== taskId);
  saveRawData(raw);
};

/**
 * Rollover: App açıldığında çağrılır.
 * Geçmiş günlerdeki tamamlanmamış (done:false) taskler bugüne kopyalanır.
 * Orijinal gündeki kopyası done:false olarak kalır ama 'rolled' flag alır.
 * Tamamlanmış taskler orijinal günlerinde olduğu gibi kalır.
 */
export const performRollover = (todayStr) => {
  const raw = getRawData();
  const allDates = Object.keys(raw.days).sort();
  let changed = false;

  // Bugünün t dizisini hazırla
  if (!raw.days[todayStr]) {
    raw.days[todayStr] = { w: null, c: getDefaultChecks(), m: [], t: [] };
  }
  if (!raw.days[todayStr].t) raw.days[todayStr].t = [];

  const existingIds = new Set(raw.days[todayStr].t.map(t => t.id));

  allDates.forEach(dateStr => {
    if (dateStr >= todayStr) return; // Sadece geçmiş günlere bak
    const dayData = raw.days[dateStr];
    if (!dayData || !dayData.t) return;

    dayData.t.forEach(task => {
      if (!task.done && !task.rolled && !existingIds.has(task.id)) {
        // Bugüne kopyala (rolledFrom ile işaretle, orijinal createdAt'i koru)
        raw.days[todayStr].t.push({
          ...task,
          rolledFrom: dateStr,
          createdAt: task.createdAt || dateStr
        });
        existingIds.add(task.id);
        // Orijinalini rolled olarak işaretle
        task.rolled = true;
        changed = true;
      }
    });
  });

  if (changed) saveRawData(raw);
};

/**
 * Günlük To-Do skoru: 3 görev tamamlamak = %100
 */
export const calculateTodoScore = (dateStr) => {
  const tasks = getTodoTasks(dateStr);
  const doneCount = tasks.filter(t => t.done).length;
  return Math.min(Math.round((doneCount / 3) * 100), 100);
};

// ========================
// Pomodoro Persistence
// ========================
const POMODORO_KEY = 'lifeos_pomodoro';

export const getActivePomodoro = () => {
  const data = localStorage.getItem(POMODORO_KEY);
  if (!data) return null;
  return JSON.parse(data);
};

export const setActivePomodoro = (pomodoroData) => {
  localStorage.setItem(POMODORO_KEY, JSON.stringify(pomodoroData));
};

export const clearActivePomodoro = () => {
  localStorage.removeItem(POMODORO_KEY);
};

// ========================
// Calendar Events
// ========================

export const getCalendarEvents = (dateStr = null) => {
  const raw = getRawData();
  const events = raw.calendarEvents || [];
  if (dateStr) {
    return events.filter(e => e.dateStr === dateStr).sort((a, b) => a.timeStart.localeCompare(b.timeStart));
  }
  return events;
};

export const addCalendarEvent = (event) => {
  const raw = getRawData();
  if (!raw.calendarEvents) raw.calendarEvents = [];
  raw.calendarEvents.push(event);
  saveRawData(raw);
};

export const updateCalendarEvent = (eventId, updates) => {
  const raw = getRawData();
  if (!raw.calendarEvents) return;
  const idx = raw.calendarEvents.findIndex(e => e.id === eventId);
  if (idx === -1) return;
  raw.calendarEvents[idx] = { ...raw.calendarEvents[idx], ...updates };
  saveRawData(raw);
};

export const removeCalendarEvent = (eventId) => {
  const raw = getRawData();
  if (!raw.calendarEvents) return;
  raw.calendarEvents = raw.calendarEvents.filter(e => e.id !== eventId);
  saveRawData(raw);
};

// ========================
// VSE Feedback Log
// ========================

const VSE_FEEDBACK_KEY = 'lifeos_vse_feedback';

/**
 * Saves a VSE feedback entry (original vs user-edited content).
 * Used by the engine to learn Volkan's style over time.
 */
export const saveFeedback = (entry) => {
  const existing = getFeedbackLog();
  existing.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  localStorage.setItem(VSE_FEEDBACK_KEY, JSON.stringify(existing));
};

/**
 * Returns all saved VSE feedback entries.
 */
export const getFeedbackLog = () => {
  try {
    const data = localStorage.getItem(VSE_FEEDBACK_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// ========================
// ReachOS Settings (BYOK + X profile)
// ========================

const ANTHROPIC_KEY_STORAGE = 'lifeos_anthropic_key';
const X_FOLLOWERS_STORAGE = 'lifeos_x_followers';

export const getAnthropicKey = () => {
  try { return localStorage.getItem(ANTHROPIC_KEY_STORAGE) || ''; }
  catch { return ''; }
};

export const setAnthropicKey = (key) => {
  try {
    if (key) localStorage.setItem(ANTHROPIC_KEY_STORAGE, key);
    else localStorage.removeItem(ANTHROPIC_KEY_STORAGE);
  } catch { /* noop */ }
};

export const getXFollowers = () => {
  try {
    const v = localStorage.getItem(X_FOLLOWERS_STORAGE);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
};

export const setXFollowers = (count) => {
  try {
    const n = parseInt(count, 10);
    if (Number.isFinite(n) && n > 0) localStorage.setItem(X_FOLLOWERS_STORAGE, String(n));
    else localStorage.removeItem(X_FOLLOWERS_STORAGE);
  } catch { /* noop */ }
};
