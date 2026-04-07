import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, ExternalLink, TrendingUp, Flame, X, Copy, Check, ChevronRight, Sparkles, Loader, Key } from 'lucide-react';
import { fetchAllNews, SOURCES, getCryptoCompareKey, saveCryptoCompareKey } from '../utils/news';

// Brand icons
const TwitterIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);
const YoutubeIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const GEMINI_KEY_STORAGE = 'vkgym_gemini_key';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ======= Volkan's Full Content Style Prompt (from .skill) =======
const SYSTEM_PROMPT = `Sen Volkan Korkmaz için içerik üretim asistanısın.

Volkan Korkmaz — Eski Borsa İstanbul çalışanı, Altcointurk kurucu ortağı ve CEO'su, KriptoCuma organizatörü, Bitcoin trader, programcı, girişimci.

Temel ilgi alanları: Bitcoin & kripto paralar (birincil), finans & ekonomi, girişimcilik & iş dünyası, teknoloji & yapay zeka.
Hedef kitle: Kripto/finans dünyasını takip eden, orta-ileri düzey bilgili Türk kullanıcılar. Jargon kullanılabilir ama her zaman bağlama oturtulmalı.

SES TONU:
- Direkt ve özlü — lafı dolandırmaz, gereksiz giriş cümlesi yoktur
- Analitik ama erişilebilir — teknik bilgiyi sade dille aktarır
- Güven veren — yıllık piyasa deneyiminden gelen özgüven, asla kibirli değil
- Meraklı & okuyucu — görüşleri kitaplar, tarihsel analoji ve verilerle desteklenir
- Topluluk odaklı — "biz", "birlikte", "hep birlikte göreceğiz" gibi ifadeler doğal gelir
- Türkçe ama global bakış — Türkiye bağlamı güçlü, global piyasaları Türk okuyucuya tercüme eder
- Emoji kullanımı: Minimal, anlamlı yerlerde (💎🔥📈 gibi), spamlanmaz

KAÇINILACAKLAR:
- Aşırı iyimser/pump tarzı dil ("Bu coin 100x yapar!")
- Clickbait başlıklar
- Gereksiz uzun girişler
- Finansal tavsiye niteliğinde kesin yönlendirmeler
- ALL CAPS sensasyonalizm

ÖNEMLİ: Volkan finansal tavsiye vermez. "Benim görüşüm", "kendi araştırmanı yap" çerçevesini koru.
Altcointurk ve KriptoCuma geçmişi markasının parçası — doğal referans yapılabilir.
Türkçe içerik üret; teknik terimler (Bitcoin, blockchain, ETF vb.) İngilizce kalabilir.

KONUYA GÖRE TON:
- Bitcoin fiyat hareketi → Sakin, analitik. Panik yok ama gerçekçi.
- Altcoin/proje → Temkinli, soru işaretleri. "İnceleyin, araştırın" çerçevesi.
- Makroekonomik → Eğitici. Türkiye-global köprüsü kur.
- Girişimcilik → Deneyimden gelen samimi. Altcointurk kuruculuk hikayesi bağlanabilir.
- Yapay zeka/teknoloji → Meraklı, erken adopter.
- Regülasyon haberleri → Nötr-analizci. Kesin yargıdan kaçın.`;

const TWEET_PROMPT = `${SYSTEM_PROMPT}

Aşağıdaki haber için Volkan Korkmaz tarzında 2 farklı tweet versiyonu yaz.

Versiyon 1: Analitik ve derinlikli (280 karakter)
Versiyon 2: Kısa ve punch etkili (280 karakter)

Yapı:
[Güçlü giriş cümlesi — haber/gözlem]
[1-2 cümle yorum/bağlam]
[Varsa: $BTC $ETH gibi ticker veya #hashtag]

Her iki versiyonu da --- ile ayır. Sadece tweet metinlerini yaz, açıklama ekleme.`;

const THREAD_PROMPT = `${SYSTEM_PROMPT}

Aşağıdaki haber için Volkan Korkmaz tarzında bir Twitter thread yaz (5-12 tweet).

Yapı:
- Tweet 1: Hook (okuyucuyu durduran başlangıç — soru veya iddialı önerme)
- Tweet 2-N: Gelişim (her tweet bağımsız okunabilir, ama sıralı)
- Son tweet: Sonuç + CTA (düşünceni sor, kaydet/RT isteği doğal olsun)

Thread Hook Örnekleri (Volkan tarzı):
- "Bitcoin neden düşüyor diye soruyorsunuz. Yanlış soruyu soruyorsunuz."
- "2018'de de aynısını yaşadık. İşte farkı:"
- "Kurumsal yatırımcı ne zaman sattığını anlayabilirsiniz."

Her tweet'i "🧵 1/" formatında numarala. Sadece thread'i yaz.`;

const YOUTUBE_PROMPT = `${SYSTEM_PROMPT}

Aşağıdaki haber için Volkan Korkmaz tarzında 3-8 dakikalık YouTube video outline'ı hazırla.
Kelime sayısı hedefi: 450-1200 kelime script.

Format:
BAŞLIK: (SEO + merak uyandıran, max 60 karakter)
Başlık formülleri:
- "[Konu] Hakkında Kimsenin Söylemediği Şey"
- "Bitcoin [Gelişme] — Ne Anlama Geliyor?"
- "[Yıl]'da [Konu]: Beklentim Bu"
- "[Rakam] Yıldır Bitcoin Takip Ediyorum, İşte Gördüğüm:"
- "[Haber] — Panik mi Yapmalı, Fırsat mı?"

THUMBNAIL FİKRİ: (1 cümle — güçlü görsel, net metin)

AÇIKLAMA:
[Videonun ilk 2 cümlesi — en güçlü kanca, anahtar kelime içermeli]

Bu videoda:
• [Konu 1]
• [Konu 2]
• [Konu 3]

📌 Beni takip et:
Twitter: https://x.com/vkorkmaz10

#Bitcoin #Kripto #[KonuHashtag]

--- SCRIPT ---
[HOOK — 0:00-0:20]
İzleyiciyi ilk 20 saniyede tutacak güçlü başlangıç.
Soru, şok edici veri veya karşı-intuitive önerme.

[BAĞLAM — 0:20-1:00]
Konuyu neden şimdi konuşuyoruz? Güncel tetikleyici.

[ANA İÇERİK — 1:00-6:30]
2-4 ana nokta. Her biri:
- Net başlık
- Açıklama + veri/örnek
- Bağlantı (önceki/sonraki noktayla köprü)

[SONUÇ & CTA — 6:30-8:00]
Volkan'ın görüşü. Yoruma yönlendirme.`;

// ======= Gemini API Call =======
async function callGemini(apiKey, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Rate limit — çok fazla istek. 1-2 dk bekleyip tekrar dene.');
    if (res.status === 403) throw new Error('API key geçersiz veya kısıtlı. Key\'inizi kontrol edin.');
    throw new Error(`Gemini API hatası: ${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ======= Component =======
export default function ContentView() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);
  const [contentType, setContentType] = useState(null);
  const [generatedContent, setGeneratedContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) || '');
  const [ccKey, setCcKey] = useState(() => getCryptoCompareKey());
  const [showKeyModal, setShowKeyModal] = useState(false);
  const geminiInputRef = useRef(null);
  const ccInputRef = useRef(null);
  const newsCacheRef = useRef({ data: null, timestamp: 0 });

  // Fetch news
  const loadNews = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && newsCacheRef.current.data && (now - newsCacheRef.current.timestamp < CACHE_TTL)) {
      setNews(newsCacheRef.current.data);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchAllNews(ccKey);
    newsCacheRef.current = { data, timestamp: Date.now() };
    setNews(data);
    setLoading(false);
  }, [ccKey]);

  useEffect(() => { loadNews(); }, [loadNews]);

  // Content generation
  const handleNewsClick = (newsItem) => {
    setSelectedNews(newsItem);
    setContentType(null);
    setGeneratedContent('');
  };

  const handleGenerate = async (type) => {
    if (!geminiKey) {
      setShowKeyModal(true);
      return;
    }
    setContentType(type);
    setGenerating(true);
    setGeneratedContent('');

    const promptMap = {
      tweet: TWEET_PROMPT,
      thread: THREAD_PROMPT,
      youtube: YOUTUBE_PROMPT,
    };

    const userPrompt = `Haber Başlığı: ${selectedNews.title}\n\nHaber Özeti: ${selectedNews.body}\n\nKaynak: ${selectedNews.sourceName}`;

    try {
      const result = await callGemini(geminiKey, promptMap[type], userPrompt);
      setGeneratedContent(result);
    } catch (e) {
      setGeneratedContent(`Hata: ${e.message}\n\nAPI key'inizi kontrol edin.`);
    }
    setGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveGeminiKey = (key) => {
    setGeminiKey(key);
    if (key) {
      localStorage.setItem(GEMINI_KEY_STORAGE, key);
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
  };

  const saveCcKeyLocal = (key) => {
    setCcKey(key);
    saveCryptoCompareKey(key);
  };

  // Time ago helper
  const timeAgo = (ts) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}dk`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}sa`;
    return `${Math.floor(hrs / 24)}g`;
  };

  return (
    <div className="fade-in" style={{ position: 'relative', minHeight: '60vh' }}>

      {/* Header Bar */}
      <div className="glass-card content-header">
        <div>
          <h2 className="content-title">Content Hub</h2>
          <p className="content-subtitle">Kripto & AI haberleri | İçerik üretimi</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="content-icon-btn"
            onClick={() => setShowKeyModal(true)}
            title="API Keys"
            style={geminiKey ? { borderColor: 'rgba(52,168,83,0.4)' } : {}}
          >
            <Key size={16} style={geminiKey ? { color: '#34A853' } : {}} />
          </button>
          <button className="content-icon-btn" onClick={() => loadNews(true)} disabled={loading} title="Yenile">
            <RefreshCw size={16} className={loading ? 'cal-spin' : ''} />
          </button>
        </div>
      </div>

      {/* News List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Loader size={28} className="cal-spin" style={{ marginBottom: '12px', color: '#00d4ff' }} />
          <p>Haberler yükleniyor...</p>
        </div>
      ) : news.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📡</div>
          <p>Haber bulunamadı.</p>
          <button className="content-retry-btn" onClick={() => loadNews(true)}>Tekrar Dene</button>
        </div>
      ) : (
        <div className="content-news-list">
          {news.map((item) => {
            const src = SOURCES[item.source] || SOURCES.other;
            return (
              <div key={item.id} className="content-news-item glass-card">
                <div className="content-news-body">
                  {item.trend && (
                    <span className={`content-trend ${item.trend}`}>
                      {item.trend === 'fire' ? <Flame size={12} /> : <TrendingUp size={12} />}
                    </span>
                  )}

                  <h4
                    className="content-news-title"
                    onClick={() => handleNewsClick(item)}
                  >
                    {item.title}
                  </h4>

                  <div className="content-news-meta">
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="content-source-link"
                      style={{ color: src.color }}
                      onClick={e => e.stopPropagation()}
                    >
                      {src.emoji} {item.sourceName}
                      <ExternalLink size={10} />
                    </a>
                    <span className="content-time">{timeAgo(item.publishedAt)}</span>
                    {item.category === 'ai_tech' && (
                      <span className="content-category-tag">AI/Tech</span>
                    )}
                  </div>
                </div>

                <button className="content-news-arrow" onClick={() => handleNewsClick(item)}>
                  <ChevronRight size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ========== Content Generation Overlay (Grouped) ========== */}
      {selectedNews && !contentType && (
        <div className="modal-overlay" onClick={() => setSelectedNews(null)}>
          <div className="modal-content glass-card content-gen-modal" onClick={e => e.stopPropagation()}>
            <button className="content-close" onClick={() => setSelectedNews(null)}>
              <X size={18} />
            </button>

            <h4 className="content-gen-title">{selectedNews.title}</h4>
            <p className="content-gen-source">
              {SOURCES[selectedNews.source]?.emoji} {selectedNews.sourceName}
            </p>

            <div className="content-gen-options">
              {/* X / Twitter Group */}
              <div className="content-gen-group">
                <div className="content-gen-group-label">
                  <TwitterIcon size={16} />
                  <span>𝕏 Twitter</span>
                </div>
                <div className="content-gen-group-buttons">
                  <button className="content-gen-btn content-gen-tweet" onClick={() => handleGenerate('tweet')}>
                    <div>
                      <span>Tek Tweet</span>
                      <small>280 kar. x 2 versiyon</small>
                    </div>
                  </button>
                  <button className="content-gen-btn content-gen-thread" onClick={() => handleGenerate('thread')}>
                    <div>
                      <span>Thread</span>
                      <small>5-12 tweet</small>
                    </div>
                  </button>
                </div>
              </div>

              {/* YouTube Group */}
              <div className="content-gen-group">
                <div className="content-gen-group-label">
                  <YoutubeIcon size={16} />
                  <span>YouTube</span>
                </div>
                <div className="content-gen-group-buttons">
                  <button className="content-gen-btn content-gen-youtube" onClick={() => handleGenerate('youtube')}>
                    <div>
                      <span>Video Script</span>
                      <small>3-8 dk outline + script</small>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== Generated Content View ========== */}
      {selectedNews && contentType && (
        <div className="modal-overlay" onClick={() => { setSelectedNews(null); setContentType(null); }}>
          <div className="modal-content glass-card content-result-modal" onClick={e => e.stopPropagation()}>
            <div className="content-result-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {contentType === 'youtube' ? <YoutubeIcon size={18} /> : <TwitterIcon size={18} />}
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {contentType === 'tweet' ? 'Tweet' : contentType === 'thread' ? 'Thread' : 'YouTube Script'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {generatedContent && !generating && (
                  <button className="content-copy-btn" onClick={handleCopy}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Kopyalandı' : 'Kopyala'}
                  </button>
                )}
                <button className="content-close-sm" onClick={() => { setSelectedNews(null); setContentType(null); }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="content-result-body">
              {generating ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Sparkles size={28} className="cal-spin" style={{ color: '#00d4ff', marginBottom: '12px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Volkan tarzında üretiliyor...</p>
                </div>
              ) : (
                <pre className="content-result-text">{generatedContent}</pre>
              )}
            </div>

            {!generating && generatedContent && (
              <div className="content-result-actions">
                <button className="content-regen-btn" onClick={() => handleGenerate(contentType)}>
                  <RefreshCw size={14} /> Tekrar Üret
                </button>
                <button className="content-back-btn" onClick={() => { setContentType(null); setGeneratedContent(''); }}>
                  ← Format Seç
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== API Keys Modal ========== */}
      {showKeyModal && (
        <div className="modal-overlay" onClick={() => setShowKeyModal(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <h3 style={{ color: '#00d4ff', marginBottom: '16px', fontSize: '1rem' }}>
              <Key size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
              API Keys
            </h3>

            {/* Gemini Key */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                <Sparkles size={14} />
                Gemini API Key
                {geminiKey && <span style={{ color: '#34A853', fontSize: '0.7rem' }}>aktif</span>}
              </label>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '8px', lineHeight: 1.4 }}>
                İçerik üretimi için gerekli.
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff', marginLeft: '4px' }}>
                  Buradan al →
                </a>
              </p>
              <input
                ref={geminiInputRef}
                type="password"
                defaultValue={geminiKey}
                placeholder="AIza..."
                className="todo-input"
                onKeyDown={e => { if (e.key === 'Enter') saveGeminiKey(e.target.value.trim()); }}
              />
            </div>

            {/* CryptoCompare Key */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                <Key size={14} />
                CryptoCompare Key
                {ccKey && <span style={{ color: '#34A853', fontSize: '0.7rem' }}>aktif</span>}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 400 }}>(opsiyonel)</span>
              </label>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '8px', lineHeight: 1.4 }}>
                CoinDesk, Decrypt, TechCrunch haberleri için.
                <a href="https://min-api.cryptocompare.com" target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff', marginLeft: '4px' }}>
                  Buradan al →
                </a>
              </p>
              <input
                ref={ccInputRef}
                type="password"
                defaultValue={ccKey}
                placeholder="Key..."
                className="todo-input"
                onKeyDown={e => { if (e.key === 'Enter') saveCcKeyLocal(e.target.value.trim()); }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-cancel" onClick={() => setShowKeyModal(false)}>İptal</button>
              <button
                className="btn-save"
                style={{ background: '#00d4ff' }}
                onClick={() => {
                  saveGeminiKey(geminiInputRef.current?.value?.trim() || '');
                  saveCcKeyLocal(ccInputRef.current?.value?.trim() || '');
                  setShowKeyModal(false);
                }}
              >
                Kaydet
              </button>
            </div>

            {(geminiKey || ccKey) && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
                {geminiKey && (
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--error-color)', fontSize: '0.72rem', cursor: 'pointer' }}
                    onClick={() => { saveGeminiKey(''); if (geminiInputRef.current) geminiInputRef.current.value = ''; }}
                  >
                    Gemini key sil
                  </button>
                )}
                {ccKey && (
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--error-color)', fontSize: '0.72rem', cursor: 'pointer' }}
                    onClick={() => { saveCcKeyLocal(''); if (ccInputRef.current) ccInputRef.current.value = ''; }}
                  >
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
