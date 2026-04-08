import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, TrendingUp, Flame, Copy, Check, Key, Loader, Send, X } from 'lucide-react';
import { fetchAllNews, SOURCES, getCryptoCompareKey, saveCryptoCompareKey } from '../utils/news';

const GEMINI_KEY_STORAGE = 'vkgym_gemini_key';
const CACHE_TTL = 5 * 60 * 1000;

// ======= Volkan's Full System Prompt =======
const SYSTEM_PROMPT = `Sen @vkorkmaz10 için X (Twitter) ve YouTube içerik üretici asistanısın.

VOLKAN KİMDİR:
- 2017'den beri aktif kripto yatırımcısı ve trader
- Altcointurk kurucu ortağı, KriptoCuma organizatörü
- Borsa İstanbul çalışanı, programcı, girişimci
- X hesabı: @vkorkmaz10

Temel ilgi alanları: Bitcoin & kripto paralar (birincil), finans & ekonomi, girişimcilik & iş dünyası, teknoloji & yapay zeka.
Hedef kitle: Kripto/finans dünyasını takip eden, orta-ileri düzey bilgili Türk kullanıcılar.

VOLKAN'IN SESİ:
- Direkt ve özlü — lafı dolandırmaz, gereksiz giriş cümlesi yoktur
- Analitik ama erişilebilir — teknik bilgiyi sade dille aktarır
- Güven veren — yıllık piyasa deneyiminden gelen özgüven, asla kibirli değil
- Meraklı & okuyucu — görüşleri kitaplar, tarihsel analoji ve verilerle desteklenir
- Topluluk odaklı — "biz", "birlikte", "hep birlikte göreceğiz" gibi ifadeler doğal
- Türkçe ama global bakış — Türkiye bağlamı güçlü, global piyasaları Türk okuyucuya tercüme eder
- Emoji: Minimal, anlamlı (💎🔥📈), spamlanmaz
- Karakteristik: "Nacizane söylüyorum...", "Ben bu piyasada 2017'den beri varım", "Daldan dala atlama"
- Her analizde iki senaryo: olumlu ve olumsuz
- "Panik yapma" çerçevesi, kademeli alım önerisi

KAÇINILACAKLAR:
- Aşırı iyimser/pump tarzı dil ("Bu coin 100x yapar!")
- Clickbait başlıklar, ALL CAPS sensasyonalizm
- Gereksiz uzun girişler
- Finansal tavsiye: "benim görüşüm", "kendi araştırmanı yap" çerçevesini koru
- 280 karakteri aşan tek tweetler

FORMAT KURALLARI:
TEK TWEET: [Güçlü giriş] + [1-2 cümle yorum] + [$BTC ticker]
THREAD: 🧵 hook ile başla, 5-12 tweet, son tweet "Sizce?" ile bitir
YOUTUBE: Başlık (max 60 kar) + Thumbnail fikri + SEO açıklama + Script (HOOK/BAĞLAM/ANA İÇERİK/SONUÇ)

KONUYA GÖRE TON:
- Bitcoin fiyat → Sakin, analitik
- Altcoin → Temkinli, "İnceleyin, araştırın"
- Makro → Eğitici, Türkiye-global köprüsü
- AI/teknoloji → Meraklı, erken adopter
- Regülasyon → Nötr-analizci`;

// ======= Gemini API =======
async function callGemini(apiKey, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    console.error('Gemini API error:', res.status, errBody);
    let detail = '';
    try { detail = JSON.parse(errBody)?.error?.message || errBody; } catch { detail = errBody; }
    throw new Error(`Gemini hatası (${res.status}): ${detail}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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

// ======= Quick Commands =======
const QUICK_COMMANDS = [
  { label: "Bugün neler var?", prompt: (news) => `Aşağıdaki güncel haberleri analiz et ve en önemli 3-5 tanesi için Volkan tarzında birer tweet yaz. Sonunda yayın planı tablosu ekle.\n\nHABERLER:\n${news.map((n, i) => `${i + 1}. ${n.title} (${n.sourceName})`).join('\n')}` },
  { label: "BTC thread yaz", prompt: (news) => `Bitcoin'in bugünkü durumu için analitik bir thread yaz. Teknik seviyeler ve iki senaryo içersin. Güncel bağlam:\n${news.slice(0, 3).map(n => `- ${n.title}`).join('\n')}` },
  { label: "AI + kripto postu", prompt: () => "Yapay zeka ve kripto piyasaları kesişiminden ilgi çekici bir tweet yaz. Pivot içerik olsun." },
  { label: "Makro analiz", prompt: (news) => `Global makroekonomik gelişmeleri ve Bitcoin'e etkisini anlatan bir thread hazırla.\nGüncel haberler:\n${news.slice(0, 5).map(n => `- ${n.title}`).join('\n')}` },
];

// ======= Component =======
export default function ContentView() {
  // News
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);
  const [ccKey, setCcKey] = useState(() => getCryptoCompareKey());
  const newsCacheRef = useRef({ data: null, timestamp: 0 });

  // Chat
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  // Keys
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const geminiInputRef = useRef(null);
  const ccInputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Fetch news
  const loadNews = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && newsCacheRef.current.data && (now - newsCacheRef.current.timestamp < CACHE_TTL)) {
      setNews(newsCacheRef.current.data);
      setNewsLoading(false);
      return;
    }
    setNewsLoading(true);
    const data = await fetchAllNews(ccKey);
    newsCacheRef.current = { data, timestamp: Date.now() };
    setNews(data);
    setNewsLoading(false);
  }, [ccKey]);

  useEffect(() => { loadNews(); }, [loadNews]);

  const timeAgo = (ts) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}dk`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}sa`;
    return `${Math.floor(hrs / 24)}g`;
  };

  // Send message
  const send = async (userText) => {
    if (!userText.trim() || loading) return;
    if (!geminiKey) { setShowKeyModal(true); return; }
    setError('');

    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInput('');
    setLoading(true);

    try {
      const result = await callGemini(geminiKey, userText);
      if (!result) throw new Error('Boş yanıt geldi.');
      setMessages(prev => [...prev, { role: 'assistant', content: result }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNewsOverlay = (item) => {
    setSelectedNews(item);
  };

  const handleContentGenerate = (type) => {
    if (!selectedNews) return;
    const { title, sourceName } = selectedNews;
    const prompts = {
      tweet: `Bu haber hakkında Volkan tarzında tek tweet yaz (max 280 karakter):\n\n"${title}"\n\nKaynak: ${sourceName}`,
      thread: `Bu haber hakkında Volkan tarzında 5-12 tweet'lik bir thread yaz. 🧵 hook ile başla, son tweet "Sizce?" ile bitir:\n\n"${title}"\n\nKaynak: ${sourceName}`,
      youtube: `Bu haber hakkında YouTube video script'i hazırla. Başlık (max 60 kar), thumbnail fikri, SEO açıklama ve HOOK/BAĞLAM/ANA İÇERİK/SONUÇ yapısında script:\n\n"${title}"\n\nKaynak: ${sourceName}`,
    };
    setSelectedNews(null);
    send(prompts[type]);
  };

  const handleQuickCommand = (cmd) => {
    const prompt = cmd.prompt(news);
    send(prompt);
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const saveGeminiKeyLocal = (key) => {
    setGeminiKey(key);
    if (key) localStorage.setItem(GEMINI_KEY_STORAGE, key);
    else localStorage.removeItem(GEMINI_KEY_STORAGE);
  };

  const saveCcKeyLocal = (key) => {
    setCcKey(key);
    saveCryptoCompareKey(key);
  };

  return (
    <div className="fade-in content-view">

      {/* ===== News List ===== */}
      <div className="glass-card content-news-strip">
        <div className="content-news-strip-header">
          <div className="content-news-strip-title">
            <span>Gündem</span>
            {!newsLoading && <span className="content-news-count">{news.length}</span>}
          </div>
          <button className="content-icon-btn" onClick={() => loadNews(true)} disabled={newsLoading}>
            <RefreshCw size={14} className={newsLoading ? 'cal-spin' : ''} />
          </button>
        </div>

        <div className="content-news-list">
          {newsLoading ? (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
              <Loader size={18} className="cal-spin" />
            </div>
          ) : news.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '12px' }}>Haber bulunamadı.</p>
          ) : (
            news.map(item => {
              const src = SOURCES[item.source] || SOURCES.other;
              return (
                <div key={item.id} className="content-news-strip-item" onClick={() => handleNewsOverlay(item)}>
                  {item.trend && (
                    <span className={`content-trend ${item.trend}`}>
                      {item.trend === 'fire' ? <Flame size={10} /> : <TrendingUp size={10} />}
                    </span>
                  )}
                  <span className="content-news-strip-text">{item.title}</span>
                  <div className="content-news-strip-meta">
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="content-source-link" style={{ color: src.color }} onClick={e => e.stopPropagation()}>
                      {src.emoji} {item.sourceName} <ExternalLink size={9} />
                    </a>
                    <span className="content-time">{timeAgo(item.publishedAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ===== Chat Area ===== */}
      <div className="content-chat-area">
        {messages.length === 0 && !loading ? (
          <div className="content-empty">
            <p className="content-empty-title">Ne üretelim?</p>
            <p className="content-empty-sub">Hazır komutlardan birini seç, haberlerden birine tıkla ya da kendi isteğini yaz.</p>
            <div className="content-quick-grid">
              {QUICK_COMMANDS.map(cmd => (
                <button key={cmd.label} className="content-quick-btn glass-card" onClick={() => handleQuickCommand(cmd)}>
                  {cmd.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`content-msg ${msg.role}`}>
                {msg.role === 'user' ? (
                  <div className="content-msg-user">{msg.content}</div>
                ) : (
                  <div className="content-msg-assistant glass-card">
                    <div className="content-msg-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    <button className="content-msg-copy" onClick={() => handleCopy(msg.content, i)}>
                      {copied === i ? <><Check size={12} /> Kopyalandı</> : <><Copy size={12} /> Kopyala</>}
                    </button>
                  </div>
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
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ===== Input Area ===== */}
      <div className="content-input-area">
        {messages.length > 0 && (
          <div className="content-quick-row">
            {QUICK_COMMANDS.slice(0, 2).map(cmd => (
              <button key={cmd.label} className="content-quick-sm" onClick={() => handleQuickCommand(cmd)}>
                {cmd.label}
              </button>
            ))}
          </div>
        )}
        <form className="content-form" onSubmit={e => { e.preventDefault(); send(input); }}>
          <input
            className="content-text-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ne üretelim? Örn: BTC thread yaz"
            disabled={loading}
          />
          <button type="submit" className="content-send-btn" disabled={loading || !input.trim()}>
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Key FAB */}
      <button className="content-key-fab" onClick={() => setShowKeyModal(true)}
        style={geminiKey ? { borderColor: 'rgba(52,168,83,0.4)' } : {}}>
        <Key size={14} style={geminiKey ? { color: '#34A853' } : {}} />
      </button>

      {/* ===== Content Type Overlay ===== */}
      {selectedNews && (
        <div className="modal-overlay" onClick={() => setSelectedNews(null)}>
          <div className="modal-content glass-card content-type-modal" onClick={e => e.stopPropagation()}>
            <button className="content-type-close" onClick={() => setSelectedNews(null)}>
              <X size={16} />
            </button>
            <p className="content-type-title">"{selectedNews.title}"</p>
            <p className="content-type-source">
              {(SOURCES[selectedNews.source] || SOURCES.other).emoji} {selectedNews.sourceName}
            </p>

            <div className="content-type-group">
              <div className="content-type-group-label">𝕏 Twitter</div>
              <div className="content-type-group-btns">
                <button className="content-type-btn" onClick={() => handleContentGenerate('tweet')}>Tek Tweet</button>
                <button className="content-type-btn" onClick={() => handleContentGenerate('thread')}>Thread</button>
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

      {/* ===== API Keys Modal ===== */}
      {showKeyModal && (
        <div className="modal-overlay" onClick={() => setShowKeyModal(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <h3 style={{ color: '#00d4ff', marginBottom: '16px', fontSize: '1rem' }}>
              <Key size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
              API Keys
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                Gemini API Key
                {geminiKey && <span style={{ color: '#34A853', fontSize: '0.7rem' }}>aktif</span>}
              </label>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '8px', lineHeight: 1.4 }}>
                İçerik üretimi için gerekli.
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff', marginLeft: '4px' }}>Buradan al →</a>
              </p>
              <input ref={geminiInputRef} type="password" defaultValue={geminiKey} placeholder="AIza..." className="todo-input" />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                CryptoCompare Key
                {ccKey && <span style={{ color: '#34A853', fontSize: '0.7rem' }}>aktif</span>}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 400 }}>(opsiyonel)</span>
              </label>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '8px', lineHeight: 1.4 }}>
                CoinDesk, Decrypt haberleri için.
                <a href="https://min-api.cryptocompare.com" target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff', marginLeft: '4px' }}>Buradan al →</a>
              </p>
              <input ref={ccInputRef} type="password" defaultValue={ccKey} placeholder="Key..." className="todo-input" />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-cancel" onClick={() => setShowKeyModal(false)}>İptal</button>
              <button className="btn-save" style={{ background: '#00d4ff' }} onClick={() => {
                saveGeminiKeyLocal(geminiInputRef.current?.value?.trim() || '');
                saveCcKeyLocal(ccInputRef.current?.value?.trim() || '');
                setShowKeyModal(false);
              }}>Kaydet</button>
            </div>

            {(geminiKey || ccKey) && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
                {geminiKey && (
                  <button style={{ background: 'none', border: 'none', color: 'var(--error-color)', fontSize: '0.72rem', cursor: 'pointer' }}
                    onClick={() => { saveGeminiKeyLocal(''); if (geminiInputRef.current) geminiInputRef.current.value = ''; }}>
                    Gemini key sil
                  </button>
                )}
                {ccKey && (
                  <button style={{ background: 'none', border: 'none', color: 'var(--error-color)', fontSize: '0.72rem', cursor: 'pointer' }}
                    onClick={() => { saveCcKeyLocal(''); if (ccInputRef.current) ccInputRef.current.value = ''; }}>
                    CC key sil
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
