import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, Key, Eye, EyeOff, Trash2, Info, Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import {
  exportAllData,
  exportForPlatform,
  validateBackup,
  importData,
  getStorageStats,
} from '../utils/backup';
import {
  getAnthropicKey,
  setAnthropicKey,
  getXFollowers,
  setXFollowers,
} from '../utils/storage';

const GEMINI_KEY_STORAGE = 'vkgym_gemini_key';
const CC_KEY_STORAGE = 'vkgym_cc_key';

export default function SettingsView() {
  // Gemini key
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) || '');
  const [showKey, setShowKey] = useState(false);
  const keyInputRef = useRef(null);

  // CryptoCompare key
  const [ccKey, setCcKey] = useState(() => localStorage.getItem(CC_KEY_STORAGE) || '');
  const [showCcKey, setShowCcKey] = useState(false);
  const ccKeyInputRef = useRef(null);

  // Anthropic key (ReachOS AI-augmented checks)
  const [anthropicKey, setAnthropicKeyState] = useState(() => getAnthropicKey());
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const anthropicKeyInputRef = useRef(null);

  // X follower count (forecast)
  const [xFollowers, setXFollowersState] = useState(() => getXFollowers());
  const xFollowersInputRef = useRef(null);

  // Key reveal password modal
  const KEY_REVEAL_PASSWORD = 'vk2017';
  const [keyRevealModal, setKeyRevealModal] = useState(null); // null | 'gemini' | 'cc' | 'anthropic'
  const [revealPwInput, setRevealPwInput] = useState('');
  const [revealError, setRevealError] = useState(false);
  const revealPwRef = useRef(null);
  const revealTimerRef = useRef(null);

  const openRevealModal = (target) => {
    setKeyRevealModal(target);
    setRevealPwInput('');
    setRevealError(false);
  };

  const confirmReveal = () => {
    if (revealPwInput !== KEY_REVEAL_PASSWORD) {
      setRevealError(true);
      return;
    }
    if (keyRevealModal === 'gemini') setShowKey(true);
    if (keyRevealModal === 'cc') setShowCcKey(true);
    if (keyRevealModal === 'anthropic') setShowAnthropicKey(true);
    setKeyRevealModal(null);
    setRevealPwInput('');
    // Otomatik gizle: 30 saniye sonra
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      setShowKey(false);
      setShowCcKey(false);
      setShowAnthropicKey(false);
    }, 30000);
  };

  const handleEyeClick = (field, isShown) => {
    if (isShown) {
      if (field === 'gemini') setShowKey(false);
      if (field === 'cc') setShowCcKey(false);
      if (field === 'anthropic') setShowAnthropicKey(false);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    } else {
      openRevealModal(field);
    }
  };

  // Import
  const fileInputRef = useRef(null);
  const [importModal, setImportModal] = useState(null); // { parsed, filename }
  const [importMode, setImportMode] = useState('merge');

  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  // Toast
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Stats
  const [stats, setStats] = useState(() => getStorageStats());

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // ===== Export =====
  const handleExport = async () => {
    try {
      const data = exportAllData();
      const jsonStr = JSON.stringify(data, null, 2);
      const date = new Date().toISOString().slice(0, 10);
      const filename = `vkgym-yedek-${date}.json`;
      const method = await exportForPlatform(jsonStr, filename);

      if (method === 'shared') showToast('Yedek dosyasi paylasildi.');
      else if (method === 'downloaded') showToast('Yedek dosyasi indirildi.');
      else showToast('Veri panoya kopyalandi. Bir metin dosyasina yapistirin.', 'info');
    } catch (e) {
      showToast('Disa aktarma basarisiz: ' + e.message, 'error');
    }
  };

  // ===== Import =====
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const validation = validateBackup(parsed);
        if (!validation.valid) {
          showToast(validation.error, 'error');
          return;
        }
        setImportModal({ parsed, filename: file.name });
        setImportMode('merge');
      } catch {
        showToast('Gecersiz JSON dosyasi.', 'error');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!importModal) return;
    try {
      importData(importModal.parsed, importMode);
      setImportModal(null);
      showToast('Veri basariyla ice aktarildi. Sayfa yenileniyor...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      showToast('Ice aktarma basarisiz: ' + e.message, 'error');
    }
  };

  // ===== Gemini Key =====
  const saveKey = () => {
    const val = keyInputRef.current?.value?.trim() || '';
    setGeminiKey(val);
    if (val) {
      localStorage.setItem(GEMINI_KEY_STORAGE, val);
      showToast('API anahtari kaydedildi.');
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
      showToast('API anahtari silindi.');
    }
    window.dispatchEvent(new CustomEvent('vkgym_key_updated'));
  };

  const deleteKey = () => {
    setGeminiKey('');
    localStorage.removeItem(GEMINI_KEY_STORAGE);
    if (keyInputRef.current) keyInputRef.current.value = '';
    showToast('API anahtari silindi.');
    window.dispatchEvent(new CustomEvent('vkgym_key_updated'));
  };

  // ===== CryptoCompare Key =====
  const saveCcKey = () => {
    const val = ccKeyInputRef.current?.value?.trim() || '';
    setCcKey(val);
    if (val) {
      localStorage.setItem(CC_KEY_STORAGE, val);
      showToast('CryptoCompare key kaydedildi.');
    } else {
      localStorage.removeItem(CC_KEY_STORAGE);
      showToast('CryptoCompare key silindi.');
    }
    window.dispatchEvent(new CustomEvent('vkgym_key_updated'));
  };

  const deleteCcKey = () => {
    setCcKey('');
    localStorage.removeItem(CC_KEY_STORAGE);
    if (ccKeyInputRef.current) ccKeyInputRef.current.value = '';
    showToast('CryptoCompare key silindi.');
    window.dispatchEvent(new CustomEvent('vkgym_key_updated'));
  };

  // ===== Anthropic Key =====
  const saveAnthropicKey = () => {
    const val = anthropicKeyInputRef.current?.value?.trim() || '';
    setAnthropicKeyState(val);
    setAnthropicKey(val);
    showToast(val ? 'Anthropic key kaydedildi.' : 'Anthropic key silindi.');
  };

  const deleteAnthropicKey = () => {
    setAnthropicKeyState('');
    setAnthropicKey('');
    if (anthropicKeyInputRef.current) anthropicKeyInputRef.current.value = '';
    showToast('Anthropic key silindi.');
  };

  // ===== X Followers =====
  const saveXFollowers = () => {
    const raw = xFollowersInputRef.current?.value || '';
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      setXFollowers(n);
      setXFollowersState(n);
      showToast('Takipçi sayısı kaydedildi.');
    } else {
      setXFollowers(0);
      setXFollowersState(0);
      showToast('Takipçi sayısı temizlendi.');
    }
  };

  // ===== Delete All =====
  const DELETE_PASSWORD = 'vk2017';
  const confirmDeleteAll = () => {
    if (deleteInput !== DELETE_PASSWORD) return;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('vkgym_')) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
    setDeleteModal(false);
    showToast('Tum veriler silindi. Sayfa yenileniyor...');
    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <div className="fade-in settings-view">

      {/* ===== Data Backup ===== */}
      <div className="glass-card settings-card">
        <div className="settings-card-title">
          <Shield size={16} /> Veri Yedekleme
        </div>
        <p className="settings-desc">
          Verilerinizi JSON dosyasi olarak disari aktarin veya baska bir cihazdan iceri aktarin.
        </p>
        <div className="settings-btn-row">
          <button className="settings-btn settings-btn-export" onClick={handleExport}>
            <Download size={16} /> Disa Aktar
          </button>
          <button className="settings-btn settings-btn-import" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} /> Ice Aktar
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* ===== Gemini API Key ===== */}
      <div className="glass-card settings-card">
        <div className="settings-card-title">
          <Key size={16} /> Gemini API Key
        </div>
        <p className="settings-desc">
          Icerik uretimi icin gerekli.{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="settings-link">
            Buradan alin
          </a>
        </p>
        <div className="settings-key-row">
          <div className="settings-key-input-wrap">
            <input
              ref={keyInputRef}
              type={showKey ? 'text' : 'password'}
              defaultValue={geminiKey}
              placeholder="AIza..."
              className="settings-key-input"
            />
            <button className="settings-key-toggle" onClick={() => handleEyeClick('gemini', showKey)}>
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="settings-key-status">
            <span className={`settings-status-dot ${geminiKey ? 'active' : ''}`} />
            <span className="settings-status-text">{geminiKey ? 'Aktif' : 'Girilmedi'}</span>
          </div>
        </div>
        <div className="settings-btn-row" style={{ marginTop: '10px' }}>
          <button className="settings-btn settings-btn-save" onClick={saveKey}>Kaydet</button>
          {geminiKey && (
            <button className="settings-btn settings-btn-delete-key" onClick={deleteKey}>Sil</button>
          )}
        </div>
      </div>

      {/* ===== CryptoCompare API Key ===== */}
      <div className="glass-card settings-card">
        <div className="settings-card-title">
          <Key size={16} /> CryptoCompare API Key
        </div>
        <p className="settings-desc">
          CryptoCompare haber paneli için gerekli.{' '}
          <a href="https://www.cryptocompare.com/cryptopian/api-keys" target="_blank" rel="noopener noreferrer" className="settings-link">
            Buradan alin
          </a>
        </p>
        <div className="settings-key-row">
          <div className="settings-key-input-wrap">
            <input
              ref={ccKeyInputRef}
              type={showCcKey ? 'text' : 'password'}
              defaultValue={ccKey}
              placeholder="API key..."
              className="settings-key-input"
            />
            <button className="settings-key-toggle" onClick={() => handleEyeClick('cc', showCcKey)}>
              {showCcKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="settings-key-status">
            <span className={`settings-status-dot ${ccKey ? 'active' : ''}`} />
            <span className="settings-status-text">{ccKey ? 'Aktif' : 'Girilmedi'}</span>
          </div>
        </div>
        <div className="settings-btn-row" style={{ marginTop: '10px' }}>
          <button className="settings-btn settings-btn-save" onClick={saveCcKey}>Kaydet</button>
          {ccKey && (
            <button className="settings-btn settings-btn-delete-key" onClick={deleteCcKey}>Sil</button>
          )}
        </div>
      </div>

      {/* ===== Anthropic API Key (ReachOS AI) ===== */}
      <div className="glass-card settings-card">
        <div className="settings-card-title">
          <Key size={16} /> Anthropic API Key (ReachOS AI)
        </div>
        <p className="settings-desc">
          ReachOS'un AI-augmented hook/slop kontrolleri için opsiyonel. Olmadan da temel skor çalışır.{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="settings-link">
            Buradan alın
          </a>
        </p>
        <div className="settings-key-row">
          <div className="settings-key-input-wrap">
            <input
              ref={anthropicKeyInputRef}
              type={showAnthropicKey ? 'text' : 'password'}
              defaultValue={anthropicKey}
              placeholder="sk-ant-..."
              className="settings-key-input"
            />
            <button className="settings-key-toggle" onClick={() => handleEyeClick('anthropic', showAnthropicKey)}>
              {showAnthropicKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="settings-key-status">
            <span className={`settings-status-dot ${anthropicKey ? 'active' : ''}`} />
            <span className="settings-status-text">{anthropicKey ? 'Aktif' : 'Girilmedi'}</span>
          </div>
        </div>
        <div className="settings-btn-row" style={{ marginTop: '10px' }}>
          <button className="settings-btn settings-btn-save" onClick={saveAnthropicKey}>Kaydet</button>
          {anthropicKey && (
            <button className="settings-btn settings-btn-delete-key" onClick={deleteAnthropicKey}>Sil</button>
          )}
        </div>
      </div>

      {/* ===== X Followers (ReachOS Forecast) ===== */}
      <div className="glass-card settings-card">
        <div className="settings-card-title">
          <Info size={16} /> 𝕏 Takipçi Sayısı
        </div>
        <p className="settings-desc">
          Tahmini erişim hesabı için. Boş bırakırsan forecast bloğu gizlenir.
        </p>
        <div className="settings-key-row">
          <div className="settings-key-input-wrap">
            <input
              ref={xFollowersInputRef}
              type="number"
              min="0"
              defaultValue={xFollowers || ''}
              placeholder="Örn. 1500"
              className="settings-key-input"
            />
          </div>
          <div className="settings-key-status">
            <span className={`settings-status-dot ${xFollowers ? 'active' : ''}`} />
            <span className="settings-status-text">{xFollowers ? `${xFollowers.toLocaleString('tr-TR')}` : 'Girilmedi'}</span>
          </div>
        </div>
        <div className="settings-btn-row" style={{ marginTop: '10px' }}>
          <button className="settings-btn settings-btn-save" onClick={saveXFollowers}>Kaydet</button>
        </div>
      </div>

      {/* ===== App Info ===== */}
      <div className="glass-card settings-card">
        <div className="settings-card-title">
          <Info size={16} /> Uygulama
        </div>
        <div className="settings-info-grid">
          <div className="settings-info-row">
            <span className="settings-info-label">Versiyon</span>
            <span className="settings-info-value">VK-GYM v1.0</span>
          </div>
          <div className="settings-info-row">
            <span className="settings-info-label">Depolama</span>
            <span className="settings-info-value">{stats.totalKB} KB</span>
          </div>
          <div className="settings-info-row">
            <span className="settings-info-label">Kayitli Gun</span>
            <span className="settings-info-value">{stats.dayCount} gun</span>
          </div>
        </div>
      </div>

      {/* ===== Danger Zone ===== */}
      <div className="glass-card settings-card settings-card-danger">
        <div className="settings-card-title settings-danger-title">
          <AlertTriangle size={16} /> Tehlikeli Bolge
        </div>
        <p className="settings-desc">
          Tum verileriniz kalici olarak silinir. Bu islem geri alinamaz.
        </p>
        <button className="settings-btn settings-btn-danger" onClick={() => { setDeleteModal(true); setDeleteInput(''); }}>
          <Trash2 size={16} /> Tum Verileri Sil
        </button>
      </div>

      {/* ===== Key Reveal Password Modal ===== */}
      {keyRevealModal && (
        <div className="modal-overlay" onClick={() => setKeyRevealModal(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '320px' }}>
            <h3 className="settings-modal-title" style={{ fontSize: '0.95rem' }}>
              <Key size={15} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              API Key'i Görüntüle
            </h3>
            <p className="settings-modal-desc" style={{ marginBottom: 12 }}>
              Güvenlik şifresini gir. 30 saniye sonra otomatik gizlenir.
            </p>
            <input
              ref={revealPwRef}
              className="settings-delete-input"
              type="password"
              value={revealPwInput}
              onChange={e => { setRevealPwInput(e.target.value); setRevealError(false); }}
              onKeyDown={e => e.key === 'Enter' && confirmReveal()}
              placeholder="Şifre"
              autoFocus
              style={revealError ? { borderColor: 'var(--error-color)' } : {}}
            />
            {revealError && (
              <p style={{ color: 'var(--error-color)', fontSize: '0.75rem', marginTop: 6 }}>
                Hatalı şifre.
              </p>
            )}
            <div className="settings-btn-row" style={{ marginTop: 14 }}>
              <button className="btn-cancel" onClick={() => setKeyRevealModal(null)}>İptal</button>
              <button className="btn-save" onClick={confirmReveal}>Göster</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Import Confirmation Modal ===== */}
      {importModal && (
        <div className="modal-overlay" onClick={() => setImportModal(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <h3 className="settings-modal-title">Veri Ice Aktar</h3>
            <p className="settings-modal-file">{importModal.filename}</p>
            <p className="settings-modal-desc">Mevcut verileriniz ne olsun?</p>

            <div className="settings-import-options">
              <label className={`settings-import-option ${importMode === 'merge' ? 'selected' : ''}`}>
                <input type="radio" name="importMode" value="merge" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} />
                <div>
                  <strong>Birlestir</strong>
                  <span>Mevcut verilere eklenir. Cakisan gunler import'takiyle degisir.</span>
                </div>
              </label>
              <label className={`settings-import-option ${importMode === 'replace' ? 'selected' : ''}`}>
                <input type="radio" name="importMode" value="replace" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} />
                <div>
                  <strong>Tamamen Degistir</strong>
                  <span>Mevcut tum veriler silinir, sadece import'taki veriler kalir.</span>
                </div>
              </label>
            </div>

            <div className="settings-btn-row" style={{ marginTop: '16px' }}>
              <button className="btn-cancel" onClick={() => setImportModal(null)}>Iptal</button>
              <button className="btn-save" onClick={confirmImport}>Ice Aktar</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete Confirmation Modal ===== */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '340px' }}>
            <h3 className="settings-modal-title" style={{ color: 'var(--error-color)' }}>Tum Verileri Sil</h3>
            <p className="settings-modal-desc">
              Bu islem geri alinamaz. Onaylamak icin sifreyi girin.
            </p>
            <input
              className="settings-delete-input"
              type="password"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder='Sifre'
              autoFocus
            />
            <div className="settings-btn-row" style={{ marginTop: '14px' }}>
              <button className="btn-cancel" onClick={() => setDeleteModal(false)}>Iptal</button>
              <button
                className="settings-btn settings-btn-danger"
                disabled={deleteInput !== DELETE_PASSWORD}
                onClick={confirmDeleteAll}
              >
                Onayla ve Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Toast ===== */}
      {toast && (
        <div className={`settings-toast settings-toast-${toast.type}`}>
          {toast.type === 'success' && <CheckCircle size={14} />}
          {toast.type === 'error' && <AlertTriangle size={14} />}
          {toast.type === 'info' && <Info size={14} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
