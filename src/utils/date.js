import { addHours, format, parseISO, startOfWeek, addDays, getISODay } from 'date-fns';
import { tr } from 'date-fns/locale';

export const START_DATE_STR = '2026-03-23'; // Pazartesi

/**
 * Günün sıfırlanma saatini (03:00) ayarlamak için mevcut saatten 3 saat çıkarırız.
 * Örn: 02:30 -> önceki günün 23:30'u olarak hesaplanır.
 */
export const getActiveDateObj = (date = new Date()) => {
  return addHours(date, -3);
};

export const getActiveDateString = (date = new Date()) => {
  return format(getActiveDateObj(date), 'yyyy-MM-dd');
};

/**
 * Belirtilen tarihe ait haftanın günlerini ve tarihlerini döndürür.
 * Girdiğimiz "dateObj" parametresinin Pazartesini bulup 7 günü listeleriz.
 */
export const getWeekDays = (dateObj) => {
  // date-fns'de weekStartsOn: 1 (Pazartesi)
  const start = startOfWeek(dateObj, { weekStartsOn: 1 });
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    days.push({
      dateStr: format(d, 'yyyy-MM-dd'),
      dayNum: format(d, 'd'), // örn: 17
      isToday: format(d, 'yyyy-MM-dd') === getActiveDateString(new Date())
    });
  }
  return { start, days };
};

export const formatWeekTitle = (calendarDateObj, startDateObj = parseISO(START_DATE_STR)) => {
  const { start } = getWeekDays(calendarDateObj);
  
  // Başlangıç haftası bulma
  const startWeek = startOfWeek(startDateObj, { weekStartsOn: 1 });
  const weekDiff = Math.floor((start.getTime() - startWeek.getTime()) / (1000 * 60 * 60 * 24 * 7));
  const weekNumber = weekDiff + 1;
  
  // Örn: "14. Hafta (15 Mayıs 2026)"
  const dateFormatted = format(start, 'dd MMMM yyyy', { locale: tr });
  return `${weekNumber}. Hafta (${dateFormatted})`;
};
