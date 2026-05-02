import React, { useState, useCallback } from 'react';
import { mkTheme } from '../theme';
import { buildSystemPrompt } from '../utils/smCreatorKnowledge';

const GEMINI_KEY_STORAGE = 'engine_gemini_key';
const HISTORY_KEY = 'engine_history';
const MAX_HISTORY = 30;
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

const PLATFORMS = [
  { id: 'x',          label: '𝕏 Twitter',  short: '𝕏'  },
  { id: 'linkedin',   label: 'LinkedIn',   short: 'in' },
  { id: 'instagram',  label: 'Instagram',  short: 'IG' },
  { id: 'tiktok',     label: 'TikTok',     short: 'TT' },
  { id: 'youtube',    label: 'YouTube',    short: 'YT' },
  { id: 'newsletter', label: 'Newsletter', short: '✉'  },
  { id: 'threads',    label: 'Threads',    short: 'Th' },
  { id: 'facebook',   label: 'Facebook',   short: 'fb' },
];

const PLATFORM_TIPS = {
  x: [
    { icon: '🔗', text: 'Linkleri reply\'a koy — ana tweet\'te link varsa algoritma cezalandırır.' },
    { icon: '#️⃣', text: 'Hashtag kullanma. Hiç. Spam görünür, reach düşer.' },
    { icon: '⏰', text: 'En iyi saatler: 09-11, 12-13, 20-23. Paylaştıktan sonra 30 dk reply\'lara gir.' },
    { icon: '📏', text: 'Sweet spot: 1.000-2.000 karakter. Çok kısa = değersiz. Çok uzun = kaybeder.' },
    { icon: '🎣', text: 'İlk satır her şey — contrarian hook veya proof hook en iyi performansı verir.' },
  ],
  linkedin: [
    { icon: '🔗', text: 'Linkleri ilk comment\'e koy — post body\'de link varsa algoritma gösterimi kısar.' },
    { icon: '✂️', text: 'İlk ~210 karakter kritik — "daha fazla gör" kesmeden önce hook bitmiş olmalı.' },
    { icon: '#️⃣', text: 'Hashtag varsa body\'ye değil, en sona max 3 tane. Body\'de hiç kullanma.' },
    { icon: '🕗', text: 'En iyi saatler: 07-08, 12:00, 17-18. Paylaşmadan önce 10 alakalı post\'a comment at.' },
    { icon: '📝', text: 'Kısa paragraflar — her fikir ayrı paragraf. Beyaz alan senin arkadaşın.' },
  ],
  instagram: [
    { icon: '🖼️', text: 'Carousel king — 7-10 slide. Slide 1 = hook (max 8 kelime, bold, contrarian).' },
    { icon: '#️⃣', text: '5-10 hashtag caption sonuna. Instagram\'da hashtag gerçekten discovery sağlar.' },
    { icon: '📢', text: 'Son slide\'a CTA koy: "Kaydet", "Takip et", "Paylaş" — ikisi birden olmasın.' },
    { icon: '✍️', text: 'Caption slide\'ları tekrar etmesin — farklı bir açı veya ek bağlam ekle.' },
    { icon: '🎨', text: 'Tüm slide\'larda tutarlı renk şeması. Her slide\'da max 30 kelime.' },
  ],
  tiktok: [
    { icon: '⚡', text: 'İlk 2 saniye hook — kaybedersen geri kazanamazsın. "Hey guys" tarzı intro YOK.' },
    { icon: '📱', text: 'Altyazı/text overlay zorunlu — izleyicilerin çoğu sesi kapalı izler.' },
    { icon: '📹', text: 'Screen recording + voiceover AI/tech içerik için en iyi format.' },
    { icon: '📅', text: '30 gün tutarlı paylaşmadan sonuç bekleme. Algoritma sabır ister.' },
    { icon: '🎯', text: 'Bir post\'ta bir fikir. Her şeyi sığdırmaya çalışma — odak kes.' },
  ],
  youtube: [
    { icon: '🔍', text: 'Başlık her şey — SEO odaklı, merak uyandıran, spesifik. Max 60 karakter.' },
    { icon: '⏱️', text: 'Description\'ın ilk 2 satırı "daha fazla gör" kesmeden görünür — hook + link buraya.' },
    { icon: '📑', text: 'Timestamp\'leri description\'a ekle — YouTube chapter\'ları aktif eder, watch time artar.' },
    { icon: '🎬', text: 'İlk 30 saniye: problem + çözüm vaadi. Sonra konu. Uzun intro = izleyici kaçar.' },
    { icon: '🌿', text: 'Evergreen içerik — yıllarca view alır. Trend değil, kalıcı konuları seç.' },
  ],
  newsletter: [
    { icon: '📧', text: 'Subject line = hook. "Haftalık Bülten #47" kimse açmaz. Başlık vaad etmeli.' },
    { icon: '✉️', text: 'Plain text > süslü template. Fancy görünüm = marketing spam hissi. Gerçek insan gibi yaz.' },
    { icon: '🎯', text: 'Bir issue, bir konu. Her şeyi sıkıştırma — derinlik tercih et.' },
    { icon: '📢', text: 'Sonda tek CTA — reply at, linke tıkla, bir şey dene. Birden fazla CTA = hiçbiri.' },
    { icon: '💡', text: 'Sosyal medyada paylaşmadığın exclusive insight ekle — aboneliği değerli kılan bu.' },
  ],
  threads: [
    { icon: '🔗', text: 'Link kullanma — Threads linki cezalandırır, tamamen kaldır.' },
    { icon: '#️⃣', text: 'Hashtag yok. Pure text engagement. Algoritma hashtag sevmez.' },
    { icon: '💬', text: 'Shower thought enerjisi — "hot take:", "unpopular opinion:" açılışları çok iyi çalışır.' },
    { icon: '📏', text: 'Post başına max 500 karakter. 1-3 kısa post serisi en iyi format.' },
  ],
  facebook: [
    { icon: '❓', text: 'Sona soru ekle — yorum sayısını 3-5x artırır. Algoritma yorumu seviyor.' },
    { icon: '🎥', text: 'Native video yükle — external link\'ten çok daha fazla reach alır.' },
    { icon: '👥', text: 'Profil + ilgili gruplara paylaş. Grup paylaşımı organic reach\'i katlar.' },
    { icon: '🤝', text: 'Taktik playbook değil, kişisel hikaye — Facebook topluluğu bağlantı ister.' },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); } catch {}
}

async function callGemini(apiKey, userPrompt, systemPrompt) {
  let lastErr;
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 8192 },
    };
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        lastErr = new Error(err?.error?.message || `API hatası: ${res.status}`);
        if (i < GEMINI_MODELS.length - 1) await new Promise(r => setTimeout(r, 800));
        continue;
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } catch (e) {
      lastErr = e;
      if (i < GEMINI_MODELS.length - 1) await new Promise(r => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

function parseResults(raw) {
  const result = {};
  PLATFORMS.forEach(p => {
    const re = new RegExp(`\\[PLATFORM:${p.id}\\]([\\s\\S]*?)\\[/PLATFORM\\]`, 'i');
    const m = raw.match(re);
    result[p.id] = m ? m[1].trim() : '';
  });
  // fallback: tüm platformlar boşsa JSON dene
  const hasContent = PLATFORMS.some(p => result[p.id]);
  if (!hasContent) {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    PLATFORMS.forEach(p => { result[p.id] = typeof parsed[p.id] === 'string' ? parsed[p.id] : ''; });
  }
  return result;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Icons ──────────────────────────────────────────────────────────────────

function ZapIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function CopyIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function PlusIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function TrashIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
function SpinnerIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'engine-spin 0.8s linear infinite' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ContentEngine({ darkMode }) {
  const t = mkTheme(darkMode);

  // API key state
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) || '');
  const [keyInput, setKeyInput] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);

  // Editor state
  const [topic, setTopic] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]); // boş = hepsi
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [activePlatform, setActivePlatform] = useState('x');
  const [copiedPlatform, setCopiedPlatform] = useState(null);

  function togglePlatform(id) {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  // History state
  const [history, setHistory] = useState(loadHistory);
  const [activeHistoryId, setActiveHistoryId] = useState(null);

  function saveKey() {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
    setApiKey(trimmed);
    setKeyInput('');
  }

  function startNew() {
    setTopic('');
    setResults(null);
    setError(null);
    setActivePlatform('x');
    setActiveHistoryId(null);
    setSelectedPlatforms([]);
  }

  function loadFromHistory(item) {
    setTopic(item.topic);
    setResults(item.results);
    setError(null);
    setActivePlatform('x');
    setActiveHistoryId(item.id);
  }

  function deleteHistoryItem(id, e) {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
    if (activeHistoryId === id) startNew();
  }

  async function handleGenerate() {
    if (!topic.trim() || loading) return;
    if (!apiKey) { setError('Gemini API key girilmedi.'); return; }
    setLoading(true);
    setError(null);
    setResults(null);
    setActiveHistoryId(null);

    const targetPlatforms = selectedPlatforms.length > 0
      ? selectedPlatforms
      : PLATFORMS.map(p => p.id);

    try {
      const sys = buildSystemPrompt(targetPlatforms);
      const usr = `Konu: ${topic.trim()}\n\nBu konu için şu platformlar için ayrı ayrı Türkçe içerik üret: ${targetPlatforms.join(', ')}`;
      const raw = await callGemini(apiKey, usr, sys);
      const parsed = parseResults(raw);

      // Normalize — sadece hedef platformlar, geri kalanlar boş
      const safe = {};
      PLATFORMS.forEach(p => {
        safe[p.id] = targetPlatforms.includes(p.id)
          ? (typeof parsed[p.id] === 'string' ? parsed[p.id] : '')
          : '';
      });

      setResults(safe);
      setActivePlatform(targetPlatforms[0] || 'x');

      // Save to history
      const item = { id: Date.now(), topic: topic.trim(), results: safe, createdAt: new Date().toISOString() };
      const updated = [item, ...history].slice(0, MAX_HISTORY);
      setHistory(updated);
      saveHistory(updated);
      setActiveHistoryId(item.id);
    } catch (err) {
      setError(err.message || 'Bir hata oluştu. Tekrar dene.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(platformId) {
    const text = results?.[platformId];
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedPlatform(platformId);
      setTimeout(() => setCopiedPlatform(null), 1800);
    });
  }

  const activePlatformObj = PLATFORMS.find(p => p.id === activePlatform) || PLATFORMS[0];
  const hasResults = !!results;
  // Sadece içeriği olan platformları göster
  const visiblePlatforms = results
    ? PLATFORMS.filter(p => results[p.id])
    : PLATFORMS;

  return (
    <div style={{ paddingBottom: 40 }}>
      <style>{`
        @keyframes engine-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .engine-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.5fr); gap: 16px; align-items: start; }
        .history-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; }
        .hist-card { flex-shrink: 0; width: 200px; cursor: pointer; border-radius: 14px; padding: 14px; transition: all 0.15s; position: relative; }
        .hist-card:hover .hist-delete { opacity: 1; }
        .hist-delete { opacity: 0; transition: opacity 0.15s; }
        @media (max-width: 768px) { .engine-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
            <ZapIcon size={20} color={t.text} />
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.text }}>İçerik Motoru</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: t.muted }}>Bir konu gir — 8 platform için hazır içerik üret</p>
        </div>
        {hasResults && (
          <button onClick={startNew} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 12, border: `1px solid ${t.border}`,
            background: t.card, color: t.text, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}>
            <PlusIcon size={14} />
            Yeni İçerik
          </button>
        )}
      </div>

      {/* ── Main Grid ── */}
      <div className="engine-grid">

        {/* LEFT: Input panel */}
        <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 16, padding: 20, boxShadow: t.cardShadow, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Topic */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 8 }}>Konu veya fikir</label>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder={"Bugün ne hakkında içerik üretmek istiyorsun?\n\nÖrn: AI ile 10 sosyal medya hesabını otomatik yönetmek"}
              rows={5}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
              style={{
                width: '100%', background: t.input, border: `1px solid ${t.inputBorder}`,
                borderRadius: 12, padding: '11px 13px', color: t.text, fontSize: 14,
                lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = t.text}
              onBlur={e => e.target.style.borderColor = t.inputBorder}
            />
            <p style={{ margin: '5px 0 0', fontSize: 11, color: t.muted }}>⌘+Enter ile üret</p>
          </div>

          {/* Gemini Key */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Gemini API Key</label>
              {apiKey && <span style={{ fontSize: 11, color: t.text, fontWeight: 500 }}>✓ Kayıtlı</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={keyVisible ? 'text' : 'password'}
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveKey()}
                placeholder={apiKey ? '••••••• (değiştirmek için yaz)' : 'AIza...'}
                style={{
                  flex: 1, background: t.input, border: `1px solid ${t.inputBorder}`,
                  borderRadius: 10, padding: '9px 12px', color: t.text, fontSize: 13,
                  fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button onClick={() => setKeyVisible(v => !v)} style={{ padding: '9px 11px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.input, color: t.muted, cursor: 'pointer', fontSize: 13 }}>
                {keyVisible ? '🙈' : '👁'}
              </button>
              {keyInput.trim() && (
                <button onClick={saveKey} style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: t.accent, color: t.accentText, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Kaydet
                </button>
              )}
            </div>
            {!apiKey && (
              <p style={{ margin: '5px 0 0', fontSize: 11, color: t.muted }}>
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: t.text }}>aistudio.google.com/apikey</a> adresinden ücretsiz alabilirsin
              </p>
            )}
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim() || !apiKey}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px 20px', borderRadius: 12, border: 'none',
              cursor: loading || !topic.trim() || !apiKey ? 'not-allowed' : 'pointer',
              background: loading || !topic.trim() || !apiKey ? t.hover : t.accent,
              color: loading || !topic.trim() || !apiKey ? t.muted : t.accentText,
              fontSize: 15, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >
            {loading ? <><SpinnerIcon size={16} /> Üretiliyor...</> : <><ZapIcon size={16} color="currentColor" /> İçerik Üret</>}
          </button>

          {/* Platform seçici */}
          <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                Platformlar
              </label>
              <button
                onClick={() => setSelectedPlatforms(selectedPlatforms.length === PLATFORMS.length ? [] : PLATFORMS.map(p => p.id))}
                style={{ fontSize: 11, color: t.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                {selectedPlatforms.length === PLATFORMS.length ? 'Temizle' : selectedPlatforms.length === 0 ? 'Tümünü seç' : `${selectedPlatforms.length} seçili · temizle`}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PLATFORMS.map(p => {
                const sel = selectedPlatforms.includes(p.id);
                const done = results?.[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    style={{
                      padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                      border: `1.5px solid ${sel ? t.text : done ? t.border : t.border}`,
                      background: sel ? t.hover : done ? t.border : 'transparent',
                      color: sel ? t.text : done ? t.text : t.muted,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                  >
                    {done && !sel ? '✓ ' : sel ? '● ' : ''}{p.label}
                  </button>
                );
              })}
            </div>
            <p style={{ margin: '7px 0 0', fontSize: 11, color: t.muted }}>
              {selectedPlatforms.length === 0
                ? 'Seçim yapılmazsa tüm platformlar üretilir'
                : `Sadece seçili ${selectedPlatforms.length} platform üretilecek`}
            </p>
          </div>
        </div>

        {/* RIGHT: Output panel */}
        <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 16, boxShadow: t.cardShadow, overflow: 'hidden', minHeight: 400 }}>

          {/* Error */}
          {error && !loading && (
            <div style={{ margin: 16, padding: '12px 16px', background: t.border, border: `1px solid ${t.inputBorder}`, borderRadius: 12 }}>
              <p style={{ margin: 0, fontSize: 14, color: t.text, lineHeight: 1.6 }}>{error}</p>
            </div>
          )}

          {/* Empty / loading */}
          {!results && !error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12, color: t.muted }}>
              {loading ? (
                <>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2" strokeLinecap="round" style={{ animation: 'engine-spin 1s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  <p style={{ margin: 0, fontSize: 14 }}>8 platform için içerik üretiliyor...</p>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>20–30 saniye sürebilir</p>
                </>
              ) : (
                <>
                  <ZapIcon size={36} color={t.muted} />
                  <p style={{ margin: 0, fontSize: 14 }}>Konu gir ve üret butonuna bas</p>
                  {history.length > 0 && <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>veya aşağıdan geçmişe bak</p>}
                </>
              )}
            </div>
          )}

          {/* Results */}
          {results && !loading && (
            <>
              {/* Tab bar — sadece üretilen platformlar */}
              <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${t.border}`, scrollbarWidth: 'none' }}>
                {visiblePlatforms.map(p => {
                  const active = activePlatform === p.id;
                  return (
                    <button key={p.id} onClick={() => setActivePlatform(p.id)} style={{
                      padding: '11px 13px', border: 'none', flexShrink: 0,
                      borderBottom: active ? `2px solid ${t.text}` : '2px solid transparent',
                      background: 'transparent', cursor: 'pointer',
                      color: active ? t.text : t.muted,
                      fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: 'inherit',
                      whiteSpace: 'nowrap', transition: 'all 0.15s',
                    }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Content */}
              <div style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{activePlatformObj.label}</span>
                  <button onClick={() => handleCopy(activePlatform)} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8,
                    border: `1px solid ${t.border}`, background: copiedPlatform === activePlatform ? t.hover : t.input,
                    color: copiedPlatform === activePlatform ? t.text : t.muted,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                  }}>
                    <CopyIcon />
                    {copiedPlatform === activePlatform ? 'Kopyalandı!' : 'Kopyala'}
                  </button>
                </div>

                {/* Content box — safe string rendering */}
                <div style={{
                  background: t.input, border: `1px solid ${t.inputBorder}`, borderRadius: 12,
                  padding: '13px 15px', fontSize: 14, color: t.text, lineHeight: 1.75,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  maxHeight: 440, overflowY: 'auto', fontFamily: 'inherit',
                }}>
                  {String(results[activePlatform] || 'Bu platform için içerik üretilemedi.')}
                </div>

                {/* Platform tips */}
                {PLATFORM_TIPS[activePlatform] && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {activePlatformObj.label} tüyoları
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {PLATFORM_TIPS[activePlatform].map((tip, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 9,
                          padding: '8px 11px', borderRadius: 10,
                          background: t.hover,
                          border: `1px solid ${t.inputBorder}`,
                        }}>
                          <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.5 }}>{tip.icon}</span>
                          <span style={{ fontSize: 12, color: t.text, lineHeight: 1.55 }}>{tip.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick copy row */}
                <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                  {visiblePlatforms.map(p => (
                    <button key={p.id} onClick={() => handleCopy(p.id)} title={`${p.label} kopyala`} style={{
                      padding: '3px 9px', borderRadius: 20,
                      border: `1px solid ${copiedPlatform === p.id ? t.text : t.border}`,
                      background: copiedPlatform === p.id ? t.hover : 'transparent',
                      color: copiedPlatform === p.id ? t.text : t.muted,
                      fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                    }}>
                      {copiedPlatform === p.id ? '✓' : p.short}
                    </button>
                  ))}
                  <span style={{ fontSize: 11, color: t.muted, marginLeft: 2 }}>hızlı kopyala</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── History ── */}
      {history.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Geçmiş — {history.length} içerik
          </p>
          <div className="history-scroll">
            {history.map(item => {
              const isActive = activeHistoryId === item.id;
              return (
                <div
                  key={item.id}
                  className="hist-card"
                  onClick={() => loadFromHistory(item)}
                  style={{
                    background: isActive ? `${t.card}` : t.card,
                    border: `1px solid ${isActive ? t.text : t.cardBorder}`,
                    boxShadow: isActive ? `0 0 0 2px ${t.border}` : t.cardShadow,
                  }}
                >
                  {/* Delete button */}
                  <button
                    className="hist-delete"
                    onClick={(e) => deleteHistoryItem(item.id, e)}
                    title="Sil"
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      padding: '3px 5px', borderRadius: 6, border: 'none',
                      background: t.border, color: t.text,
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                    }}
                  >
                    <TrashIcon size={12} />
                  </button>

                  {/* Topic */}
                  <p style={{
                    margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: t.text,
                    lineHeight: 1.4, paddingRight: 20,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {item.topic}
                  </p>

                  {/* Platform dots */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                    {PLATFORMS.map(p => (
                      <span key={p.id} style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: item.results?.[p.id] ? t.text : t.border,
                        flexShrink: 0,
                      }} title={p.label} />
                    ))}
                  </div>

                  {/* Date */}
                  <p style={{ margin: 0, fontSize: 11, color: t.muted }}>{formatDate(item.createdAt)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
