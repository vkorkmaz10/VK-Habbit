import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, Key, Eye, EyeOff, Trash2, Info, Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import {
  exportAllData,
  exportForPlatform,
  validateBackup,
  importData,
  getStorageStats,
} from '../utils/backup';

const GEMINI_KEY_STORAGE = 'vkgym_gemini_key';

export default function SettingsView() {
  // Gemini key
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) || '');
  const [showKey, setShowKey] = useState(false);
  const keyInputRef = useRef(null);

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
  };

  const deleteKey = () => {
    setGeminiKey('');
    localStorage.removeItem(GEMINI_KEY_STORAGE);
    if (keyInputRef.current) keyInputRef.current.value = '';
    showToast('API anahtari silindi.');
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
            <button className="settings-key-toggle" onClick={() => setShowKey(s => !s)}>
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
