// ContentPage — yeni PersonaVK iki-sütunlu içerik üretici.
// Sol: CryptoCompare haber akışı. Sağ: Reach Score + İçerik Stili + İçerik Alanı.
// Tek textarea workflow: haber seç → mode/stil seç → "AI ile Üret" → textarea dolar.
// Reach Score textarea içeriğinden canlı hesaplanır.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, Loader, Sparkles, Cpu, Bitcoin, Copy, Check } from 'lucide-react';
import { fetchCPNews, scrapeArticle } from '../utils/news';
import { saveFeedback, getXFollowers } from '../utils/storage';
import { buildTweetPrompt, buildThreadPrompt, STYLE_CONFIG } from '../engine/vse';
import { scoreTweet, buildBoostPrompt } from '../engine/reach';
import { mkTheme } from '../theme';
import ReachScoreBadge from './ReachScoreBadge';

const ACCENT = '#00d4ff';
const GEMINI_KEY_STORAGE = 'vkgym_gemini_key';
const CC_KEY_STORAGE = 'vkgym_cc_key';
const CACHE_TTL = 5 * 60 * 1000;
const TR_CACHE_KEY = 'vkgym_tr_cache';
const TR_CACHE_TTL = 6 * 60 * 60 * 1000;

const MODES = [
  { key: 'tweet',   label: 'Tek Tweet' },
  { key: 'thread',  label: 'Thread' },
  { key: 'youtube', label: 'YouTube' },
];

// ─── Gemini ──────────────────────────────────────────────────────
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

async function callGemini(apiKey, userPrompt, systemPrompt) {
  let lastError = null;
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
    });
    for (let retry = 0; retry < 2; retry++) {
      if (retry > 0) await new Promise(r => setTimeout(r, 2000));
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (res.ok) {
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
      const errBody = await res.text();
      let detail = '';
      try { detail = JSON.parse(errBody)?.error?.message || errBody; } catch { detail = errBody; }
      lastError = detail;
      if (res.status !== 503 && res.status !== 429) throw new Error(`Gemini hatasi (${res.status}): ${detail}`);
      if (res.status === 429 && retry === 0) continue;
      break;
    }
    if (i < GEMINI_MODELS.length - 1) await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Gemini kota hatası: ${String(lastError).slice(0, 200)}`);
}

// ─── Translation cache (start titles in TR) ───────────────────────
function getTrCache() {
  try {
    const raw = localStorage.getItem(TR_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed._ts || 0) > TR_CACHE_TTL) { localStorage.removeItem(TR_CACHE_KEY); return {}; }
    return parsed;
  } catch { return {}; }
}
function saveTrCache(updates) {
  try {
    const existing = getTrCache();
    localStorage.setItem(TR_CACHE_KEY, JSON.stringify({ ...existing, ...updates, _ts: Date.now() }));
  } catch {}
}
async function translateTitles(items, apiKey) {
  if (!items.length) return items;
  const cache = getTrCache();
  const uncached = items.filter(item => !cache[item.title]);
  if (uncached.length > 0 && apiKey) {
    try {
      const numbered = uncached.map((item, i) => `${i + 1}. ${item.title}`).join('\n');
      const system = 'Kripto ve finans haberi başlıklarını Türkçeye çevir. Sıra numarasını koru, her satıra yalnızca çeviriyi yaz.';
      const result = await callGemini(apiKey, numbered, system);
      const lines = result.split('\n').map(l => l.trim()).filter(Boolean);
      const newEntries = {};
      uncached.forEach((item, i) => {
        const match = lines.find(l => l.match(new RegExp(`^${i + 1}[.)]`)));
        const tr = match ? match.replace(/^\d+[.)]\s*/, '').trim() : null;
        if (tr) newEntries[item.title] = tr;
      });
      saveTrCache(newEntries);
      Object.assign(cache, newEntries);
    } catch {}
  }
  return items.map(item => ({ ...item, ...(cache[item.title] ? { titleTr: cache[item.title] } : {}) }));
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}dk`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}sa`;
  return `${Math.floor(hrs / 24)}g`;
}

// ─── Style Picker (3 stacked options) ─────────────────────────────
function StylePicker({ value, onChange, t }) {
  return (
    <div style={{
      background: t.card, border: t.cardBorder, borderRadius: 18,
      boxShadow: t.cardShadow, padding: 18,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>
        İçerik Stili
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(STYLE_CONFIG).map(([key, cfg]) => {
          const active = value === key;
          return (
            <button key={key} onClick={() => onChange(key)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
              border: active ? 'none' : `1px solid ${t.inputBorder}`,
              background: active ? '#e8e8ec' : t.hover,
              color: active ? '#0a0a0a' : t.text,
              textAlign: 'left', fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{cfg.label}</span>
              <span style={{ fontSize: 12, opacity: active ? 0.65 : 0.6 }}>{cfg.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function ContentPage({ darkMode = true }) {
  const t = mkTheme(darkMode);

  const [cpNews, setCpNews] = useState([]);
  const [cpLoading, setCpLoading] = useState(true);
  const cpCacheRef = useRef({ data: null, timestamp: 0 });

  const [selectedNews, setSelectedNews] = useState(null);
  const [mode, setMode] = useState('tweet');
  const [style, setStyle] = useState('prime');
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [previousContent, setPreviousContent] = useState(null);
  const [lastContext, setLastContext] = useState(null); // VSE meta for save/boost

  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) || '');
  const [ccKey, setCcKey] = useState(() => localStorage.getItem(CC_KEY_STORAGE) || '');

  useEffect(() => {
    const handler = () => {
      setGeminiKey(localStorage.getItem(GEMINI_KEY_STORAGE) || '');
      setCcKey(localStorage.getItem(CC_KEY_STORAGE) || '');
    };
    window.addEventListener('vkgym_key_updated', handler);
    return () => window.removeEventListener('vkgym_key_updated', handler);
  }, []);

  const loadCPNews = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cpCacheRef.current.data && (now - cpCacheRef.current.timestamp < CACHE_TTL)) {
      setCpNews(cpCacheRef.current.data);
      setCpLoading(false);
      return;
    }
    setCpLoading(true);
    const key = localStorage.getItem(CC_KEY_STORAGE) || ccKey;
    const data = await fetchCPNews(key);
    const gemKey = localStorage.getItem(GEMINI_KEY_STORAGE) || '';
    const translated = await translateTitles(data, gemKey);
    cpCacheRef.current = { data: translated, timestamp: Date.now() };
    setCpNews(translated);
    setCpLoading(false);
  }, [ccKey]);

  useEffect(() => { loadCPNews(); }, [loadCPNews]);

  const resolveKey = () => {
    const fresh = localStorage.getItem(GEMINI_KEY_STORAGE) || '';
    if (fresh && fresh !== geminiKey) setGeminiKey(fresh);
    return fresh || geminiKey;
  };

  const cleanScrapedContent = (text) => {
    if (!text) return '';
    return text.replace(/\s{3,}/g, ' ').trim();
  };

  const handleGenerate = async () => {
    if (!selectedNews) { setError('Önce soldan bir haber seç.'); return; }
    const key = resolveKey();
    if (!key) { setError('Gemini API key eksik. Ayarlar sekmesinden ekleyebilirsin.'); return; }
    setError('');
    setGenerating(true);
    setPreviousContent(content || null);

    try {
      // Scrape if not already
      let scraped = selectedNews.scrapedContent;
      if (scraped === undefined && selectedNews.url) {
        const r = await scrapeArticle(selectedNews.url);
        scraped = r.text || '';
      }
      const cleaned = cleanScrapedContent(scraped);
      const newsInput = {
        title: selectedNews.title,
        content: cleaned ? cleaned.slice(0, 1200) : '',
        source: selectedNews.url || selectedNews.sourceName,
      };

      let systemPrompt, userPrompt;
      if (mode === 'youtube') {
        systemPrompt = `Sen @vkorkmaz10 için YouTube içerik üretici asistanısın. Türkçe yaz. Volkan tarzında: direkt, analitik, eğitici, minimal emoji.`;
        userPrompt = `Bu haber hakkında YouTube video script'i hazırla. Başlık (max 60 kar), thumbnail fikri, SEO açıklama ve HOOK/BAĞLAM/ANA İÇERİK/SONUÇ yapısında script:\n\n"${newsInput.title}"\nKaynak: ${selectedNews.sourceName}${cleaned ? `\n\nİçerik (EN):\n${cleaned.slice(0, 800)}` : ''}`;
      } else {
        const built = mode === 'tweet'
          ? buildTweetPrompt(newsInput, style)
          : buildThreadPrompt(newsInput, style);
        systemPrompt = built.systemPrompt;
        userPrompt = built.userPrompt;
      }

      const result = await callGemini(key, userPrompt, systemPrompt);
      if (!result) throw new Error('Boş yanıt geldi.');
      const cleanResult = result.trim().replace(/^["“]|["”]$/g, '');
      setContent(cleanResult);
      setLastContext({
        mode, style,
        newsTitle: newsInput.title,
        newsSource: selectedNews.url || selectedNews.sourceName,
        systemPrompt, // ReachOS boost için aynı persona
        original: cleanResult,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleBoost = async () => {
    if (!content || !lastContext?.systemPrompt) return;
    const key = resolveKey();
    if (!key) { setError('Gemini API key eksik.'); return; }
    const analysis = scoreTweet(content);
    const boostPrompt = buildBoostPrompt(content, analysis);
    setBoosting(true);
    setError('');
    try {
      const result = await callGemini(key, boostPrompt, lastContext.systemPrompt);
      if (!result) throw new Error('Boş yanıt geldi.');
      const cleaned = result.trim().replace(/^["“]|["”]$/g, '');
      setPreviousContent(content);
      setContent(cleaned);
    } catch (e) {
      setError(e.message);
    } finally {
      setBoosting(false);
    }
  };

  const handleRevert = () => {
    if (previousContent === null) return;
    const cur = content;
    setContent(previousContent);
    setPreviousContent(cur);
  };

  const handleClear = () => {
    if (lastContext && content && lastContext.original !== content) {
      // Edit telemetrisi
      const entry = {
        newsTitle: lastContext.newsTitle,
        newsSource: lastContext.newsSource,
        mode: lastContext.mode,
        style: lastContext.style,
        original: lastContext.original,
        edited: content,
      };
      if (lastContext.mode === 'tweet') {
        entry.reachScore = scoreTweet(lastContext.original).reachScore;
        entry.reachScoreFinal = scoreTweet(content).reachScore;
      }
      saveFeedback(entry);
    }
    setContent('');
    setPreviousContent(null);
    setLastContext(null);
    setError('');
  };

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const liveAnalysis = mode === 'tweet' ? scoreTweet(content || '') : null;

  // ── Layout ──────────────────────────────────────────────────────
  const cardBase = {
    background: t.card, border: t.cardBorder, borderRadius: 18,
    boxShadow: t.cardShadow, padding: 18,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header */}
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: t.text, letterSpacing: '-0.5px' }}>İçerik</div>
        <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>Haber akışı &amp; içerik üretimi</div>
      </div>

      {/* Two-column layout */}
      <div className="content-page-grid" style={{
        display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16,
        alignItems: 'flex-start',
      }}>

        {/* ===== LEFT: News Feed ===== */}
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 10, padding: '0 4px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, letterSpacing: '1.5px' }}>
              HABER AKIŞI · {selectedNews ? '1 SEÇİLİ' : '0 SEÇİLİ'}
            </div>
            <button
              onClick={() => loadCPNews(true)}
              disabled={cpLoading}
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'transparent', color: t.muted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Yenile"
            >
              <RefreshCw size={14} className={cpLoading ? 'cal-spin' : ''} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cpLoading ? (
              <div style={{ ...cardBase, textAlign: 'center', padding: 32, color: t.muted }}>
                <Loader size={20} className="cal-spin" />
              </div>
            ) : cpNews.length === 0 ? (
              <div style={{ ...cardBase, textAlign: 'center', padding: 32, color: t.muted, fontSize: 13 }}>
                Haber bulunamadı. CryptoCompare API key'ini Ayarlar'dan kontrol et.
              </div>
            ) : (
              cpNews.map(item => {
                const isSelected = selectedNews?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedNews(item)}
                    style={{
                      ...cardBase,
                      padding: 14, cursor: 'pointer',
                      border: isSelected ? `1px solid ${ACCENT}` : t.cardBorder,
                      boxShadow: isSelected ? `0 0 0 1px ${ACCENT}55, ${t.cardShadow}` : t.cardShadow,
                      transition: 'border 0.15s, box-shadow 0.15s',
                    }}
                  >
                    {/* Top row: source + category + time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>
                        {item.sourceName || 'CryptoCompare'}
                      </span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                        background: item.category === 'ai_tech' ? 'rgba(168,85,247,0.15)' : 'rgba(247,147,26,0.15)',
                        color: item.category === 'ai_tech' ? '#A855F7' : '#F7931A',
                      }}>
                        {item.category === 'ai_tech' ? <Cpu size={10} /> : <Bitcoin size={10} />}
                        {item.category === 'ai_tech' ? 'AI/Tech' : 'Kripto'}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: t.muted }}>
                        {timeAgo(item.publishedAt)} önce
                      </span>
                    </div>

                    {/* Title */}
                    <div style={{
                      fontSize: 15, fontWeight: 700, color: t.text,
                      lineHeight: 1.35, marginBottom: 6,
                    }}>
                      {item.titleTr || item.title}
                    </div>

                    {/* Summary (if available) */}
                    {item.body && (
                      <div style={{
                        fontSize: 12, color: t.muted, lineHeight: 1.5,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {item.body.slice(0, 200)}
                      </div>
                    )}

                    {/* Source link */}
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          marginTop: 8, fontSize: 11, color: t.muted, textDecoration: 'none',
                        }}
                      >
                        Kaynağa git <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ===== RIGHT: Reach + Style + İçerik Alanı ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'tweet' && liveAnalysis ? (
            <ReachScoreBadge
              analysis={liveAnalysis}
              followers={getXFollowers()}
              hasMedia={false}
              onBoost={handleBoost}
              onRevert={previousContent !== null ? handleRevert : undefined}
              boosting={boosting}
            />
          ) : (
            <div style={{
              background: t.card, border: t.cardBorder, borderRadius: 18,
              boxShadow: t.cardShadow, padding: 18,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, letterSpacing: '1.5px', marginBottom: 8 }}>
                REACH SCORE
              </div>
              <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.5 }}>
                {mode === 'tweet'
                  ? 'Tek Tweet seçildiğinde algoritma skoru burada gözükür.'
                  : `${MODES.find(m => m.key === mode)?.label} modunda Reach skoru hesaplanmaz (sadece Tek Tweet için).`}
              </div>
            </div>
          )}
          <StylePicker value={style} onChange={setStyle} t={t} />

          {/* İçerik Alanı */}
          <div style={cardBase}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>İçerik Alanı</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {MODES.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    style={{
                      padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                      border: 'none', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                      background: mode === m.key ? ACCENT : t.hover,
                      color: mode === m.key ? '#0a0a0a' : t.text,
                      transition: 'background 0.15s',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={selectedNews ? 'AI ile üret veya buraya kendi içeriğini yaz...' : 'Önce soldan bir haber seç...'}
              rows={8}
              style={{
                width: '100%', padding: 14, borderRadius: 12,
                background: t.input, border: `1px solid ${t.inputBorder}`,
                color: t.text, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5,
                outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                marginBottom: 12,
              }}
            />

            {error && (
              <div style={{
                padding: '10px 12px', borderRadius: 10, marginBottom: 12,
                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)', fontSize: 12,
              }}>
                {error}
              </div>
            )}

            {/* Action buttons row */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleClear}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 12,
                  background: 'transparent', color: t.text,
                  border: `1px solid ${t.inputBorder}`, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                }}
              >
                Temizle
              </button>
              <button
                onClick={handleGenerate}
                disabled={!selectedNews || generating}
                style={{
                  flex: 2, padding: '12px 16px', borderRadius: 12, border: 'none',
                  background: (!selectedNews || generating) ? t.hover : ACCENT,
                  color: (!selectedNews || generating) ? t.muted : '#0a0a0a',
                  cursor: (!selectedNews || generating) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {generating
                  ? <><Loader size={16} className="cal-spin" /> Üretiliyor...</>
                  : <><Sparkles size={16} /> AI ile Üret</>}
              </button>
            </div>

            {/* Secondary action: kopyala (boost/revert ReachScoreBadge içinde) */}
            {content && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={handleCopy}
                  style={{
                    padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                    background: t.hover, color: t.text,
                    border: `1px solid ${t.inputBorder}`,
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  {copied ? <><Check size={12} /> Kopyalandı</> : <><Copy size={12} /> Kopyala</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
