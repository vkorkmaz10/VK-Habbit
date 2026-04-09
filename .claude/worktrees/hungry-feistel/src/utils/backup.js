// ======= VK-GYM Data Backup Utilities =======
// Export, import, validate — iOS PWA compatible

const VKGYM_PREFIX = 'vkgym_';
const BACKUP_VERSION = 1;

/**
 * Get all localStorage keys that belong to VK-GYM
 */
export function getAllVkgymKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(VKGYM_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Export all VK-GYM data as a JSON envelope
 */
export function exportAllData() {
  const keys = getAllVkgymKeys();
  const data = {};
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = raw;
    }
  }
  return {
    version: BACKUP_VERSION,
    exportDate: new Date().toISOString(),
    keys: data,
  };
}

/**
 * Validate a parsed backup object
 * Returns { valid: boolean, error?: string }
 */
export function validateBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Geçersiz dosya formatı.' };
  }
  if (parsed.version !== BACKUP_VERSION) {
    return { valid: false, error: `Desteklenmeyen yedek versiyonu: ${parsed.version}` };
  }
  if (!parsed.keys || typeof parsed.keys !== 'object') {
    return { valid: false, error: 'Yedek dosyasında veri bulunamadı.' };
  }
  // Check vkgym_data structure if present
  const mainData = parsed.keys['vkgym_data'];
  if (mainData) {
    if (!mainData.startDate || !mainData.days || typeof mainData.days !== 'object') {
      return { valid: false, error: 'Ana veri yapısı bozuk (startDate veya days eksik).' };
    }
  }
  return { valid: true };
}

/**
 * Import backup data into localStorage
 * mode: 'merge' — merge days, keep existing dates not in import
 * mode: 'replace' — overwrite everything
 */
export function importData(parsed, mode = 'replace') {
  if (mode === 'replace') {
    // Clear all existing vkgym keys
    const existing = getAllVkgymKeys();
    for (const key of existing) {
      localStorage.removeItem(key);
    }
    // Write all imported keys
    for (const [key, value] of Object.entries(parsed.keys)) {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  } else {
    // Merge mode
    for (const [key, importedValue] of Object.entries(parsed.keys)) {
      if (key === 'vkgym_data') {
        // Special merge for main data
        const currentRaw = localStorage.getItem('vkgym_data');
        const current = currentRaw ? JSON.parse(currentRaw) : { startDate: importedValue.startDate, days: {}, calendarEvents: [] };

        // Merge days — imported days overwrite existing for same date
        const mergedDays = { ...current.days, ...importedValue.days };

        // Merge calendarEvents — deduplicate by id
        const existingEvents = current.calendarEvents || [];
        const importedEvents = importedValue.calendarEvents || [];
        const eventIds = new Set(existingEvents.map(e => e.id));
        const mergedEvents = [...existingEvents];
        for (const evt of importedEvents) {
          if (!eventIds.has(evt.id)) {
            mergedEvents.push(evt);
            eventIds.add(evt.id);
          }
        }

        const merged = {
          ...current,
          ...importedValue,
          days: mergedDays,
          calendarEvents: mergedEvents,
        };
        localStorage.setItem('vkgym_data', JSON.stringify(merged));
      } else {
        // Other keys — simply overwrite
        localStorage.setItem(key, typeof importedValue === 'string' ? importedValue : JSON.stringify(importedValue));
      }
    }
  }
}

/**
 * Platform-aware export — handles iOS PWA, desktop browser, clipboard fallback
 * Returns: 'shared' | 'downloaded' | 'clipboard'
 */
export async function exportForPlatform(jsonString, filename) {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });

  // 1. Try Web Share API with files (iOS 15+ PWA)
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'VK-GYM Yedek' });
      return 'shared';
    }
  } catch {
    // Share cancelled or failed, try next
  }

  // 2. Try download link (works in browsers, not iOS PWA standalone)
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if (!isStandalone) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return 'downloaded';
    } catch {
      // Download failed, try clipboard
    }
  }

  // 3. Fallback: clipboard
  try {
    await navigator.clipboard.writeText(jsonString);
    return 'clipboard';
  } catch {
    // Last resort — open in new window so user can copy
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<pre>${jsonString}</pre>`);
      win.document.title = filename;
    }
    return 'clipboard';
  }
}

/**
 * Get storage stats for display
 */
export function getStorageStats() {
  const keys = getAllVkgymKeys();
  let totalBytes = 0;
  for (const key of keys) {
    const val = localStorage.getItem(key);
    if (val) totalBytes += key.length + val.length;
  }

  let dayCount = 0;
  try {
    const data = JSON.parse(localStorage.getItem('vkgym_data') || '{}');
    dayCount = data.days ? Object.keys(data.days).length : 0;
  } catch { /* ignore */ }

  return {
    totalKB: (totalBytes / 1024).toFixed(1),
    keyCount: keys.length,
    dayCount,
  };
}
