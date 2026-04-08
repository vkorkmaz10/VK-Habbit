import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, TrendingUp, Flame, X, Copy, Check, Key, Loader, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchAllNews, SOURCES, getCryptoCompareKey, saveCryptoCompareKey } from '../utils/news';

const CLAUDE_KEY_STORAGE = 'vkgym_claude_key';
const CACHE_TTL = 5 * 60 * 1000;

// ======= Volkan's System Prompt (from .skill) =======
const SYSTEM_PROMPT = `Sen @vkorkmaz10 için X (Twitter) içerik üretici asistanısın.

VOLKAN KİMDİR:
- 2017'den beri aktif kripto yatırımcısı ve trader
- Altcointurk kurucu ortağı, KriptoCuma organizatörü
- Borsa İstanbul çalışanı, programcı, girişimci
- X hesabı: @vkorkmaz10

GÖREV:
Kullanıcı içerik üretmek istediğinde veya "Bugün neler var?" dediğinde:
1. web_search aracıyla güncel haberleri tara (Bitcoin, kripto, makro, AI)
2. En ilgi çekici 3-5 haberi seç — gerçekten önemli olanları, boş haberleri değil
3. Volkan'ın sesiyle Türkçe X postları yaz
4. Sonunda sadece Volkan'ın göreceği bir "Yayın Planı" tablosu ekle (Saat | Post | Kaynak)

VOLKAN'IN SESİ VE TARZI:
- Karakteristik ifadeler: "Nacizane söylüyorum...", "Ben bu piyasada 2017'den beri varım", "Daldan dala atlama"
- Her analizde mutlaka iki senaryo: olumlu ve olumsuz, kritik seviyelerle
- "Panik yapma" çerçevesi: düzeltmeleri fırsat olarak sun, kademeli alım öner
- Teknik terimler Türkçe/İngilizce karma: momentum, correction, SR flip, Fibonacci
- "Arkadaşlar" hitabı, samimi ve sohbet eder gibi ton
- Finansal tavsiye değil: "benim görüşüm", "kendi araştırmanı yap" çerçevesi koru

FORMAT KURALLARI:
TEK TWEET (hızlı insight için):
[Tek cümle güçlü giriş]
[1-2 cümle yorum — "bu şu anlama geliyor" çerçevesi]
[$BTC gibi ticker]
---
THREAD (derinlemesine analiz için):
🧵 [İddialı hook - soru veya keskin gözlem]
[2-6 devam tweeti, her biri bağımsız okunabilir]
[Son tweet: "Sizce?" sorusu ile biter]
---
YAYIM PLANI (sadece Volkan için, her batch sonunda):
| Saat | Post | Kaynak |
|------|------|--------|
| 09:00 | [konu] | [URL] |

KONU AĞIRLIKLARI:
- Bitcoin/kripto piyasaları: ana gündem (%60)
- Global makro (Fed, tarife, jeopolitik): ikincil (%25)
- AI/teknoloji ürünleri: pivot içerik, kripto bağlantısıyla (%15)

KAÇINILACAKLAR:
- "Kesinlikle", "garantiyle" — her zaman olasılık dili
- Tek senaryo analizi — mutlaka iki taraf
- Clickbait veya sensasyonalizm
- 280 karakteri aşan tek tweetler`;

// ======= Quick Commands =======
const QUICK_COMMANDS = [
  { label: "Bugün neler var?", value: "Bugün neler var? Reddit ve güncel haberlerden beslenerek en ilgi çekici 5 post hazırla. Yayın planını da ekle." },
  { label: "BTC thread yaz", value: "Bitcoin'in bugünkü durumu için analitik bir thread yaz. Teknik seviyeler ve iki senaryo içersin." },
  { label: "AI + kripto postu", value: "Yapay zeka ve kripto piyasaları kesişiminden ilgi çekici bir post yaz. Pivot içerik." },
  { label: "Makro analiz", value: "Global makroekonomik gelişmeleri ve Bitcoin'e etkisini anlatan bir thread hazırla." },
];

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

// ======= Claude API Call =======
async function callClaude(apiKey, messages) {
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isDev ? '/api/anthropic/v1/messages' : 'https://api.anthropic.com/v1/messages';
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 429) throw new Error('Rate limit — 1-2 dk bekle.');
    if (res.status === 401) throw new Error('API key geçersiz.');
    throw new Error(err.error?.message || `API hatası: ${res.status}`);
  }
  return await res.json();
}

// ======= Component =======
export default function ContentView() {
  // News state
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [ccKey, setCcKey] = useState(() => getCryptoCompareKey());
  const newsCacheRef = useRef({ data: null, timestamp: 0 });

  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchInfo, setSearchInfo] = useState('');
  const [copied, setCopied] = useState(null);

  // API key state
  const [claudeKey, setClaudeKey] = useState(() => localStorage.getItem(CLAUDE_KEY_STORAGE) || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const claudeInputRef = useRef(null);
  const ccInputRef = useRef(null);
  const bottomRef = useRef(null);

  // Auto-scroll
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

  // Time ago
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
    if (!claudeKey) { setShowKeyModal(true); return; }
    setError('');
    setSearchInfo('');

    const userMsg = { role: 'user', content: userText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const data = await callClaude(claudeKey, updatedMessages);

      const searchBlocks = data.content?.filter(b => b.type === 'tool_use' && b.name === 'web_search');
      if (searchBlocks?.length > 0) {
        setSearchInfo(`${searchBlocks.length} web araması yapıldı`);
      }

      const assistantText = data.content
        ?.filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n') || '';

      if (!assistantText) throw new Error('Boş yanıt geldi.');

      setMessages(prev => [...prev, { role: 'assistant', content: assistantText }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // News click → send to chat
  const handleNewsToChat = (item) => {
    const prompt = `Bu haber hakkında Volkan tarzında bir tweet yaz:\n\n"${item.title}"\n\nKaynak: ${item.sourceName}`;
    setInput(prompt);
    setNewsExpanded(false);
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const saveClaudeKey = (key) => {
    setClaudeKey(key);
    if (key) localStorage.setItem(CLAUDE_KEY_STORAGE, key);
    else localStorage.removeItem(CLAUDE_KEY_STORAGE);
  };

  const saveCcKeyLocal = (key) => {
    setCcKey(key);
    saveCryptoCompareKey(key);
  };

  return (
    <div className="fade-in content-view">

      {/* ===== News Strip ===== */}
      <div className="glass-card content-news-strip">
        <div className="content-news-strip-header" onClick={() => setNewsExpanded(!newsExpanded)}>
          <div className="content-news-strip-title">
            <span>Gündem</span>
            {!newsLoading && <span className="content-news-count">{news.length}</span>}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button className="content-icon-btn" onClick={(e) => { e.stopPropagation(); loadNews(true); }} disabled={newsLoading}>
              <RefreshCw size={14} className={newsLoading ? 'cal-spin' : ''} />
            </button>
            {newsExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>

        {newsExpanded && (
          <div className="content-news-expanded">
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
                  <div key={item.id} className="content-news-strip-item" onClick={() => handleNewsToChat(item)}>
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
        )}

        {/* Horizontal scroll when collapsed */}
        {!newsExpanded && !newsLoading && news.length > 0 && (
          <div className="content-news-scroll">
            {news.slice(0, 5).map(item => (
              <button key={item.id} className="content-news-chip" onClick={() => handleNewsToChat(item)}>
                {item.trend === 'fire' && <Flame size={10} className="content-chip-icon" />}
                {item.trend === 'trending' && <TrendingUp size={10} className="content-chip-icon" />}
                <span>{item.title.length > 45 ? item.title.slice(0, 45) + '...' : item.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ===== Chat Area ===== */}
      <div className="content-chat-area">
        {messages.length === 0 && !loading ? (
          <div className="content-empty">
            <p className="content-empty-title">Ne üretelim?</p>
            <p className="content-empty-sub">Hazır komutlardan birini seç, haberlerden birine tıkla ya da kendi isteğini yaz.</p>
            <div className="content-quick-grid">
              {QUICK_COMMANDS.map(cmd => (
                <button key={cmd.label} className="content-quick-btn glass-card" onClick={() => send(cmd.value)}>
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
                    {searchInfo && i === messages.length - 1 && (
                      <div className="content-search-badge">{searchInfo}</div>
                    )}
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
                  <p className="content-loading-text">Haberler taranıyor, içerik üretiliyor...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="content-error">
                <strong>Hata:</strong> {error}
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ===== Input Area ===== */}
      <div className="content-input-area">
        {messages.length > 0 && (
          <div className="content-quick-row">
            {QUICK_COMMANDS.slice(0, 2).map(cmd => (
              <button key={cmd.label} className="content-quick-sm" onClick={() => send(cmd.value)}>
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

      {/* ===== Key Button (floating) ===== */}
      <button
        className="content-key-fab"
        onClick={() => setShowKeyModal(true)}
        style={claudeKey ? { borderColor: 'rgba(52,168,83,0.4)' } : {}}
      >
        <Key size={14} style={claudeKey ? { color: '#34A853' } : {}} />
      </button>

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
                Claude API Key
                {claudeKey && <span style={{ color: '#34A853', fontSize: '0.7rem' }}>aktif</span>}
              </label>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '8px', lineHeight: 1.4 }}>
                İçerik üretimi için gerekli.
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff', marginLeft: '4px' }}>Buradan al →</a>
              </p>
              <input ref={claudeInputRef} type="password" defaultValue={claudeKey} placeholder="sk-ant-..." className="todo-input" />
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
                saveClaudeKey(claudeInputRef.current?.value?.trim() || '');
                saveCcKeyLocal(ccInputRef.current?.value?.trim() || '');
                setShowKeyModal(false);
              }}>Kaydet</button>
            </div>

            {(claudeKey || ccKey) && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
                {claudeKey && (
                  <button style={{ background: 'none', border: 'none', color: 'var(--error-color)', fontSize: '0.72rem', cursor: 'pointer' }}
                    onClick={() => { saveClaudeKey(''); if (claudeInputRef.current) claudeInputRef.current.value = ''; }}>
                    Claude key sil
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
