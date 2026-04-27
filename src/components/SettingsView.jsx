// SettingsView — PersonaVK v2: kategorili sol-nav + sağ panel layout.
// Tüm storage / backup / API key / silme akışları aynen korunmuştur.
import React, { useState, useRef, useEffect } from 'react';
import {
  Download, Upload, Key, Eye, EyeOff, Trash2, Info, Shield,
  CheckCircle, AlertTriangle, X, Sparkles, Database, Bot,
  ChevronRight, Zap, HardDrive, AtSign,
} from 'lucide-react';
import {
  exportAllData, exportForPlatform, validateBackup, importData, getStorageStats,
} from '../utils/backup';
import {
  getAnthropicKey, setAnthropicKey, getXFollowers, setXFollowers,
} from '../utils/storage';
import { mkTheme } from '../theme';

const ACCENT = '#00d4ff';
const DANGER = '#ef4444';
const SUCCESS = '#10b981';
const PURPLE = '#bd00ff';
const AMBER = '#f59e0b';

const GEMINI_KEY_STORAGE = 'lifeos_gemini_key';
const CC_KEY_STORAGE = 'lifeos_cc_key';
const KEY_REVEAL_PASSWORD = 'vk2017';
const DELETE_PASSWORD = 'vk2017';

const SECTIONS = [
  { key: 'keys',    label: 'API Anahtarları', sub: 'Gemini, CryptoCompare, Anthropic', icon: Key,      color: ACCENT },
  { key: 'reach',   label: 'ReachOS',         sub: 'Tahmin & profil',                  icon: Sparkles, color: PURPLE },
  { key: 'backup',  label: 'Yedekleme',       sub: 'Dışa / içe aktarma',               icon: Database, color: SUCCESS },
  { key: 'about',   label: 'Uygulama',        sub: 'Sürüm & depolama',                 icon: Info,     color: AMBER },
  { key: 'danger',  label: 'Tehlikeli Bölge', sub: 'Tüm verileri sil',                 icon: AlertTriangle, color: DANGER },
];

export default function SettingsView({ darkMode = true }) {
  const t = mkTheme(darkMode);
  const [section, setSection] = useState('keys');

  // ── State ─────────────────────────────────────────────────────
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) || '');
  const [showKey, setShowKey] = useState(false);
  const keyInputRef = useRef(null);

  const [ccKey, setCcKey] = useState(() => localStorage.getItem(CC_KEY_STORAGE) || '');
  const [showCcKey, setShowCcKey] = useState(false);
  const ccKeyInputRef = useRef(null);

  const [anthropicKey, setAnthropicKeyState] = useState(() => getAnthropicKey());
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const anthropicKeyInputRef = useRef(null);

  const [xFollowers, setXFollowersState] = useState(() => getXFollowers());
  const xFollowersInputRef = useRef(null);

  const [keyRevealModal, setKeyRevealModal] = useState(null);
  const [revealPwInput, setRevealPwInput] = useState('');
  const [revealError, setRevealError] = useState(false);
  const revealTimerRef = useRef(null);

  const fileInputRef = useRef(null);
  const [importModal, setImportModal] = useState(null);
  const [importMode, setImportMode] = useState('merge');

  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [stats] = useState(() => getStorageStats());

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // ── Reveal flow ───────────────────────────────────────────────
  const openRevealModal = (target) => { setKeyRevealModal(target); setRevealPwInput(''); setRevealError(false); };
  const confirmReveal = () => {
    if (revealPwInput !== KEY_REVEAL_PASSWORD) { setRevealError(true); return; }
    if (keyRevealModal === 'gemini') setShowKey(true);
    if (keyRevealModal === 'cc') setShowCcKey(true);
    if (keyRevealModal === 'anthropic') setShowAnthropicKey(true);
    setKeyRevealModal(null); setRevealPwInput('');
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      setShowKey(false); setShowCcKey(false); setShowAnthropicKey(false);
    }, 30000);
  };
  const handleEyeClick = (field, isShown) => {
    if (isShown) {
      if (field === 'gemini') setShowKey(false);
      if (field === 'cc') setShowCcKey(false);
      if (field === 'anthropic') setShowAnthropicKey(false);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    } else openRevealModal(field);
  };

  // ── Handlers (preserved) ──────────────────────────────────────
  const handleExport = async () => {
    try {
      const data = exportAllData();
      const jsonStr = JSON.stringify(data, null, 2);
      const date = new Date().toISOString().slice(0, 10);
      const filename = `lifeos-yedek-${date}.json`;
      const method = await exportForPlatform(jsonStr, filename);
      if (method === 'shared') showToast('Yedek dosyası paylaşıldı.');
      else if (method === 'downloaded') showToast('Yedek dosyası indirildi.');
      else showToast('Veri panoya kopyalandı. Bir metin dosyasına yapıştırın.', 'info');
    } catch (e) { showToast('Dışa aktarma başarısız: ' + e.message, 'error'); }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const validation = validateBackup(parsed);
        if (!validation.valid) { showToast(validation.error, 'error'); return; }
        setImportModal({ parsed, filename: file.name });
        setImportMode('merge');
      } catch { showToast('Geçersiz JSON dosyası.', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!importModal) return;
    try {
      importData(importModal.parsed, importMode);
      setImportModal(null);
      showToast('Veri başarıyla içe aktarıldı. Sayfa yenileniyor...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { showToast('İçe aktarma başarısız: ' + e.message, 'error'); }
  };

  const saveKey = () => {
    const val = keyInputRef.current?.value?.trim() || '';
    setGeminiKey(val);
    if (val) { localStorage.setItem(GEMINI_KEY_STORAGE, val); showToast('Gemini key kaydedildi.'); }
    else { localStorage.removeItem(GEMINI_KEY_STORAGE); showToast('Gemini key silindi.'); }
    window.dispatchEvent(new CustomEvent('lifeos_key_updated'));
  };
  const deleteKey = () => {
    setGeminiKey(''); localStorage.removeItem(GEMINI_KEY_STORAGE);
    if (keyInputRef.current) keyInputRef.current.value = '';
    showToast('Gemini key silindi.');
    window.dispatchEvent(new CustomEvent('lifeos_key_updated'));
  };
  const saveCcKey = () => {
    const val = ccKeyInputRef.current?.value?.trim() || '';
    setCcKey(val);
    if (val) { localStorage.setItem(CC_KEY_STORAGE, val); showToast('CryptoCompare key kaydedildi.'); }
    else { localStorage.removeItem(CC_KEY_STORAGE); showToast('CryptoCompare key silindi.'); }
    window.dispatchEvent(new CustomEvent('lifeos_key_updated'));
  };
  const deleteCcKey = () => {
    setCcKey(''); localStorage.removeItem(CC_KEY_STORAGE);
    if (ccKeyInputRef.current) ccKeyInputRef.current.value = '';
    showToast('CryptoCompare key silindi.');
    window.dispatchEvent(new CustomEvent('lifeos_key_updated'));
  };
  const saveAnthropic = () => {
    const val = anthropicKeyInputRef.current?.value?.trim() || '';
    setAnthropicKeyState(val); setAnthropicKey(val);
    showToast(val ? 'Anthropic key kaydedildi.' : 'Anthropic key silindi.');
  };
  const deleteAnthropic = () => {
    setAnthropicKeyState(''); setAnthropicKey('');
    if (anthropicKeyInputRef.current) anthropicKeyInputRef.current.value = '';
    showToast('Anthropic key silindi.');
  };
  const saveX = () => {
    const raw = xFollowersInputRef.current?.value || '';
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      setXFollowers(n); setXFollowersState(n); showToast('Takipçi sayısı kaydedildi.');
    } else {
      setXFollowers(0); setXFollowersState(0); showToast('Takipçi sayısı temizlendi.');
    }
  };
  const confirmDeleteAll = () => {
    if (deleteInput !== DELETE_PASSWORD) return;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('lifeos_')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    ['pvk_tab', 'pvk_sidebar', 'pvk_dark'].forEach(k => localStorage.removeItem(k));
    setDeleteModal(false);
    showToast('Tüm veriler silindi. Sayfa yenileniyor...');
    setTimeout(() => window.location.reload(), 1500);
  };

  // ── Style helpers ─────────────────────────────────────────────
  const cardBase = {
    background: t.card, border: t.cardBorder, borderRadius: 18,
    boxShadow: t.cardShadow, color: t.text, padding: 18,
  };
  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    background: t.input, border: `1px solid ${t.inputBorder}`,
    color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };
  const eyeBtn = {
    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
    width: 30, height: 30, borderRadius: 8, border: 'none',
    background: 'transparent', color: t.muted, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const btn = (variant = 'default', extra = {}) => {
    const variants = {
      default:  { bg: t.hover, color: t.text, border: `1px solid ${t.inputBorder}` },
      primary:  { bg: ACCENT, color: '#0a0a0a', border: 'none' },
      ghost:    { bg: 'transparent', color: t.text, border: `1px solid ${t.inputBorder}` },
      danger:   { bg: DANGER, color: '#fff', border: 'none' },
      dangerSoft: { bg: 'rgba(239,68,68,0.12)', color: DANGER, border: '1px solid rgba(239,68,68,0.3)' },
    };
    const v = variants[variant] || variants.default;
    return {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
      background: v.bg, color: v.color, border: v.border,
      fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
      transition: 'transform 0.1s, opacity 0.15s',
      ...extra,
    };
  };
  const sectionTitle = (color) => ({
    fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
    color: color || t.muted, marginBottom: 4,
  });
  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20,
  };
  const modalStyle = (max = 380) => ({ ...cardBase, padding: 22, maxWidth: max, width: '100%' });

  // Status pill (active/inactive)
  const StatusPill = ({ active, label }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: active ? `${SUCCESS}15` : t.hover,
      color: active ? SUCCESS : t.muted,
      border: `1px solid ${active ? `${SUCCESS}40` : t.inputBorder}`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: active ? SUCCESS : t.muted,
        boxShadow: active ? `0 0 6px ${SUCCESS}` : 'none',
      }} />
      {label}
    </span>
  );

  // Key card subcomponent
  const KeyField = ({ icon, title, descNode, accentColor, value, refEl, show, onEye, onSave, onDelete, placeholder, type = 'text' }) => (
    <div style={{ ...cardBase, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `${accentColor}15`, color: accentColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{title}</div>
            <StatusPill
              active={!!value}
              label={
                type === 'number'
                  ? (value ? `${(+value).toLocaleString('tr-TR')}` : 'Girilmedi')
                  : (value ? 'Aktif' : 'Girilmedi')
              }
            />
          </div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 4, lineHeight: 1.5 }}>{descNode}</div>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 10 }}>
        <input
          ref={refEl}
          type={type === 'number' ? 'number' : (show ? 'text' : 'password')}
          min={type === 'number' ? '0' : undefined}
          defaultValue={value || ''}
          placeholder={placeholder}
          style={{ ...inputStyle, paddingRight: onEye ? 44 : 14 }}
        />
        {onEye && (
          <button type="button" style={eyeBtn} onClick={onEye} title={show ? 'Gizle' : 'Göster'}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btn('primary')} onClick={onSave}>Kaydet</button>
        {onDelete && value && (
          <button style={btn('dangerSoft')} onClick={onDelete}>
            <Trash2 size={13} /> Sil
          </button>
        )}
      </div>
    </div>
  );

  // ── Section panels ────────────────────────────────────────────
  const renderSection = () => {
    if (section === 'keys') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <KeyField
          icon={<Sparkles size={18} />}
          title="Gemini API Key"
          accentColor={ACCENT}
          descNode={<>İçerik üretimi için gerekli. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>Buradan al ↗</a></>}
          value={geminiKey}
          refEl={keyInputRef}
          show={showKey}
          onEye={() => handleEyeClick('gemini', showKey)}
          onSave={saveKey}
          onDelete={deleteKey}
          placeholder="AIza..."
        />
        <KeyField
          icon={<Database size={18} />}
          title="CryptoCompare API Key"
          accentColor={AMBER}
          descNode={<>Haber paneli için gerekli. <a href="https://www.cryptocompare.com/cryptopian/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>Buradan al ↗</a></>}
          value={ccKey}
          refEl={ccKeyInputRef}
          show={showCcKey}
          onEye={() => handleEyeClick('cc', showCcKey)}
          onSave={saveCcKey}
          onDelete={deleteCcKey}
          placeholder="API key..."
        />
        <KeyField
          icon={<Bot size={18} />}
          title="Anthropic API Key"
          accentColor={PURPLE}
          descNode={<>ReachOS AI-augmented kontroller için opsiyonel. <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>Buradan al ↗</a></>}
          value={anthropicKey}
          refEl={anthropicKeyInputRef}
          show={showAnthropicKey}
          onEye={() => handleEyeClick('anthropic', showAnthropicKey)}
          onSave={saveAnthropic}
          onDelete={deleteAnthropic}
          placeholder="sk-ant-..."
        />
      </div>
    );

    if (section === 'reach') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <KeyField
          icon={<AtSign size={18} />}
          title="𝕏 Takipçi Sayısı"
          accentColor={PURPLE}
          descNode="Tahmini erişim hesabı için. Boş bırakırsan forecast bloğu gizlenir."
          value={xFollowers || ''}
          refEl={xFollowersInputRef}
          show={true}
          onEye={null}
          onSave={saveX}
          onDelete={null}
          placeholder="Örn. 1500"
          type="number"
        />
        <div style={cardBase}>
          <div style={sectionTitle()}>NASIL ÇALIŞIR</div>
          <div style={{ fontSize: 13, color: t.text, lineHeight: 1.6, marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <Zap size={16} color={ACCENT} style={{ flexShrink: 0, marginTop: 2 }} />
              <span><b>Reach Score:</b> Üretilen tweet'in 50+ kuralla puanlanması.</span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <Sparkles size={16} color={PURPLE} style={{ flexShrink: 0, marginTop: 2 }} />
              <span><b>Forecast:</b> Takipçi sayına göre tahmini gösterim/etkileşim.</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Bot size={16} color={SUCCESS} style={{ flexShrink: 0, marginTop: 2 }} />
              <span><b>AI-augmented:</b> Anthropic key varsa hook & slop kontrolü Claude ile.</span>
            </div>
          </div>
        </div>
      </div>
    );

    if (section === 'backup') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={cardBase}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: `${SUCCESS}15`, color: SUCCESS,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Veri Yedekleme</div>
              <div style={{ fontSize: 12, color: t.muted, marginTop: 4, lineHeight: 1.5 }}>
                Tüm verilerini JSON dosyası olarak yedekle ya da başka bir cihazdan içeri aktar.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={btn('primary', { flex: 1, minWidth: 140 })} onClick={handleExport}>
              <Download size={15} /> Dışa Aktar
            </button>
            <button style={btn('ghost', { flex: 1, minWidth: 140 })} onClick={() => fileInputRef.current?.click()}>
              <Upload size={15} /> İçe Aktar
            </button>
            <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileSelect} />
          </div>
        </div>
      </div>
    );

    if (section === 'about') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={cardBase}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: `linear-gradient(135deg, ${ACCENT}, ${PURPLE})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#0a0a0a', fontWeight: 800, fontSize: 18,
            }}>
              VK
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>PersonaVK</div>
              <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>v1.0 — Habit & Content OS</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: HardDrive, label: 'Depolama', value: `${stats.totalKB} KB`, color: ACCENT },
              { icon: Database, label: 'Kayıtlı Gün', value: `${stats.dayCount} gün`, color: SUCCESS },
            ].map(({ icon: Ic, label, value, color }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', borderRadius: 12,
                background: t.hover, border: `1px solid ${t.inputBorder}`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `${color}15`, color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ic size={15} />
                </div>
                <span style={{ flex: 1, fontSize: 13, color: t.muted }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    if (section === 'danger') return (
      <div style={{
        ...cardBase,
        border: `1px solid rgba(239,68,68,0.4)`,
        background: darkMode ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: `${DANGER}15`, color: DANGER,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: DANGER }}>Tehlikeli Bölge</div>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 4, lineHeight: 1.5 }}>
              Tüm verileriniz (alışkanlıklar, görevler, takvim, içerikler, API anahtarları) kalıcı olarak silinir.
              Bu işlem <b style={{ color: DANGER }}>geri alınamaz</b>.
            </div>
          </div>
        </div>
        <button style={btn('danger')} onClick={() => { setDeleteModal(true); setDeleteInput(''); }}>
          <Trash2 size={15} /> Tüm Verileri Sil
        </button>
      </div>
    );

    return null;
  };

  // ── Layout ────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative' }}>
      {/* Page header */}
      <div className="page-title" style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: '-0.5px' }}>Ayarlar</div>
        <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>
          API anahtarları, yedekleme ve uygulama yönetimi
        </div>
      </div>

      <div className="settings-grid">

        {/* Nav — desktop sidebar / mobile horizontal pill tabs */}
        <div
          className="settings-nav"
          style={{
            background: t.card, border: t.cardBorder, borderRadius: 18,
            boxShadow: t.cardShadow, color: t.text, padding: 8,
          }}
        >
          {SECTIONS.map(s => {
            const Ic = s.icon;
            const active = section === s.key;
            return (
              <button
                key={s.key}
                className={`settings-nav-btn ${active ? 'is-active' : ''}`}
                onClick={() => setSection(s.key)}
                style={{
                  border: 'none', cursor: 'pointer',
                  background: active ? t.hover : 'transparent',
                  color: t.text, fontFamily: 'inherit', textAlign: 'left',
                  transition: 'background 0.15s',
                  '--pvk-active-color': s.color,
                  '--pvk-active-bg': `${s.color}20`,
                  '--pvk-active-border': `${s.color}40`,
                }}
              >
                <div className="settings-nav-icon" style={{
                  background: active ? `${s.color}20` : t.hover,
                  color: s.color,
                  border: active ? `1px solid ${s.color}40` : `1px solid transparent`,
                }}>
                  <Ic size={16} />
                </div>
                <div className="settings-nav-label">
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{s.label}</div>
                  <div className="settings-nav-sub" style={{ color: t.muted }}>
                    {s.sub}
                  </div>
                </div>
                <ChevronRight className="settings-nav-chev" size={14} color={t.muted} style={{ opacity: active ? 1 : 0.4 }} />
              </button>
            );
          })}
        </div>

        {/* Right panel */}
        <div className="settings-panel">
          {renderSection()}
        </div>
      </div>

      {/* ── Reveal modal ──────────────────────────────────────── */}
      {keyRevealModal && (
        <div style={overlayStyle} onClick={() => setKeyRevealModal(null)}>
          <div style={modalStyle(340)} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: t.text }}>
                <Key size={16} color={ACCENT} /> API Key'i Görüntüle
              </div>
              <button onClick={() => setKeyRevealModal(null)} style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: t.muted, marginBottom: 12, lineHeight: 1.5 }}>
              Güvenlik şifresini gir. Anahtar 30 saniye sonra otomatik gizlenir.
            </div>
            <input
              type="password"
              value={revealPwInput}
              onChange={e => { setRevealPwInput(e.target.value); setRevealError(false); }}
              onKeyDown={e => e.key === 'Enter' && confirmReveal()}
              placeholder="Şifre"
              autoFocus
              style={{ ...inputStyle, borderColor: revealError ? DANGER : t.inputBorder }}
            />
            {revealError && <div style={{ color: DANGER, fontSize: 12, marginTop: 6 }}>Hatalı şifre.</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button style={{ ...btn('ghost'), flex: 1 }} onClick={() => setKeyRevealModal(null)}>İptal</button>
              <button style={{ ...btn('primary'), flex: 1 }} onClick={confirmReveal}>Göster</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import modal ──────────────────────────────────────── */}
      {importModal && (
        <div style={overlayStyle} onClick={() => setImportModal(null)}>
          <div style={modalStyle()} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: t.text, marginBottom: 6 }}>
              <Upload size={16} color={ACCENT} /> Veri İçe Aktar
            </div>
            <div style={{ fontSize: 12, color: ACCENT, marginBottom: 10, fontFamily: 'monospace' }}>
              {importModal.filename}
            </div>
            <div style={{ fontSize: 13, color: t.muted, marginBottom: 12 }}>Mevcut verileriniz ne olsun?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { key: 'merge', title: 'Birleştir', sub: 'Mevcut verilere eklenir. Çakışan günler import\'takiyle değişir.' },
                { key: 'replace', title: 'Tamamen Değiştir', sub: 'Mevcut tüm veriler silinir, sadece import\'taki veriler kalır.' },
              ].map(opt => {
                const sel = importMode === opt.key;
                return (
                  <label key={opt.key} style={{
                    display: 'flex', gap: 10, padding: 12, borderRadius: 12,
                    border: `2px solid ${sel ? ACCENT : t.inputBorder}`,
                    background: sel ? `${ACCENT}15` : t.hover, cursor: 'pointer',
                  }}>
                    <input
                      type="radio" name="importMode" value={opt.key}
                      checked={sel} onChange={() => setImportMode(opt.key)}
                      style={{ marginTop: 2, accentColor: ACCENT }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ fontSize: 13, color: t.text }}>{opt.title}</strong>
                      <span style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{opt.sub}</span>
                    </div>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button style={{ ...btn('ghost'), flex: 1 }} onClick={() => setImportModal(null)}>İptal</button>
              <button style={{ ...btn('primary'), flex: 1 }} onClick={confirmImport}>İçe Aktar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete modal ──────────────────────────────────────── */}
      {deleteModal && (
        <div style={overlayStyle} onClick={() => setDeleteModal(false)}>
          <div style={modalStyle(340)} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: DANGER, marginBottom: 8 }}>
              <AlertTriangle size={16} /> Tüm Verileri Sil
            </div>
            <div style={{ fontSize: 13, color: t.muted, marginBottom: 12 }}>
              Bu işlem geri alınamaz. Onaylamak için şifreyi girin.
            </div>
            <input
              type="password"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder="Şifre"
              autoFocus
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button style={{ ...btn('ghost'), flex: 1 }} onClick={() => setDeleteModal(false)}>İptal</button>
              <button
                style={{
                  ...btn('danger'), flex: 1,
                  opacity: deleteInput === DELETE_PASSWORD ? 1 : 0.5,
                  cursor: deleteInput === DELETE_PASSWORD ? 'pointer' : 'not-allowed',
                }}
                disabled={deleteInput !== DELETE_PASSWORD}
                onClick={confirmDeleteAll}
              >
                Onayla ve Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 18px', borderRadius: 12, zIndex: 1100,
          background: t.cardDark, color: t.cardDarkText,
          boxShadow: t.shadow, fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 10,
          borderLeft: `3px solid ${
            toast.type === 'error' ? DANGER :
            toast.type === 'info' ? ACCENT : SUCCESS
          }`,
        }}>
          {toast.type === 'success' && <CheckCircle size={15} color={SUCCESS} />}
          {toast.type === 'error' && <AlertTriangle size={15} color={DANGER} />}
          {toast.type === 'info' && <Info size={15} color={ACCENT} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
