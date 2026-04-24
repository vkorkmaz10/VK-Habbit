// ContentPage — PersonaVK içerik üretici.
// Sol: Adaptif kaynak paneli (RSS / URL / 𝕏 / Manuel). Sağ: Reach Score + Stil + İçerik Alanı.
// Mobilde: tab bar ile iki panel arası geçiş.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, Loader, Sparkles, Cpu, Bitcoin, Copy, Check, Link, PenLine, ImagePlus, X as XIcon } from 'lucide-react';
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

const SOURCE_TYPES = [
  { key: 'rss',    label: '📰 Haber',    hint: 'CryptoCompare & RSS akışı' },
  { key: 'url',    label: '🔗 URL',      hint: 'Herhangi bir web sayfası' },
  { key: 'x_link', label: '𝕏 Tweet',    hint: 'x.com tweet linki' },
  { key: 'manual', label: '✏️ Elle Yaz', hint: 'Metin yapıştır veya yaz' },
];

// ─── Gemini ──────────────────────────────────────────────────────
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

async function callGemini(apiKey, userPrompt, systemPrompt, imageParts = []) {
  let lastError = null;
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const contentParts = [{ text: userPrompt }, ...imageParts];
    const body = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: contentParts }],
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
      if (res.status !== 503 && res.status !== 429) throw new Error(`Gemini hatası (${res.status}): ${detail}`);
      if (res.status === 429 && retry === 0) continue;
      break;
    }
    if (i < GEMINI_MODELS.length - 1) await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Gemini kota hatası: ${String(lastError).slice(0, 200)}`);
}

// ─── Translation cache ────────────────────────────────────────────
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

// ─── Style Picker (minimal horizontal pills) ──────────────────────
function StylePicker({ value, onChange, t }) {
  return (
    <div style={{
      background: t.card, border: t.cardBorder, borderRadius: 14,
      boxShadow: t.cardShadow, padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: t.muted, letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>
        STİL
      </span>
      <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
        {Object.entries(STYLE_CONFIG).map(([key, cfg]) => {
          const active = value === key;
          return (
            <button key={key} onClick={() => onChange(key)} style={{
              padding: '5px 14px', borderRadius: 999, cursor: 'pointer',
              border: active ? 'none' : `1px solid ${t.inputBorder}`,
              background: active ? ACCENT : t.hover,
              color: active ? '#0a0a0a' : t.text,
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              transition: 'background 0.15s, color 0.15s',
            }}>
              {cfg.label}
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

  // ── News feed state ────────────────────────────────────────────
  const [cpNews, setCpNews] = useState([]);
  const [cpLoading, setCpLoading] = useState(true);
  const cpCacheRef = useRef({ data: null, timestamp: 0 });

  // ── Source state ───────────────────────────────────────────────
  const [sourceType, setSourceType] = useState('rss');          // 'rss'|'url'|'x_link'|'manual'
  const [selectedNews, setSelectedNews] = useState(null);       // RSS
  const [customUrl, setCustomUrl] = useState('');               // URL / 𝕏
  const [customSource, setCustomSource] = useState(null);       // { title, content, source }
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [manualText, setManualText] = useState('');             // Elle giriş

  // ── Image upload (max 4) ───────────────────────────────────────
  const [images, setImages] = useState([]);                     // [{ base64, mimeType, name }]
  const imageInputRef = useRef(null);

  // ── Generation state ───────────────────────────────────────────
  const [mode, setMode] = useState('tweet');
  const [style, setStyle] = useState('prime');
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [previousContent, setPreviousContent] = useState(null);
  const [lastContext, setLastContext] = useState(null);

  // ── Mobile tab ─────────────────────────────────────────────────
  const [mobileTab, setMobileTab] = useState('source');         // 'source' | 'generate'

  // ── API keys ───────────────────────────────────────────────────
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

  // ── News load ──────────────────────────────────────────────────
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

  // ── Source type switch → clear derived state ───────────────────
  const handleSourceTypeChange = (type) => {
    setSourceType(type);
    setError('');
    setCustomSource(null);
    setCustomUrl('');
  };

  // ── 𝕏 oEmbed tweet reader ─────────────────────────────────────
  const fetchXTweet = async (url) => {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
    const r = await fetch(oembedUrl);
    if (!r.ok) throw new Error(`Tweet okunamadı (${r.status}). Linkin genel/herkese açık olduğunu kontrol et.`);
    const data = await r.json();
    // Parse HTML → extract tweet text from <p> inside <blockquote>
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.html, 'text/html');
    const p = doc.querySelector('blockquote p');
    // Remove trailing link text (last <a> in <p> is the permalink)
    if (p) p.querySelectorAll('a').forEach(a => { if (a.href?.includes('twitter.com') || a.href?.includes('x.com')) a.remove(); });
    const tweetText = p ? p.textContent.trim() : '';
    if (!tweetText) throw new Error('Tweet metni okunamadı — tweet silinmiş ya da gizli olabilir.');
    return {
      title: `@${data.author_name || 'tweet'}`,
      content: tweetText.slice(0, 1200),
      source: url,
    };
  };

  // ── URL / 𝕏 fetch ─────────────────────────────────────────────
  const handleFetchCustomUrl = async () => {
    const url = customUrl.trim();
    if (!url) return;
    setFetchingUrl(true);
    setError('');
    try {
      let source;
      if (sourceType === 'x_link') {
        source = await fetchXTweet(url);
      } else {
        const r = await fetch('/api/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const { text, blocked } = await r.json();
        if (blocked || !text) throw new Error('İçerik çekilemedi. Site erişimi engelliyor olabilir.');
        source = {
          title: url.replace(/^https?:\/\//, '').split('/')[0],
          content: cleanScrapedContent(text).slice(0, 1200),
          source: url,
        };
      }
      setCustomSource(source);
      if (window.innerWidth <= 768) setMobileTab('generate');
    } catch (e) {
      setError(e.message || 'İçerik alınamadı.');
    } finally {
      setFetchingUrl(false);
    }
  };

  // ── Unified newsInput resolver ─────────────────────────────────
  const getActiveNewsInput = async () => {
    if (sourceType === 'rss') {
      if (!selectedNews) { setError('Önce soldan bir haber seç.'); return null; }
      let scraped = selectedNews.scrapedContent;
      if (scraped === undefined && selectedNews.url) {
        const r = await scrapeArticle(selectedNews.url);
        scraped = r.text || '';
      }
      const cleaned = cleanScrapedContent(scraped);
      return {
        title: selectedNews.title,
        content: cleaned ? cleaned.slice(0, 1200) : '',
        source: selectedNews.url || selectedNews.sourceName,
      };
    }
    if (sourceType === 'url' || sourceType === 'x_link') {
      if (!customSource) { setError('Önce URL\'yi çek (İçeriği Getir butonuna bas).'); return null; }
      return customSource;
    }
    if (sourceType === 'manual') {
      if (!manualText.trim()) { setError('İçerik alanına metin gir.'); return null; }
      return {
        title: 'Elle Girilen İçerik',
        content: manualText.trim().slice(0, 1200),
        source: '',
      };
    }
    return null;
  };

  // ── hasActiveSource — controls button enable state ─────────────
  const hasActiveSource = () => {
    if (sourceType === 'rss') return !!selectedNews;
    if (sourceType === 'url' || sourceType === 'x_link') return !!customSource;
    if (sourceType === 'manual') return manualText.trim().length > 0;
    return false;
  };

  // ── Image upload handler (max 4) ──────────────────────────────
  const handleImageFiles = (fileList) => {
    const files = Array.from(fileList).slice(0, 4 - images.length);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImages(prev => prev.length < 4
          ? [...prev, { base64: ev.target.result.split(',')[1], mimeType: file.type, name: file.name }]
          : prev
        );
      };
      reader.readAsDataURL(file);
    });
    if (imageInputRef.current) imageInputRef.current.value = '';
  };
  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  // ── Generate ───────────────────────────────────────────────────
  const handleGenerate = async () => {
    const key = resolveKey();
    if (!key) { setError('Gemini API key eksik. Ayarlar sekmesinden ekleyebilirsin.'); return; }
    setError('');
    setGenerating(true);
    setPreviousContent(content || null);

    try {
      const newsInput = await getActiveNewsInput();
      if (!newsInput) { setGenerating(false); return; }

      const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));

      let systemPrompt, userPrompt;
      if (mode === 'youtube') {
        systemPrompt = `Sen @vkorkmaz10 için YouTube içerik üretici asistanısın. Türkçe yaz. Volkan tarzında: direkt, analitik, eğitici, minimal emoji.`;
        const extra = imageParts.length ? '\n\nEk görsel bağlam da sağlanmıştır — içerikte gerekirse kullan.' : '';
        userPrompt = `Bu içerik hakkında YouTube video script'i hazırla. Başlık (max 60 kar), thumbnail fikri, SEO açıklama ve HOOK/BAĞLAM/ANA İÇERİK/SONUÇ yapısında script:\n\n"${newsInput.title}"${newsInput.source ? `\nKaynak: ${newsInput.source}` : ''}${newsInput.content ? `\n\nİçerik:\n${newsInput.content}` : ''}${extra}`;
      } else {
        const built = mode === 'tweet'
          ? buildTweetPrompt(newsInput, style)
          : buildThreadPrompt(newsInput, style);
        systemPrompt = built.systemPrompt;
        userPrompt = imageParts.length
          ? built.userPrompt + '\n\nEk: Bir görsel de sağlandı, içerikle ilişkiliyse prompt\'a dahil et.'
          : built.userPrompt;
      }

      const result = await callGemini(key, userPrompt, systemPrompt, imageParts);
      if (!result) throw new Error('Boş yanıt geldi.');
      const cleanResult = result.trim().replace(/^[""]|[""]$/g, '');
      setContent(cleanResult);
      setLastContext({
        mode, style,
        newsTitle: newsInput.title,
        newsSource: newsInput.source,
        systemPrompt,
        original: cleanResult,
      });
      // Mobilde içerik üretilince generate sekmesine geç
      if (window.innerWidth <= 768) setMobileTab('generate');
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Boost ──────────────────────────────────────────────────────
  const handleBoost = async () => {
    if (!content || !lastContext?.systemPrompt) return;
    const key = resolveKey();
    if (!key) { setError('Gemini API key eksik.'); return; }
    const analysis = scoreTweet(content, { hasMedia: images.length > 0 });
    const boostPrompt = buildBoostPrompt(content, analysis);
    setBoosting(true);
    setError('');
    try {
      const result = await callGemini(key, boostPrompt, lastContext.systemPrompt);
      if (!result) throw new Error('Boş yanıt geldi.');
      const cleaned = result.trim().replace(/^[""]|[""]$/g, '');
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

  const liveAnalysis = mode === 'tweet' ? scoreTweet(content || '', { hasMedia: images.length > 0 }) : null;

  // ── Style helpers ──────────────────────────────────────────────
  const cardBase = {
    background: t.card, border: t.cardBorder, borderRadius: 18,
    boxShadow: t.cardShadow, padding: 18,
  };
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    background: t.input, border: `1px solid ${t.inputBorder}`,
    color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };
  const sourceActive = (key) => sourceType === key;
  const sourceBtn = (key) => ({
    padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
    border: sourceActive(key) ? `1.5px solid ${ACCENT}` : `1px solid ${t.inputBorder}`,
    background: sourceActive(key) ? `${ACCENT}15` : t.hover,
    color: sourceActive(key) ? ACCENT : t.text,
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  });

  // ── Left panel content per sourceType ─────────────────────────
  const renderLeftPanel = () => {
    if (sourceType === 'rss') {
      return (
        <>
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
                    onClick={() => {
                      setSelectedNews(item);
                      if (window.innerWidth <= 768) setMobileTab('generate');
                    }}
                    style={{
                      background: t.card, borderRadius: 12,
                      padding: '10px 12px', cursor: 'pointer',
                      border: isSelected ? `1px solid ${ACCENT}` : t.cardBorder,
                      boxShadow: isSelected ? `0 0 0 1px ${ACCENT}33` : 'none',
                      transition: 'border 0.15s, box-shadow 0.15s',
                      display: 'flex', flexDirection: 'column', gap: 4,
                    }}
                  >
                    {/* Meta row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: 10, fontWeight: 600,
                        color: item.category === 'ai_tech' ? '#A855F7' : '#F7931A',
                      }}>
                        {item.category === 'ai_tech' ? <Cpu size={9} /> : <Bitcoin size={9} />}
                        {item.sourceName || 'CC'}
                      </span>
                      <span style={{ fontSize: 10, color: t.muted }}>·</span>
                      <span style={{ fontSize: 10, color: t.muted }}>{timeAgo(item.publishedAt)}</span>
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ marginLeft: 'auto', color: t.muted, display: 'flex' }}
                        >
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    {/* Title */}
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.4,
                    }}>
                      {item.titleTr || item.title}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      );
    }

    // URL / 𝕏 linki
    if (sourceType === 'url' || sourceType === 'x_link') {
      const isX = sourceType === 'x_link';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, letterSpacing: '1.5px', padding: '0 4px' }}>
            {isX ? '𝕏 TWEET LİNKİ' : 'WEB SAYFASİ URL\'Sİ'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="url"
              value={customUrl}
              onChange={e => { setCustomUrl(e.target.value); setCustomSource(null); }}
              onKeyDown={e => e.key === 'Enter' && handleFetchCustomUrl()}
              placeholder={isX ? 'https://x.com/username/status/...' : 'https://...'}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={handleFetchCustomUrl}
              disabled={!customUrl.trim() || fetchingUrl}
              style={{
                padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: ACCENT, color: '#0a0a0a', fontWeight: 700, fontFamily: 'inherit', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                opacity: (!customUrl.trim() || fetchingUrl) ? 0.5 : 1,
              }}
            >
              {fetchingUrl ? <Loader size={14} className="cal-spin" /> : <Link size={14} />}
              {fetchingUrl ? 'Çekiyor...' : 'Getir'}
            </button>
          </div>

          {/* Önizleme */}
          {customSource && (
            <div style={{
              ...cardBase, padding: 14,
              border: `1px solid ${ACCENT}`, boxShadow: `0 0 0 1px ${ACCENT}33`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6, letterSpacing: '0.8px' }}>
                ✓ İÇERİK ÇEKİLDİ
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 6, lineHeight: 1.4 }}>
                {customSource.title}
              </div>
              <div style={{
                fontSize: 12, color: t.muted, lineHeight: 1.5,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {customSource.content}
              </div>
            </div>
          )}

          {!customSource && !fetchingUrl && (
            <div style={{ ...cardBase, textAlign: 'center', padding: 40, color: t.muted, fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{isX ? '𝕏' : '🔗'}</div>
              {isX ? 'Tweet linkini yapıştır ve içeriği getir.' : 'Herhangi bir haber veya web sayfası URL\'si gir.'}
            </div>
          )}
        </div>
      );
    }

    // Manuel
    if (sourceType === 'manual') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, letterSpacing: '1.5px', padding: '0 4px' }}>
            ELLE GİRİŞ
          </div>
          <textarea
            value={manualText}
            onChange={e => setManualText(e.target.value)}
            placeholder="İçeriği buraya yaz veya yapıştır. Bu metni kaynak alarak tweet/thread üretilecek."
            rows={12}
            style={{
              ...inputStyle,
              resize: 'vertical', lineHeight: 1.6, fontSize: 13,
            }}
          />
          <div style={{ fontSize: 12, color: t.muted, textAlign: 'right' }}>
            {manualText.length}/1200 karakter
          </div>
          {manualText.trim().length > 0 && (
            <button
              onClick={() => setMobileTab('generate')}
              className="content-mobile-generate-btn"
              style={{
                padding: '11px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: ACCENT, color: '#0a0a0a',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Sparkles size={14} /> İçerik Üret →
            </button>
          )}
        </div>
      );
    }

    return null;
  };

  // ── Active source label for mobile dot ────────────────────────
  const hasSource = sourceType === 'rss' ? !!selectedNews
    : (sourceType === 'manual') ? manualText.trim().length > 0
    : !!customSource;

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header — desktop only */}
      <div className="page-title">
        <div style={{ fontSize: 28, fontWeight: 700, color: t.text, letterSpacing: '-0.5px' }}>İçerik</div>
        <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>Haber akışı &amp; içerik üretimi</div>
      </div>

      {/* ── Mobile tab bar ── */}
      <div className="content-mobile-tabs" style={{ borderBottom: `1px solid ${t.border}` }}>
        <button
          className={`content-tab-btn ${mobileTab === 'source' ? 'active' : ''}`}
          onClick={() => setMobileTab('source')}
          style={{ color: mobileTab === 'source' ? ACCENT : t.muted }}
        >
          {sourceType === 'manual' ? '✏️' : sourceType === 'rss' ? '📰' : '🔗'} Kaynak
          {hasSource && <span className="content-tab-dot" />}
        </button>
        <button
          className={`content-tab-btn ${mobileTab === 'generate' ? 'active' : ''}`}
          onClick={() => setMobileTab('generate')}
          style={{ color: mobileTab === 'generate' ? ACCENT : t.muted }}
        >
          ✍️ İçerik Üret
          {content && <span className="content-tab-dot" />}
        </button>
      </div>

      {/* ── Two-column grid ── */}
      <div
        className="content-page-grid"
        data-mobile-tab={mobileTab}
        style={{
          display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16,
          alignItems: 'flex-start',
        }}
      >

        {/* ===== LEFT: Source Panel ===== */}
        <div className="content-panel-left">
          {/* Source type selector */}
          <div style={{
            display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14,
          }}>
            {SOURCE_TYPES.map(s => (
              <button key={s.key} onClick={() => handleSourceTypeChange(s.key)} style={sourceBtn(s.key)}>
                {s.label}
              </button>
            ))}
          </div>

          {renderLeftPanel()}
        </div>

        {/* ===== RIGHT: Reach + Style + İçerik (sticky on desktop) ===== */}
        <div className="content-panel-right" style={{
          display: 'flex', flexDirection: 'column', gap: 14,
          position: 'sticky', top: 0, alignSelf: 'flex-start',
          maxHeight: '100vh', overflowY: 'auto', paddingBottom: 8,
        }}>

          {/* ReachScore badge */}
          {mode === 'tweet' && liveAnalysis ? (
            <ReachScoreBadge
              analysis={liveAnalysis}
              followers={getXFollowers()}
              hasMedia={images.length > 0}
              onBoost={handleBoost}
              onRevert={previousContent !== null ? handleRevert : undefined}
              boosting={boosting}
            />
          ) : (
            <div style={cardBase}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, letterSpacing: '1.5px', marginBottom: 8 }}>
                REACH SCORE
              </div>
              <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.5 }}>
                {mode === 'tweet'
                  ? 'Tek Tweet seçildiğinde algoritma skoru burada gözükür.'
                  : `${MODES.find(m => m.key === mode)?.label} modunda Reach skoru hesaplanmaz.`}
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
              placeholder={hasActiveSource() ? 'AI ile üret veya buraya kendi içeriğini yaz...' : 'Önce soldan bir kaynak seç...'}
              rows={8}
              style={{
                width: '100%', padding: 14, borderRadius: 12,
                background: t.input, border: `1px solid ${t.inputBorder}`,
                color: t.text, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5,
                outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                marginBottom: 10,
              }}
            />

            {/* Image upload (max 4) */}
            <div style={{ marginBottom: 12 }}>
              {/* Thumbnails */}
              {images.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {images.map((img, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img
                        src={`data:${img.mimeType};base64,${img.base64}`}
                        alt={img.name}
                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                      />
                      <button
                        onClick={() => removeImage(idx)}
                        style={{
                          position: 'absolute', top: -4, right: -4,
                          width: 16, height: 16, borderRadius: '50%', border: 'none',
                          background: '#ef4444', color: '#fff', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, lineHeight: 1,
                        }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              {images.length < 4 && (
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
                  background: t.hover, border: `1px solid ${t.inputBorder}`,
                  color: t.muted, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                }}>
                  <ImagePlus size={13} />
                  Görsel Ekle {images.length > 0 ? `(${images.length}/4)` : ''}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => handleImageFiles(e.target.files)}
                  />
                </label>
              )}
            </div>

            {error && (
              <div style={{
                padding: '10px 12px', borderRadius: 10, marginBottom: 12,
                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)', fontSize: 12,
              }}>
                {error}
              </div>
            )}

            {/* Action buttons */}
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
                disabled={!hasActiveSource() || generating}
                style={{
                  flex: 2, padding: '12px 16px', borderRadius: 12, border: 'none',
                  background: (!hasActiveSource() || generating) ? t.hover : ACCENT,
                  color: (!hasActiveSource() || generating) ? t.muted : '#0a0a0a',
                  cursor: (!hasActiveSource() || generating) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {generating
                  ? <><Loader size={16} className="cal-spin" /> Üretiliyor...</>
                  : <><Sparkles size={16} /> AI ile Üret</>}
              </button>
            </div>

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
