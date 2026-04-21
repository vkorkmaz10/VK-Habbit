import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, Copy, Check, Loader, Send, X, Cpu, Bitcoin, ChevronDown, ChevronUp, Pencil, Save, Image as ImageIcon } from 'lucide-react';
import { fetchAllNews, fetchCPNews, scrapeArticle } from '../utils/news';
import { saveFeedback } from '../utils/storage';
import { buildTweetPrompt, buildThreadPrompt, STYLE_CONFIG } from '../engine/vse';
import { scoreTweet, buildBoostPrompt } from '../engine/reach';
import { getXFollowers } from '../utils/storage';
import ReachScoreBadge from './ReachScoreBadge';
import goldenExamples from '../config/persona_references.json';

const GEMINI_KEY_STORAGE = 'vkgym_gemini_key';
const CC_KEY_STORAGE = 'vkgym_cc_key';
const CACHE_TTL = 5 * 60 * 1000;
const TR_CACHE_KEY = 'vkgym_tr_cache';
const TR_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 saat
const URL_REGEX = /https?:\/\/[^\s]+/;

// ─── Translation Cache ────────────────────────────────────────────────────────
function getTrCache() {
  try {
    const raw = localStorage.getItem(TR_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed._ts || 0) > TR_CACHE_TTL) {
      localStorage.removeItem(TR_CACHE_KEY);
      return {};
    }
    return parsed;
  } catch { return {}; }
}

function saveTrCache(updates) {
  try {
    const existing = getTrCache();
    localStorage.setItem(TR_CACHE_KEY, JSON.stringify({ ...existing, ...updates, _ts: Date.now() }));
  } catch {}
}

// Başlıkları Türkçeye çevirir. Cache-first: sadece cache'te olmayanlar API'ye gider.
async function translateTitles(items, apiKey) {
  if (!items.length) return items;
  const cache = getTrCache();
  const uncached = items.filter(item => !cache[item.title]);

  if (uncached.length > 0 && apiKey) {
    try {
      const numbered = uncached.map((item, i) => `${i + 1}. ${item.title}`).join('\n');
      const system = 'Kripto ve finans haberi başlıklarını Türkçeye çevir. Sıra numarasını koru, her satıra yalnızca çeviriyi yaz. Açıklama, yorum veya ek kelime ekleme.';
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
    } catch {} // hata → orijinal başlık kalır
  }

  return items.map(item => ({
    ...item,
    ...(cache[item.title] ? { titleTr: cache[item.title] } : {}),
  }));
}

// ======= Golden Examples (for YouTube / Quick Commands only) =======
function getGoldenExamplesBlock(type) {
  const refs = goldenExamples;
  const isPlaceholder = (s) => !s || s.includes('BURAYA') || s.includes('YAPIŞTIRIN');
  if (type === 'youtube' && refs.youtube_scripts?.length) {
    const valid = refs.youtube_scripts.filter(t => !isPlaceholder(t.intro));
    if (valid.length) return `\n\nALTIN ÖRNEKLER (giriş ve yapıyı taklit et):\n${valid.map(t => `Giriş: "${t.intro}"\nYapı: "${t.structure}"`).join('\n---\n')}`;
  }
  if (type === 'tweet' && refs.x_single_tweets?.length) {
    const valid = refs.x_single_tweets.filter(t => !isPlaceholder(t.content));
    if (valid.length) return `\n\nALTIN ÖRNEKLER (bu tonu ve yapıyı taklit et):\n${valid.map(t => `- "${t.content}"`).join('\n')}`;
  }
  if (type === 'thread' && refs.x_threads?.length) {
    const valid = refs.x_threads.filter(t => !isPlaceholder(t.hook));
    if (valid.length) return `\n\nALTIN ÖRNEKLER (hook, geçiş ve kapanış yapısını taklit et):\n${valid.map(t => `Hook: "${t.hook}"\nGövde: "${t.body}"\nKapanış: "${t.closing}"`).join('\n---\n')}`;
  }
  return '';
}

// ======= Gemini API =======
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

      if (res.status !== 503 && res.status !== 429) {
        throw new Error(`Gemini hatasi (${res.status}): ${detail}`);
      }
      if (res.status === 429 && retry === 0) {
        console.warn(`Gemini ${model} rate limited, retrying in 2s...`);
        continue;
      }
      console.warn(`Gemini ${model} failed (${res.status}), trying next model...`);
      break;
    }

    if (i < GEMINI_MODELS.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  // Try to detect daily vs per-minute quota from lastError
  const errStr = String(lastError || '').toLowerCase();
  const isPerMin = errStr.includes('per minute') || errStr.includes('per_minute') || errStr.includes('rpm');
  const isDaily = errStr.includes('per day') || errStr.includes('generaterequestsperdaypermodel');
  const isBilling = errStr.includes('exceeded your current quota') || errStr.includes('plan and billing');
  let hint;
  if (isPerMin) hint = 'Dakikalık kota doldu. 60 sn bekle ve tekrar dene.';
  else if (isDaily) hint = 'GÜNLÜK RPD doldu. 24 saat reset bekle veya yeni key oluştur.';
  else if (isBilling) hint = 'Free tier günlük RPD doldu (3 modelin de). Çözüm: (a) 24 saat bekle, (b) https://aistudio.google.com/apikey adresinden YENİ KEY oluştur, (c) Google Cloud Console\'dan billing aktif et → Pay-as-you-go\'ya geç (limit kalkar, çok ucuz).';
  else hint = 'Detay: ' + String(lastError).slice(0, 200);
  throw new Error(`Gemini kota: ${hint}`);
}

// ======= Markdown Renderer =======
function renderMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="content-md-code">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener" class="content-md-link">$1</a>')
    .replace(/^(#{1,3})\s+(.+)$/gm, (_, h, t) => {
      const cls = h.length === 1 ? 'content-md-h1' : h.length === 2 ? 'content-md-h2' : 'content-md-h3';
      return `<div class="${cls}">${t}</div>`;
    })
    .replace(/^\|(.+)\|$/gm, (line) => {
      if (/^[\|\s\-:]+$/.test(line)) return "";
      const cells = line.split("|").filter((_, i, a) => i > 0 && i < a.length - 1);
      return `<tr>${cells.map(c => `<td class="content-md-td">${c.trim()}</td>`).join("")}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>\n?)+/gs, (rows) => `<table class="content-md-table">${rows}</table>`)
    .replace(/^---+$/gm, '<hr class="content-md-hr">')
    .replace(/\n\n/g, '<div style="height:0.6em"></div>')
    .replace(/\n/g, "<br>");
}

// ======= Thread Block Splitter =======
// Splits numbered thread tweets into individual blocks.
// Handles Gemini output variants:
//   "1/9", "(1/9)", "**1/9**", "🧵 1/9", "1/9:", "1.", "(1)" etc.
function splitThreadBlocks(text) {
  // Normalize: strip bold/italic markdown, parentheses around numbering
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/^\*{1,2}\((\d+\/\d*)\)\*{1,2}/gm, '$1')  // **(1/9)**
    .replace(/^\*{1,2}(\d+\/\d*)\*{1,2}/gm, '$1')       // **1/9**
    .replace(/^_{1,2}(\d+\/\d*)_{1,2}/gm, '$1')          // __1/9__
    .replace(/^\((\d+\/\d*)\)/gm, '$1');                  // (1/9) → 1/9

  const lines = normalized.split('\n');
  const blocks = [];
  let current = [];

  for (const line of lines) {
    const t = line.trim();
    const isNewBlock =
      /^(?:🧵\s+)?\d+\/\d*[\s:—–\-]/.test(t) ||  // "1/9 text", "1/ :", "🧵 1/9 ..."
      /^(?:🧵\s+)?\d+\/\d*$/.test(t) ||            // "1/9" alone on a line
      /^(?:🧵\s+)?[1-9]\d*\.\s/.test(t) ||         // "1. text"
      /^🧵$/.test(t);                               // 🧵 alone as opener

    if (isNewBlock && current.length > 0) {
      const block = current.join('\n').trim();
      if (block) blocks.push(block);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    const block = current.join('\n').trim();
    if (block) blocks.push(block);
  }

  return blocks.length >= 3 ? blocks : null;
}

// ======= Quick Commands =======
const QUICK_COMMANDS = [
  { label: "Bugün neler var?", prompt: (news) => `Aşağıdaki güncel haberleri analiz et ve en önemli 3-5 tanesi için Volkan tarzında birer tweet yaz. Sonunda yayın planı tablosu ekle.${getGoldenExamplesBlock('tweet')}\n\nHABERLER:\n${news.map((n, i) => `${i + 1}. ${n.title} (${n.sourceName}) [${n.category === 'ai_tech' ? 'AI/Tech' : 'Kripto'}]`).join('\n')}` },
  { label: "Makro analiz", prompt: (news) => `Global makroekonomik gelişmeleri ve Bitcoin'e etkisini anlatan bir thread hazırla.${getGoldenExamplesBlock('thread')}\nGüncel haberler:\n${news.slice(0, 5).map(n => `- ${n.title} [${n.category === 'ai_tech' ? 'AI/Tech' : 'Kripto'}]`).join('\n')}` },
];

// ======= Thread Block (per-block edit/save/copy) =======
function ThreadBlock({ block, blockId, onCopy, copied, onBlockSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(block);
  const [displayContent, setDisplayContent] = useState(block);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editContent.trim();
    if (trimmed && trimmed !== displayContent) {
      onBlockSave(displayContent, trimmed);
      setDisplayContent(trimmed);
    }
    setIsEditing(false);
  };

  return (
    <div className="content-thread-block">
      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="content-edit-textarea"
          value={editContent}
          onChange={e => {
            setEditContent(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
        />
      ) : (
        <div className="content-msg-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(displayContent) }} />
      )}
      <div className="content-block-actions">
        <button
          className="content-block-copy"
          onClick={() => onCopy(displayContent, blockId)}
          title="Bu bölümü kopyala"
        >
          {copied === blockId ? <Check size={11} /> : <Copy size={11} />}
        </button>
        {isEditing ? (
          <button className="content-block-edit content-block-save" onClick={handleSave}>
            <Save size={11} /> Kaydet
          </button>
        ) : (
          <button className="content-block-edit" onClick={() => { setEditContent(displayContent); setIsEditing(true); }}>
            <Pencil size={11} /> Düzenle
          </button>
        )}
      </div>
    </div>
  );
}

// ======= Editable Message Component =======
function EditableMessage({ msg, msgIndex, onCopy, copied, onSaveFeedback, onBoost, onRevert, boosting }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(msg.content);
  const [displayContent, setDisplayContent] = useState(msg.content);
  const textareaRef = useRef(null);

  // Image attachments — session-only, max 4 (X limit)
  const [images, setImages] = useState([]); // [{ id, url(blob), name }]
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    const remaining = 4 - images.length;
    const toAdd = files.slice(0, remaining).map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: URL.createObjectURL(f),
      name: f.name,
    }));
    setImages(prev => [...prev, ...toAdd]);
    e.target.value = '';
  };

  const removeImage = (id) => {
    setImages(prev => {
      const found = prev.find(im => im.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter(im => im.id !== id);
    });
  };

  // Cleanup blob URLs on unmount
  useEffect(() => () => images.forEach(im => URL.revokeObjectURL(im.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  // msg.content değişirse (boost veya revert sonrası) display'i senkronize et
  useEffect(() => {
    setDisplayContent(msg.content);
    setEditContent(msg.content);
  }, [msg.content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleEdit = () => {
    setEditContent(displayContent);
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmed = editContent.trim();
    if (trimmed && trimmed !== displayContent.trim()) {
      onSaveFeedback(msg.content, trimmed);
      setDisplayContent(trimmed);
    }
    setIsEditing(false);
  };

  // Thread rendering with per-block edit/copy
  const isThread = msg.vse?.mode === 'thread';
  const isTweet = msg.vse?.mode === 'tweet';
  const threadBlocks = isThread ? splitThreadBlocks(displayContent) : null;

  // Tweet için canlı skorlama: edit modundayken textarea içeriği, değilse displayContent
  const liveText = isTweet ? (isEditing ? editContent : displayContent) : null;
  const hasMedia = images.length > 0;
  const liveScore = isTweet ? scoreTweet(liveText || '', { hasMedia }) : null;
  const hasPreviousVersions = isTweet && Array.isArray(msg.reachVersions) && msg.reachVersions.length > 0;

  return (
    <div className="content-msg-assistant glass-card">
      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="content-edit-textarea"
          value={editContent}
          onChange={e => {
            setEditContent(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
        />
      ) : isThread && threadBlocks ? (
        <div className="content-thread-blocks">
          {threadBlocks.map((block, bi) => (
            <ThreadBlock
              key={bi}
              block={block}
              blockId={`${msgIndex}-${bi}`}
              onCopy={onCopy}
              copied={copied}
              onBlockSave={(original, edited) => onSaveFeedback(original, edited)}
            />
          ))}
        </div>
      ) : (
        <div className="content-msg-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(displayContent) }} />
      )}

      {isTweet && liveScore && (
        <ReachScoreBadge
          analysis={liveScore}
          followers={getXFollowers()}
          hasMedia={hasMedia}
          onBoost={() => onBoost(msgIndex, isEditing ? editContent : displayContent)}
          onRevert={hasPreviousVersions ? () => onRevert(msgIndex) : undefined}
          boosting={boosting === msgIndex}
        />
      )}

      {isTweet && images.length > 0 && (
        <div className="content-image-thumbs">
          {images.map(im => (
            <div key={im.id} className="content-image-thumb">
              <img src={im.url} alt={im.name} />
              <button
                type="button"
                className="content-image-remove"
                onClick={() => removeImage(im.id)}
                title="Görseli kaldır"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="content-msg-actions">
        {isTweet && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />
            <button
              type="button"
              className="content-msg-image-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 4}
              title={images.length >= 4 ? 'Max 4 görsel' : 'Görsel ekle (max 4)'}
            >
              <ImageIcon size={12} /> {images.length > 0 ? `Görsel (${images.length}/4)` : 'Görsel'}
            </button>
          </>
        )}
        <button className="content-msg-copy" onClick={() => onCopy(displayContent, msgIndex)}>
          {copied === msgIndex ? <><Check size={12} /> Kopyalandı</> : <><Copy size={12} /> Kopyala</>}
        </button>
        {isEditing ? (
          <button className="content-msg-edit content-msg-save" onClick={handleSave}>
            <Save size={12} /> Kaydet
          </button>
        ) : (
          <button className="content-msg-edit" onClick={handleEdit}>
            <Pencil size={12} /> Düzenle
          </button>
        )}
      </div>
    </div>
  );
}

// ======= Component =======
export default function ContentView() {
  // News
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);
  const [newsExpanded, setNewsExpanded] = useState(false);
  const newsCacheRef = useRef({ data: null, timestamp: 0 });

  // CryptoCompare
  const [cpNews, setCpNews] = useState([]);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpExpanded, setCpExpanded] = useState(false);
  const cpCacheRef = useRef({ data: null, timestamp: 0 });

  // Chat — sessionStorage ile korunur (tab/sayfa yenilemede kalır, tarayıcı kapanınca gider)
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('vkgym_content_messages');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);
  const [boostingIdx, setBoostingIdx] = useState(null);  // ReachOS boost in-flight için

  // Style Picker
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);      // 'tweet' | 'thread'
  const [pendingNews, setPendingNews] = useState(null);      // { title, content, source, blocked }
  const [manualContent, setManualContent] = useState('');    // user-pasted content when blocked

  // Keys — read from localStorage; refreshed when SettingsView saves/deletes
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) || '');
  const [ccKey, setCcKey] = useState(() => localStorage.getItem(CC_KEY_STORAGE) || '');
  const bottomRef = useRef(null);

  // Mesajları sessionStorage'a kaydet (tab/sayfa yenilemede korunur)
  useEffect(() => {
    try { sessionStorage.setItem('vkgym_content_messages', JSON.stringify(messages)); } catch {}
  }, [messages]);

  // SettingsView API key değiştiğinde yenile
  useEffect(() => {
    const handler = () => {
      setGeminiKey(localStorage.getItem(GEMINI_KEY_STORAGE) || '');
      setCcKey(localStorage.getItem(CC_KEY_STORAGE) || '');
    };
    window.addEventListener('vkgym_key_updated', handler);
    return () => window.removeEventListener('vkgym_key_updated', handler);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const loadNews = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && newsCacheRef.current.data && (now - newsCacheRef.current.timestamp < CACHE_TTL)) {
      setNews(newsCacheRef.current.data);
      setNewsLoading(false);
      return;
    }
    setNewsLoading(true);
    const data = await fetchAllNews();
    const gemKey = localStorage.getItem(GEMINI_KEY_STORAGE) || '';
    const translated = await translateTitles(data, gemKey);
    newsCacheRef.current = { data: translated, timestamp: Date.now() };
    setNews(translated);
    setNewsLoading(false);
  }, []);

  useEffect(() => { loadNews(); }, [loadNews]);

  const loadCPNews = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cpCacheRef.current.data && (now - cpCacheRef.current.timestamp < CACHE_TTL)) {
      setCpNews(cpCacheRef.current.data);
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

  // Load CP news when section is first expanded
  useEffect(() => {
    if (cpExpanded && cpNews.length === 0 && !cpLoading) loadCPNews();
  }, [cpExpanded]);

  const timeAgo = (ts) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}dk`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}sa`;
    return `${Math.floor(hrs / 24)}g`;
  };

  // Her çağrıda localStorage'dan taze key oku (stale state sorununu önler)
  const resolveKey = () => {
    const fresh = localStorage.getItem(GEMINI_KEY_STORAGE) || '';
    if (fresh && fresh !== geminiKey) setGeminiKey(fresh);
    return fresh || geminiKey;
  };

  // Send with explicit systemPrompt (for VSE) or fallback to free-text
  const send = async (userText, systemPrompt = null) => {
    if (!userText.trim() || loading) return;
    const key = resolveKey();
    if (!key) { setError('Gemini API key eksik. Ayarlar sekmesinden ekleyebilirsin.'); return; }
    setError('');

    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInput('');
    setLoading(true);
    setNewsExpanded(false);

    let finalPrompt = userText;
    let finalSystem = systemPrompt;

    // URL detection (free-text mode only)
    if (!systemPrompt) {
      const urlMatch = userText.match(URL_REGEX);
      if (urlMatch) {
        const { text: urlContent } = await scrapeArticle(urlMatch[0]);
        if (urlContent) {
          finalPrompt = `Aşağıdaki URL'den çekilen içerik hakkında Volkan tarzında analiz ve yorum yaz:\n\nURL: ${urlMatch[0]}\n\nİçerik:\n${urlContent}`;
        }
      }
      // Default system for free-text: use the old SYSTEM_PROMPT content inline
      finalSystem = `Sen @vkorkmaz10 için X ve YouTube içerik üretici asistanısın. Türkçe yaz. Volkan tarzında: direkt, analitik, minimal emoji, finansal tavsiye vermez ama senaryo sunar.`;
    }

    try {
      const result = await callGemini(key, finalPrompt, finalSystem);
      if (!result) throw new Error('Boş yanıt geldi.');
      setMessages(prev => [...prev, { role: 'assistant', content: result }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // VSE-powered generation with mode metadata
  const generateVSE = async (newsInput, mode, style) => {
    const key = resolveKey();
    if (!key) { setError('Gemini API key eksik. Ayarlar sekmesinden ekleyebilirsin.'); return; }
    setError('');

    const label = mode === 'tweet' ? 'Tweet' : 'Thread';
    const styleLabel = STYLE_CONFIG[style]?.label || style;
    setMessages(prev => [...prev, { role: 'user', content: `${label} (${styleLabel}): "${newsInput.title}"` }]);
    setLoading(true);
    setNewsExpanded(false);

    try {
      const { systemPrompt, userPrompt } = mode === 'tweet'
        ? buildTweetPrompt(newsInput, style)
        : buildThreadPrompt(newsInput, style);

      const result = await callGemini(key, userPrompt, systemPrompt);
      if (!result) throw new Error('Boş yanıt geldi.');

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result,
        vse: { mode, style, newsTitle: newsInput.title, newsSource: newsInput.source },
        // Tweet için boost çağrısında aynı persona prompt'unu kullanmak için sakla
        ...(mode === 'tweet' ? { reachSystemPrompt: systemPrompt, reachVersions: [] } : {}),
      }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNewsOverlay = (item) => {
    setSelectedNews({ ...item, scraping: false });
  };

  useEffect(() => {
    if (!selectedNews || selectedNews.scrapedContent !== undefined || selectedNews.scraping) return;
    setSelectedNews(prev => prev ? { ...prev, scraping: true } : null);
    scrapeArticle(selectedNews.url).then(({ text, blocked }) => {
      setSelectedNews(prev => prev ? {
        ...prev,
        scrapedContent: text || '',
        scrapedBlocked: blocked,
        scraping: false,
      } : null);
    });
  }, [selectedNews?.id]);

  const cleanScrapedContent = (text) => {
    if (!text) return '';
    const trailing = [
      /Coin Prices[\s\S]*/i, /Trending (?:Coins|Tokens|News|Stories)[\s\S]*/i,
      /Market (?:Data|Cap|Overview)[\s\S]*/i, /Top (?:Coins|Cryptocurrencies|Assets|Stories)[\s\S]*/i,
      /Related (?:Articles|Stories|News|Posts)[\s\S]*/i, /Recommended (?:Articles|Stories|For You)[\s\S]*/i,
      /Popular (?:Stories|Articles)[\s\S]*/i, /More (?:Stories|Articles|From)[\s\S]*/i,
      /Newsletter[\s\S]*/i, /Subscribe[\s\S]*/i, /Sign up (?:for|to)[\s\S]*/i,
      /Don't Miss[\s\S]*/i, /About (?:the )?Author[\s\S]*/i, /Disclaimer[\s\S]*/i, /©\s*\d{4}[\s\S]*/i,
    ];
    const inline = [
      /\b(?:BTC|ETH|XRP|BNB|SOL|DOGE|ADA|AVAX|SHIB|LINK|DOT|MATIC|UNI|ATOM|USDT|USDC|BUSD|DAI|WBT|HYPE|LEO|BCH|XMR|ZEC|LTC|TRX|HBAR|SUI|TAO)\s*\$[\d,.]+\s*-?[\d.]+%/g,
      /\$[\d,]+\.[\d]+\s+[+-]?[\d.]+%\s*/g,
    ];
    let clean = text;
    for (const p of trailing) clean = clean.replace(p, '');
    for (const p of inline) clean = clean.replace(p, '');
    return clean.replace(/\s{3,}/g, ' ').trim();
  };

  // Called when user picks a content type (tweet/thread) from first modal
  const handleContentGenerate = (type) => {
    if (!selectedNews) return;
    const { title, sourceName, scrapedContent, url } = selectedNews;

    if (type === 'youtube') {
      // YouTube: keep old flow
      const cleaned = cleanScrapedContent(scrapedContent);
      const context = cleaned ? `\n\nHaber içeriği (EN):\n${cleaned.slice(0, 800)}` : '';
      const golden = getGoldenExamplesBlock('youtube');
      const prompt = `Bu haber hakkında YouTube video script'i hazırla. Başlık (max 60 kar), thumbnail fikri, SEO açıklama ve HOOK/BAĞLAM/ANA İÇERİK/SONUÇ yapısında script:\n\n"${title}"\nKaynak: ${sourceName}${context}${golden}`;
      setSelectedNews(null);
      const youtubeSystem = `Sen @vkorkmaz10 için YouTube içerik üretici asistanısın. Türkçe yaz. Volkan tarzında: direkt, analitik, eğitici, minimal emoji.`;
      send(prompt, youtubeSystem);
      return;
    }

    // Tweet / Thread → show style picker
    const cleaned = cleanScrapedContent(scrapedContent);
    // Blocked if: explicitly flagged, OR scraping finished but content is empty/too short
    const scrapingDone = scrapedContent !== undefined;
    const isBlocked = scrapingDone && (selectedNews.scrapedBlocked || !cleaned || cleaned.length < 80);
    setPendingMode(type);
    setPendingNews({
      title,
      content: cleaned ? cleaned.slice(0, 1200) : '',
      source: url || sourceName,
      blocked: isBlocked,
      articleUrl: url,
    });
    setManualContent('');
    setSelectedNews(null);
    setShowStylePicker(true);
  };

  // Called when user picks a style from the style picker
  const handleStyleSelected = (style) => {
    setShowStylePicker(false);
    if (!pendingNews || !pendingMode) return;
    // Merge manual content if user pasted something
    const finalNews = manualContent.trim()
      ? { ...pendingNews, content: manualContent.trim() }
      : pendingNews;
    generateVSE(finalNews, pendingMode, style);
    setPendingMode(null);
    setPendingNews(null);
    setManualContent('');
  };

  const handleQuickCommand = (cmd) => {
    const prompt = cmd.prompt(news);
    const sys = `Sen @vkorkmaz10 için X içerik üretici asistanısın. Türkçe yaz. Volkan tarzı: direkt, analitik, minimal emoji, iki senaryo sun.`;
    send(prompt, sys);
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveFeedback = (msg, msgIdx, original, edited) => {
    if (!msg.vse) return;
    const entry = {
      newsTitle: msg.vse.newsTitle,
      newsSource: msg.vse.newsSource,
      mode: msg.vse.mode,
      style: msg.vse.style,
      original,
      edited,
    };
    // Tweet için reach skoru telemetrisi
    if (msg.vse.mode === 'tweet') {
      entry.reachScore = scoreTweet(original).reachScore;
      entry.reachScoreFinal = scoreTweet(edited).reachScore;
      entry.boostUsed = Array.isArray(msg.reachVersions) && msg.reachVersions.length > 0;
    }
    saveFeedback(entry);

    // KRİTİK: messages array'i de güncelle — yoksa sayfa yenilemede eski içerik geri gelir
    // ve sonraki düzenlemelerde "original" hep ilk versiyon olur (golden examples loop kırılır).
    // Tweet için: original === full content → tam değişim
    // Thread için: original === sadece bir blok → o bloğu değiştir
    setMessages(prev => prev.map((m, i) => {
      if (i !== msgIdx) return m;
      if (m.content === original) return { ...m, content: edited };       // tweet
      if (m.content.includes(original)) return { ...m, content: m.content.replace(original, edited) }; // thread block
      return m;
    }));
  };

  // ReachOS: Düşük skorlu tweet'i ikinci Gemini çağrısıyla iyileştir
  const handleBoost = async (msgIdx, currentText) => {
    const key = resolveKey();
    if (!key) { setError('Gemini API key eksik. Ayarlar sekmesinden ekleyebilirsin.'); return; }
    const msg = messages[msgIdx];
    if (!msg || !msg.reachSystemPrompt) return;

    const analysis = scoreTweet(currentText);
    const boostPrompt = buildBoostPrompt(currentText, analysis);

    setBoostingIdx(msgIdx);
    setError('');
    try {
      const result = await callGemini(key, boostPrompt, msg.reachSystemPrompt);
      if (!result) throw new Error('Boş yanıt geldi.');
      const cleaned = result.trim().replace(/^["“]|["”]$/g, '');
      setMessages(prev => prev.map((m, i) => i === msgIdx
        ? { ...m, content: cleaned, reachVersions: [...(m.reachVersions || []), currentText] }
        : m));
    } catch (e) {
      setError(e.message);
    } finally {
      setBoostingIdx(null);
    }
  };

  const handleRevert = (msgIdx) => {
    setMessages(prev => prev.map((m, i) => {
      if (i !== msgIdx) return m;
      const versions = m.reachVersions || [];
      if (versions.length === 0) return m;
      const previous = versions[versions.length - 1];
      return { ...m, content: previous, reachVersions: versions.slice(0, -1) };
    }));
  };

  return (
    <div className="fade-in content-view">

      {/* ===== News List ===== */}
      <div className="glass-card content-news-strip">
        <div className="content-news-strip-header" onClick={() => setNewsExpanded(e => !e)} style={{ cursor: 'pointer' }}>
          <div className="content-news-strip-title">
            <span>Gündem</span>
            {!newsLoading && <span className="content-news-count">{news.length}</span>}
            {newsExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <button className="content-icon-btn" onClick={() => loadNews(true)} disabled={newsLoading}>
              <RefreshCw size={14} className={newsLoading ? 'cal-spin' : ''} />
            </button>
          </div>
        </div>

        <div className={`content-news-list${newsExpanded ? ' expanded' : ''}`}>
          {newsLoading ? (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
              <Loader size={18} className="cal-spin" />
            </div>
          ) : news.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '12px' }}>
              Haber bulunamadı.
            </p>
          ) : (
            news.map(item => (
              <div key={item.id} className="content-news-strip-item" onClick={() => handleNewsOverlay(item)}>
                <div className="content-news-row">
                  <span className={`content-cat-badge ${item.category}`}>
                    {item.category === 'ai_tech' ? <Cpu size={10} /> : <Bitcoin size={10} />}
                  </span>
                  <span className="content-news-strip-text">{item.titleTr || item.title}</span>
                </div>
                <div className="content-news-strip-meta">
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="content-source-link" onClick={e => e.stopPropagation()}>
                    {item.sourceName} <ExternalLink size={9} />
                  </a>
                  <span className="content-time">{timeAgo(item.publishedAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ===== CryptoCompare ===== */}
      <div className="glass-card content-news-strip">
        <div className="content-news-strip-header" onClick={() => setCpExpanded(e => !e)} style={{ cursor: 'pointer' }}>
          <div className="content-news-strip-title">
            <span>CryptoCompare</span>
            {!cpLoading && cpNews.length > 0 && <span className="content-news-count">{cpNews.length}</span>}
            {cpExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <button className="content-icon-btn" onClick={() => loadCPNews(true)} disabled={cpLoading}>
              <RefreshCw size={14} className={cpLoading ? 'cal-spin' : ''} />
            </button>
          </div>
        </div>

        <div className={`content-news-list${cpExpanded ? ' expanded' : ''}`}>
          {cpLoading ? (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
              <Loader size={18} className="cal-spin" />
            </div>
          ) : cpNews.length === 0 && cpExpanded ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '12px' }}>
              Haber bulunamadı.
            </p>
          ) : (
            cpNews.map(item => (
              <div
                key={item.id}
                className="content-news-strip-item"
                onClick={() => handleNewsOverlay(item)}
              >
                <div className="content-news-row">
                  <span className={`content-cat-badge ${item.category}`}>
                    {item.category === 'ai_tech' ? <Cpu size={10} /> : <Bitcoin size={10} />}
                  </span>
                  <span className="content-news-strip-text">{item.titleTr || item.title}</span>
                </div>
                <div className="content-news-strip-meta">
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="content-source-link" onClick={e => e.stopPropagation()}>
                    {item.sourceName || 'CryptoCompare'} <ExternalLink size={9} />
                  </a>
                  <span className="content-time">{timeAgo(item.publishedAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ===== Chat Area ===== */}
      <div className="content-chat-area">
        {messages.map((msg, i) => (
          <div key={i} className={`content-msg ${msg.role}`}>
            {msg.role === 'user' ? (
              <div className="content-msg-user">{msg.content}</div>
            ) : (
              <EditableMessage
                msg={msg}
                msgIndex={i}
                onCopy={handleCopy}
                copied={copied}
                onSaveFeedback={(original, edited) => handleSaveFeedback(msg, i, original, edited)}
                onBoost={handleBoost}
                onRevert={handleRevert}
                boosting={boostingIdx}
              />
            )}
          </div>
        ))}

        {loading && (
          <div className="content-msg assistant">
            <div className="content-msg-assistant glass-card">
              <div className="content-loading-dots">
                <span className="content-dot" style={{ animationDelay: '0ms' }} />
                <span className="content-dot" style={{ animationDelay: '160ms' }} />
                <span className="content-dot" style={{ animationDelay: '320ms' }} />
              </div>
              <p className="content-loading-text">İçerik üretiliyor...</p>
            </div>
          </div>
        )}

        {error && <div className="content-error"><strong>Hata:</strong> {error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* ===== Input Area ===== */}
      <div className="content-input-area">
        <div className="content-quick-row">
          {QUICK_COMMANDS.map(cmd => (
            <button key={cmd.label} className="content-quick-sm" onClick={() => handleQuickCommand(cmd)}>
              {cmd.label}
            </button>
          ))}
        </div>
        <form className="content-form" onSubmit={e => {
          e.preventDefault();
          const text = input.trim();
          if (!text || loading) return;
          const key = resolveKey();
          if (!key) { setError('Gemini API key eksik. Ayarlar sekmesinden ekleyebilirsin.'); return; }
          // URL → direct send (scraping handled inside send())
          if (URL_REGEX.test(text)) { send(text); return; }
          // Free text → content type picker (same flow as news items)
          setSelectedNews({
            id: `freetext_${Date.now()}`,
            title: text.length > 120 ? text.slice(0, 117) + '…' : text,
            scrapedContent: text,
            scrapedBlocked: false,
            scraping: false,
            url: null,
            sourceName: 'Manuel Giriş',
            category: 'crypto',
            isFreeText: true,
          });
          setInput('');
        }}>
          <input
            className="content-text-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ne üretelim? Link yapıştır veya yaz..."
            disabled={loading}
          />
          <button type="submit" className="content-send-btn" disabled={loading || !input.trim()}>
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* ===== Content Type Overlay ===== */}
      {selectedNews && (
        <div className="modal-overlay" onClick={() => setSelectedNews(null)}>
          <div className="modal-content glass-card content-type-modal" onClick={e => e.stopPropagation()}>
            <button className="content-type-close" onClick={() => setSelectedNews(null)}>
              <X size={16} />
            </button>
            <p className="content-type-title">{selectedNews.titleTr || selectedNews.title}</p>
            <div className="content-type-meta">
              <span>{selectedNews.sourceName}</span>
              {!selectedNews.isFreeText && (
                <span className={`content-cat-pill ${selectedNews.category}`}>
                  {selectedNews.category === 'ai_tech' ? 'AI/Tech' : 'Kripto'}
                </span>
              )}
              {selectedNews.scraping && (
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                  <Loader size={10} className="cal-spin" style={{ marginRight: 3 }} />İçerik çekiliyor...
                </span>
              )}
            </div>

            <div className="content-type-group">
              <div className="content-type-group-label">𝕏 Twitter</div>
              <div className="content-type-group-btns">
                <button className="content-type-btn" disabled={selectedNews.scraping} onClick={() => handleContentGenerate('tweet')}>Tek Tweet</button>
                <button className="content-type-btn" disabled={selectedNews.scraping} onClick={() => handleContentGenerate('thread')}>Thread</button>
              </div>
            </div>

            <div className="content-type-group">
              <div className="content-type-group-label">YouTube</div>
              <div className="content-type-group-btns">
                <button className="content-type-btn" onClick={() => handleContentGenerate('youtube')}>Script / Outline</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Style Picker Overlay ===== */}
      {showStylePicker && (
        <div className="modal-overlay" onClick={() => { setShowStylePicker(false); setManualContent(''); }}>
          <div className="modal-content glass-card content-style-modal" onClick={e => e.stopPropagation()}>
            <button className="content-type-close" onClick={() => { setShowStylePicker(false); setManualContent(''); }}>
              <X size={16} />
            </button>
            <p className="content-style-modal-title">
              {pendingMode === 'tweet' ? 'Tweet' : 'Thread'} tarzı seç
            </p>
            <p className="content-style-modal-sub">
              {pendingNews?.title && `"${pendingNews.title.slice(0, 60)}${pendingNews.title.length > 60 ? '…' : ''}"`}
            </p>

            {/* Manual paste — shown when article is blocked AND mode is thread */}
            {pendingMode === 'thread' && pendingNews?.blocked && (
              <div className="content-manual-paste-block">
                <div className="content-manual-paste-header">
                  <span className="content-manual-paste-warn">⚠ İçeriğe erişilemedi</span>
                  {pendingNews.articleUrl && (
                    <button
                      className="content-manual-url-copy"
                      onClick={() => {
                        navigator.clipboard.writeText(pendingNews.articleUrl);
                      }}
                      title="Haber URL'sini kopyala"
                    >
                      <Copy size={11} /> URL kopyala
                    </button>
                  )}
                </div>
                <p className="content-manual-paste-label">
                  Haber içeriğini tarayıcıdan kopyalayıp buraya yapıştır — thread kalitesini artırır (opsiyonel):
                </p>
                <textarea
                  className="content-manual-paste-area"
                  placeholder="Haber içeriğini buraya yapıştır..."
                  value={manualContent}
                  onChange={e => setManualContent(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            <div className="content-style-options">
              {Object.entries(STYLE_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  className="content-style-option"
                  onClick={() => handleStyleSelected(key)}
                >
                  <span className="content-style-label">{cfg.label}</span>
                  <span className="content-style-desc">{cfg.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
