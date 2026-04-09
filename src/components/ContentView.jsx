import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, Copy, Check, Key, Loader, Send, X, Cpu, Bitcoin, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchAllNews, scrapeArticle } from '../utils/news';
import goldenExamples from '../config/persona_references.json';

const GEMINI_KEY_STORAGE = 'vkgym_gemini_key';
const CACHE_TTL = 5 * 60 * 1000;
const URL_REGEX = /https?:\/\/[^\s]+/;

// ======= Golden Examples Injection =======
function getGoldenExamplesBlock(type) {
  const refs = goldenExamples;
  const isPlaceholder = (s) => !s || s.includes('BURAYA') || s.includes('YAPIŞTIRIN');
  if (type === 'tweet' && refs.x_single_tweets?.length) {
    const valid = refs.x_single_tweets.filter(t => !isPlaceholder(t.content));
    if (valid.length) return `\n\nALTIN ÖRNEKLER (bu tonu ve yapıyı taklit et):\n${valid.map(t => `- "${t.content}"`).join('\n')}`;
  }
  if (type === 'thread' && refs.x_threads?.length) {
    const valid = refs.x_threads.filter(t => !isPlaceholder(t.hook));
    if (valid.length) return `\n\nALTIN ÖRNEKLER (hook, geçiş ve kapanış yapısını taklit et):\n${valid.map(t => `Hook: "${t.hook}"\nGövde: "${t.body}"\nKapanış: "${t.closing}"`).join('\n---\n')}`;
  }
  if (type === 'youtube' && refs.youtube_scripts?.length) {
    const valid = refs.youtube_scripts.filter(t => !isPlaceholder(t.intro));
    if (valid.length) return `\n\nALTIN ÖRNEKLER (giriş ve yapıyı taklit et):\n${valid.map(t => `Giriş: "${t.intro}"\nYapı: "${t.structure}"`).join('\n---\n')}`;
  }
  return '';
}

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
- Coin fiyatları listeleme, fiyat tabloları veya "Coin Prices" bölümü ekleme — sadece verilen habere odaklan

FORMAT KURALLARI:
TEK TWEET: [Güçlü giriş] + [1-2 cümle yorum] + [$BTC ticker]
THREAD: 🧵 hook ile başla, 5-12 tweet, her tweet'i (1/n) formatında numarala, her tweet max 280 karakter, mantıksal kırılma noktalarında böl, son tweet "Sizce?" ile bitir
YOUTUBE: Başlık (max 60 kar) + Thumbnail fikri + SEO açıklama + Script (HOOK/BAĞLAM/ANA İÇERİK/SONUÇ)

KALİTE KONTROLÜ:
Yeni içerik üretmeden önce aşağıda verilen 'Altın Örnekler'i incele. Bu örneklerdeki cümle uzunluğunu, teknik terim kullanım sıklığını ve toplulukla kurulan bağı (biz dili) birebir modelle. Ürettiğin metin referanslara sadık olmalı — lafı dolandırma, çok fazla emoji kullanma.

KONUYA GÖRE TON:
- Bitcoin fiyat → Sakin, analitik
- Altcoin → Temkinli, "İnceleyin, araştırın"
- Makro → Eğitici, Türkiye-global köprüsü
- AI/teknoloji → Meraklı, erken adopter
- Regülasyon → Nötr-analizci`;

// ======= Gemini API =======
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

async function callGemini(apiKey, userPrompt, systemPrompt = SYSTEM_PROMPT) {
  let lastError = null;
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
    });

    // Try each model up to 2 times (retry once on 429)
    for (let retry = 0; retry < 2; retry++) {
      if (retry > 0) await new Promise(r => setTimeout(r, 2000)); // 2s wait before retry

      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (res.ok) {
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      const errBody = await res.text();
      let detail = '';
      try { detail = JSON.parse(errBody)?.error?.message || errBody; } catch { detail = errBody; }
      lastError = detail;

      // Auth errors (401/403) — stop immediately
      if (res.status !== 503 && res.status !== 429) {
        throw new Error(`Gemini hatasi (${res.status}): ${detail}`);
      }

      // 429 on first try — retry same model after delay
      if (res.status === 429 && retry === 0) {
        console.warn(`Gemini ${model} rate limited, retrying in 2s...`);
        continue;
      }

      // Move to next model
      console.warn(`Gemini ${model} failed (${res.status}), trying next model...`);
      break;
    }

    // Wait 1s between different models
    if (i < GEMINI_MODELS.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  // All models failed — friendly Turkish message for 429
  throw new Error('Gemini API kotasi doldu. Lutfen birkac dakika bekleyip tekrar deneyin.');
}

// Headline translation removed — Gemini free tier quota is too limited.
// All quota reserved for content generation.

// URL content fetching uses scrapeArticle from news.js

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

// ======= Quick Commands (FAB only) =======
const QUICK_COMMANDS = [
  { label: "Bugün neler var?", prompt: (news) => `Aşağıdaki güncel haberleri analiz et ve en önemli 3-5 tanesi için Volkan tarzında birer tweet yaz. Sonunda yayın planı tablosu ekle.${getGoldenExamplesBlock('tweet')}\n\nHABERLER:\n${news.map((n, i) => `${i + 1}. ${n.title} (${n.sourceName}) [${n.category === 'ai_tech' ? 'AI/Tech' : 'Kripto'}]`).join('\n')}` },
  { label: "Makro analiz", prompt: (news) => `Global makroekonomik gelişmeleri ve Bitcoin'e etkisini anlatan bir thread hazırla.${getGoldenExamplesBlock('thread')}\nGüncel haberler:\n${news.slice(0, 5).map(n => `- ${n.title} [${n.category === 'ai_tech' ? 'AI/Tech' : 'Kripto'}]`).join('\n')}` },
];

// ======= Component =======
export default function ContentView() {
  // News
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);
  const [newsExpanded, setNewsExpanded] = useState(true);
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
  const bottomRef = useRef(null);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Fetch news + translate
  const loadNews = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && newsCacheRef.current.data && (now - newsCacheRef.current.timestamp < CACHE_TTL)) {
      setNews(newsCacheRef.current.data);
      setNewsLoading(false);
      return;
    }
    setNewsLoading(true);
    const data = await fetchAllNews();
    newsCacheRef.current = { data, timestamp: Date.now() };
    setNews(data);
    setNewsLoading(false);
  }, []);

  useEffect(() => { loadNews(); }, [loadNews]);

  const timeAgo = (ts) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}dk`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}sa`;
    return `${Math.floor(hrs / 24)}g`;
  };

  // Send message (with URL detection)
  const send = async (userText) => {
    if (!userText.trim() || loading) return;
    if (!geminiKey) { setShowKeyModal(true); return; }
    setError('');

    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInput('');
    setLoading(true);
    setNewsExpanded(false); // Collapse news when generating content

    let finalPrompt = userText;

    // URL detection
    const urlMatch = userText.match(URL_REGEX);
    if (urlMatch) {
      const urlContent = await scrapeArticle(urlMatch[0]);
      if (urlContent) {
        finalPrompt = `Aşağıdaki URL'den çekilen içerik hakkında Volkan tarzında analiz ve yorum yaz:\n\nURL: ${urlMatch[0]}\n\nİçerik:\n${urlContent}`;
      }
    }

    try {
      const result = await callGemini(geminiKey, finalPrompt);
      if (!result) throw new Error('Boş yanıt geldi.');
      setMessages(prev => [...prev, { role: 'assistant', content: result }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNewsOverlay = (item) => {
    setSelectedNews({ ...item, scrapedContent: null, scraping: false });
  };

  // Scrape article content when overlay opens
  useEffect(() => {
    if (!selectedNews || selectedNews.scrapedContent || selectedNews.scraping) return;
    setSelectedNews(prev => prev ? { ...prev, scraping: true } : null);
    scrapeArticle(selectedNews.url).then(text => {
      setSelectedNews(prev => prev ? { ...prev, scrapedContent: text || '', scraping: false } : null);
    });
  }, [selectedNews?.id]);

  const handleContentGenerate = (type) => {
    if (!selectedNews) return;
    const { title, sourceName, scrapedContent } = selectedNews;
    const context = scrapedContent ? `\n\nHaber içeriği (EN):\n${scrapedContent.slice(0, 800)}` : '';
    const golden = getGoldenExamplesBlock(type);
    const prompts = {
      tweet: `Bu haber hakkında Volkan tarzında tek tweet yaz (max 280 karakter):\n\n"${title}"\nKaynak: ${sourceName}${context}${golden}`,
      thread: `Bu haber hakkında Volkan tarzında 5-12 tweet'lik bir thread yaz. 🧵 hook ile başla, her tweet'i (1/n) formatında numarala, her tweet max 280 karakter, mantıksal kırılma noktalarında böl, son tweet "Sizce?" ile bitir:\n\n"${title}"\nKaynak: ${sourceName}${context}${golden}`,
      youtube: `Bu haber hakkında YouTube video script'i hazırla. Başlık (max 60 kar), thumbnail fikri, SEO açıklama ve HOOK/BAĞLAM/ANA İÇERİK/SONUÇ yapısında script:\n\n"${title}"\nKaynak: ${sourceName}${context}${golden}`,
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
            <button className="content-icon-btn" onClick={() => setShowKeyModal(true)} title="API Keys">
              <Key size={14} style={geminiKey ? { color: '#34A853' } : {}} />
            </button>
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
                    <span className="content-news-strip-text">{item.title}</span>
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

      {/* ===== Chat Area ===== */}
      <div className="content-chat-area">
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
        <form className="content-form" onSubmit={e => { e.preventDefault(); send(input); }}>
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
            <p className="content-type-title">{selectedNews.title}</p>
            <div className="content-type-meta">
              <span>{selectedNews.sourceName}</span>
              <span className={`content-cat-pill ${selectedNews.category}`}>
                {selectedNews.category === 'ai_tech' ? 'AI/Tech' : 'Kripto'}
              </span>
              {selectedNews.scraping && (
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                  <Loader size={10} className="cal-spin" style={{ marginRight: 3 }} />İçerik çekiliyor...
                </span>
              )}
            </div>

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
                İçerik üretimi ve çeviri için gerekli.
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff', marginLeft: '4px' }}>Buradan al</a>
              </p>
              <input ref={geminiInputRef} type="password" defaultValue={geminiKey} placeholder="AIza..." className="todo-input" />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-cancel" onClick={() => setShowKeyModal(false)}>İptal</button>
              <button className="btn-save" style={{ background: '#00d4ff' }} onClick={() => {
                saveGeminiKeyLocal(geminiInputRef.current?.value?.trim() || '');
                setShowKeyModal(false);
                // Force re-translate with new key (cache'i temizle ki yeni key ile çeviri yapılsın)
                newsCacheRef.current = { data: null, timestamp: 0 };
              }}>Kaydet</button>
            </div>

            {geminiKey && (
              <div style={{ marginTop: '12px' }}>
                <button style={{ background: 'none', border: 'none', color: 'var(--error-color)', fontSize: '0.72rem', cursor: 'pointer' }}
                  onClick={() => { saveGeminiKeyLocal(''); if (geminiInputRef.current) geminiInputRef.current.value = ''; }}>
                  Gemini key sil
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
