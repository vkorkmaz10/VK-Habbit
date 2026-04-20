# VK-Habbit — Architecture Reference

> **Hedef kitle:** Bu projeyi ilk kez açan bir AI asistanı veya geliştirici.  
> Bu dokümanı okuduktan sonra projenin tüm modüllerini, veri akışlarını ve kararların nedenlerini anlayabilmelisin.

---

## 1. Overview

VK-Habbit, iki ana iş birimini tek PWA çatısı altında birleştiren kişisel bir uygulamadır:

| Birim | Kapsam |
|---|---|
| **Fitness & Habit Tracker** | Günlük rutin takibi (12 alışkanlık), kilo, kas grupları, haftalık skor |
| **Content Engine** | Kripto haber akışı → VSE (Volkan Style Engine) → Tweet / Thread / YouTube scripti |

### Tech Stack

| Katman | Teknoloji |
|---|---|
| UI | React 19, vanilla CSS (`index.css`) |
| Build | Vite 7, vite-plugin-pwa |
| İkonlar | lucide-react |
| Tarih | date-fns |
| AI | Google Gemini API (gemini-2.5-flash, fallback: 2.0-flash, 2.5-flash-lite) |
| Depolama | localStorage (backend yok) |
| Deploy | Render.com (Web Service: Express + Static dist/) |
| PWA | Service Worker, manifest, auto-update |

---

## 2. Klasör Yapısı

```
vkgym/
├── server.js                     # Express sunucu — /api/* endpoint'ler + dist/ static + SPA fallback
├── render.yaml                   # Render.com Web Service config (Node 20, free plan)
│
├── src/
│   ├── main.jsx                  # React entry point
│   ├── App.jsx                   # Tab router + global state
│   ├── index.css                 # Global styles (Dark Neon theme)
│   │
│   ├── components/
│   │   ├── Header.jsx            # Week navigator + SVG score rings + swipe navigation
│   │   ├── DailyView.jsx         # Habit checklist + weight slider (geçmiş günler read-only)
│   │   ├── WeeklyReport.jsx      # Weekly stats + body heatmap
│   │   ├── TodoView.jsx          # Task manager + Pomodoro timer
│   │   ├── CalendarView.jsx      # Local events + Google Calendar sync
│   │   ├── ContentView.jsx       # News feed + VSE content generator
│   │   ├── BodyHighlighter.jsx   # SVG muscle group visualizer
│   │   └── SettingsView.jsx      # Backup/restore + API key management (şifre korumalı)
│   │
│   ├── engine/
│   │   └── vse.js                # VSE: prompt composition logic (pure JS, hardcoded VOLKAN_BASE)
│   │
│   ├── config/
│   │   ├── vse_prompts.js        # (dead code — vse.js artık buradan import etmiyor)
│   │   ├── volkan_dev_persona.json  # Persona tanımı (referans, prompt'a doğrudan beslenmez)
│   │   └── persona_references.json # Referans içerik şablonları (tweet, thread, YouTube)
│   │
│   ├── utils/
│   │   ├── storage.js            # TÜM localStorage okuma/yazma işlemleri buradan geçer
│   │   ├── date.js               # Tarih mantığı (03:00 reset, haftabaşı, Türkçe format)
│   │   ├── news.js               # /api/news ve /api/cp-news fetch wrapper'ları
│   │   ├── backup.js             # JSON export/import
│   │   └── googleCalendar.js     # Google Calendar OAuth + API
│   │
│   ├── data/
│   │   └── constants.js          # CHECKBOX_ITEMS (12 alışkanlık), START_DATE_STR
│   │
│   └── assets/
│       └── hero.png
│
├── public/
│   └── icon.png                  # PWA ikonu
│
├── docs/
│   ├── Architecture.md           # Bu dosya
│   └── VSEngine.md               # VSE detay dokümantasyonu
│
├── vite.config.js                # Vite + dev middleware (RSS, CryptoCompare, URL scraper)
├── .env                          # Gizli anahtarlar (git'e gitmez)
└── .env.example                  # Örnek env şablonu
```

---

## 3. Tab Routing (App.jsx)

React Router kullanılmaz. `App.jsx` bir `currentTab` state'i yönetir ve beş sekmeyi koşullu render ile gösterir.

```
currentTab değeri → Render edilen içerik          → Alt Nav sırası
──────────────────────────────────────────────────────────────────
'habit'    → Header + DailyView + WeeklyReport     → 1. Habit
'todo'     → Header + TodoView                     → 2. To-Do
'content'  → ContentView  (display:none!)          → 3. Content
'calendar' → Header + CalendarView                 → 4. Takvim
'page5'    → SettingsView                          → 5. Ayarlar
```

> **Önemli:** `ContentView` her zaman mount'ta kalır (`display:none` / `display:flex` toggle). Tab değişince React state'i sıfırlanmaz. Üretilen içerikler `sessionStorage`'da da yedeklenir.

Her sekmenin **bağımsız** `selectedDateStr` ve `refreshTrigger` state'i vardır.

### Custom Window Events (cross-component iletişim)

| Event | Tetikleyen | Dinleyen | Amaç |
|---|---|---|---|
| `calendarDateSelect` | CalendarView (ay modal) | App.jsx | Takvim tarih seçimi |
| `vkgym_goto_settings` | ContentView (key eksik) | App.jsx | Ayarlar'a yönlendir |
| `vkgym_key_updated` | SettingsView (key kaydet/sil) | ContentView | Gemini + CC key state'ini tazele |

---

## 4. Fitness & Habit Modülü

### 4.1 Alışkanlık Listesi (`src/data/constants.js`)

12 elemanlı `CHECKBOX_ITEMS` dizisi uygulamanın kalbidir. **Sıra sabit** — indeks numaraları skor hesabında hardcode kullanılır.

| İndeks | Alışkanlık | Tür |
|---|---|---|
| 0 | Kahvaltı | Core |
| 1 | Whey (antrenman sonrası) | Workout-conditional |
| 2 | Ana Öğün | Core |
| 3 | Akşam Yemeği | Core |
| 4 | Gece Öğünü | Core |
| 5 | Su | Core |
| 6 | Kreatin | Core |
| 7 | Uyku | Core |
| 8 | Antrenman ✓ | Workout trigger |
| 9 | Ağırlık Artışı | Workout-conditional |
| 10 | Karın | Core |
| 11 | Kardiyo | Core |

**Core indices:** `[0, 2, 3, 4, 5, 6, 7, 10, 11]`  
**Workout-conditional:** `[1, 8, 9]` — sadece antrenman günü tam sayılır

### 4.2 Skor Formülü (`storage.js → calculateDayScore`)

```
Antrenman günü (c[8] === 1):
  score = round((coreChecked + workoutChecked) / 12 * 100)

Dinlenme günü:
  weekWorkouts = o hafta c[8] === 1 olan gün sayısı
  maxScore = weekWorkouts >= 5 ? 100 : weekWorkouts === 4 ? 90 : 70
  score = round((coreChecked / 9) * maxScore)
```

### 4.3 Geçmiş Gün Kilidi (DailyView.jsx)

```js
const isPast = selectedDateStr < getActiveDateString();
```

`isPast === true` ise:
- Kilo slider `disabled`, opacity 0.45
- Kilo value tıklanamaz (cursor: default)
- Checkbox'lar tıklanamaz (onClick guard + opacity 0.6)
- Kilo hint metni gösterilmez

### 4.4 Veri Şeması

```json
{
  "startDate": "2026-03-23",
  "days": {
    "2026-04-15": {
      "w": 75.5,
      "c": [1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0],
      "m": ["Göğüs", "Triceps"],
      "t": [
        { "id": "uuid", "text": "Görev", "done": false, "createdAt": "2026-04-15" }
      ]
    }
  },
  "calendarEvents": []
}
```

Tüm okuma/yazma işlemleri `src/utils/storage.js` üzerinden geçer. **Component'lerden doğrudan `localStorage` erişimi yasaktır.**

---

## 5. Todo Modülü

### 5.1 Task Rollover
`performRollover(todayStr)` App açılışında çağrılır. Geçmiş günlerdeki `done: false` ve `rolled: false` taskler bugüne kopyalanır. Orijinal task `rolled: true` işareti alır.

### 5.2 Pomodoro
`localStorage` key: `vkgym_pomodoro`  
3 mod: **Quick** (25dk), **Focus** (50dk), **Delegate** (görev devri)

---

## 6. Calendar Modülü

### 6.1 Yerel Etkinlikler
`vkgym_data.calendarEvents[]` içinde saklanır. CRUD işlemleri: `addCalendarEvent`, `updateCalendarEvent`, `removeCalendarEvent` (storage.js).

### 6.2 Google Calendar Entegrasyonu
`src/utils/googleCalendar.js` — OAuth 2.0 akışı, token yönetimi ve Google Calendar API v3 çağrıları.  
CalendarView bileşeni `calendarDateSelect` custom window event'i ile ay görünümünden gün seçimini alır.

---

## 7. Content Modülü & News Pipeline

```
CryptoCompare API                  RSS Feeds (CoinDesk, CoinTelegraph...)
       ↓                                          ↓
  /api/cp-news?key=...                      /api/news
  (key: localStorage → query param)    (Vite middleware / Express route)
  (fallback: Render env var)                    ↓
       ↓                                  AI/Tech sınıflandırma
  fetchCPNews(apiKey)                     (isAiTech keyword check)
       ↓                                          ↓
                ContentView.jsx
                  ↓          ↓
           Haber seç     Serbest metin gir
                  ↓          ↓
             scrapeArticle()  (fetch-url.js → Jina AI fallback)
                       ↓
               Style Picker Modal (Dengeli / Viral / Sade)
                       ↓
              vse.js → buildTweetPrompt() veya buildThreadPrompt()
                       ↓
              Gemini API (gemini-2.5-flash)
                       ↓
              Chat alanında göster + Edit/Kaydet → saveFeedback()
```

### 7.1 CryptoCompare Key Akışı

1. Kullanıcı Ayarlar → CryptoCompare API Key alanına key girer
2. `localStorage['vkgym_cc_key']` olarak saklanır
3. `ContentView.loadCPNews()` → `fetchCPNews(key)` → `/api/cp-news?key=<key>`
4. `server.js` `/api/cp-news` handler: `req.query.key || process.env.CRYPTOCOMPARE_API_KEY`
5. Dev ortamında `vite.config.js` middleware de aynı önceliği uygular

### 7.2 URL Scraper Katmanları (`server.js` → `/api/fetch-url`)
1. Doğrudan fetch (browser headers)
2. Cloudflare tespit → **Jina AI fallback** (`https://r.jina.ai/{url}`)
3. `blocked: true` flag döner → ContentView sarı uyarı + URL kopyala

### 7.3 Gemini Key Yönetimi (ContentView)

```js
const resolveKey = () => {
  const fresh = localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  if (fresh && fresh !== geminiKey) setGeminiKey(fresh);
  return fresh || geminiKey;
};
```

Her generate çağrısında localStorage'dan taze okuma yapılır. Stale state sorunu önlenir.

---

## 8. Header — Swipe Navigasyonu

`Header.jsx` hafta geçişini dokunmatik swipe ile yönetir. Ok butonları kaldırılmıştır.

```js
const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
const handleTouchEnd = (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX.current;
  if (Math.abs(dx) > 50) dx < 0 ? handleNextWeek() : handlePrevWeek();
  touchStartX.current = null;
};
```

- Sola kaydır (dx < 0) → sonraki hafta
- Sağa kaydır (dx > 0) → önceki hafta
- Threshold: 50px
- Gelecek haftaya geçiş engellenir

---

## 9. API Katmanı (Express / Render Web Service)

`server.js` tek bir Express sunucusu — hem `/api/*` route'larını handle eder hem `dist/` static dosyalarını serve eder. Frontend'in `fetch('/api/...')` çağrıları aynen çalışır (path değişmedi). Render.com free tier; 15 dakika inaktivite sonrası uyur (cold start ~30-60 sn).

| Endpoint | Dosya | Yöntem | Açıklama |
|---|---|---|---|
| `/api/cp-news` | `server.js` (Express route) | GET | CryptoCompare News, `?key=` query param önce, env var fallback |
| `/api/news` | `server.js` (Express route) | GET | Multi-source RSS (CoinDesk, CoinTelegraph, Decrypt, TheBlock) |
| `/api/fetch-url` | `server.js` (Express route) | POST `{url}` | URL içerik kazıyıcı, Jina AI fallback |
| `/api/chat` | `server.js` (Express route) | POST | Claude API proxy (legacy) |

**Dev ortamında** bu endpoint'ler `vite.config.js` içindeki middleware olarak çalışır.  
**Production'da** Render.com Web Service olarak deploy edilir; `npm start` (`node server.js`) çalışır, `dist/` Vite build'i Express ile serve edilir. Göç tarihçesi: Vercel → (kısa Netlify denemesi) → Render. Env var'lar Render Dashboard'da tutulur, hack sonrası rotate edildi.

---

## 10. Güvenlik & Environment Variables

### Kural
> Hiçbir API anahtarı frontend bundle'ına girmez. `VITE_` prefix'i **kullanılmaz**.

| Değişken | Nerede kullanılır | Nerede saklanır |
|---|---|---|
| `CRYPTOCOMPARE_API_KEY` | `server.js` `/api/cp-news` (fallback) | Render Dashboard + `.env` |
| `ANTHROPIC_API_KEY` | `server.js` `/api/chat` | Render Dashboard + `.env` |
| `GEMINI_API_KEY` | Frontend localStorage (`vkgym_gemini_key`) | Kullanıcı Ayarlar'dan girer |
| `CC_API_KEY` | Frontend localStorage (`vkgym_cc_key`) | Kullanıcı Ayarlar'dan girer |

### API Key Görüntüleme Koruması (SettingsView)

Gemini ve CryptoCompare key'lerindeki göz (👁) butonuna basıldığında şifre modalı açılır:
- Şifre: `vk2017` (aynı şifre "Tüm Verileri Sil" ile paylaşılır)
- Doğru şifre → key 30 saniye görünür, sonra otomatik gizlenir
- Yanlış şifre → hata mesajı, key gizli kalır

### `.env` Kuralları
- `.env` dosyası `.gitignore`'da — asla commit edilmez
- `.env.example` şablonu repo'da var
- Vite'de `loadEnv(mode, cwd, '')` ile tüm env var'lar (prefix'siz) server middleware'e aktarılır

---

## 11. UI/UX — Dark Neon Tema

Tüm stiller `src/index.css` içinde, CSS custom properties ile:

```css
--bg-primary:    #0d1117   /* Koyu arka plan */
--bg-secondary:  #161b22   /* Panel arka planı */
--accent-color:  #39ff14   /* Neon yeşil */
--text-main:     #e6edf3
--text-muted:    #8b949e
--error-color:   #ef4444
```

**Component hiyerarşisi:**
```
App.jsx
├── Header.jsx          (SVG progress rings, swipe hafta navigasyonu)
├── [Tab Content]
│   ├── DailyView       → WeightSlider + CheckboxList + MuscleModal (geçmiş günler read-only)
│   ├── TodoView        → TaskList + PomodoroTimer
│   ├── CalendarView    → MonthView + DayEvents + GoogleSync
│   ├── ContentView     → NewsFeed (Gündem + CryptoCompare) + ChatArea + StylePicker
│   └── SettingsView    → BackupPanel + APIKeys (şifre korumalı görüntüleme)
└── BottomNav           (5 sekme: Habit, To-Do, Content, Takvim, Ayarlar)
```

---

## 12. PWA Yapısı

`vite-plugin-pwa` ile yapılandırılmıştır. `vite.config.js`:

```js
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'VK10GYM Fitness Tracker',
    theme_color: '#121826',
    display: 'standalone',
    icons: [{ src: 'icon.png', sizes: '192x192|512x512' }]
  }
})
```

Service worker `autoUpdate` modunda — yeni deploy sonrası sessizce güncellenir.

---

## 13. Tarih Mantığı (`src/utils/date.js`)

> **Kritik:** Günlük sıfırlanma gece yarısı değil, **03:00'da** gerçekleşir.

```js
// getActiveDateString() — her zaman bunu kullan, new Date() değil
export function getActiveDateString() {
  const now = new Date();
  now.setHours(now.getHours() - 3); // 03:00'dan önce = önceki gün
  return format(now, 'yyyy-MM-dd');
}
```

`START_DATE_STR = '2026-03-23'` — hafta numaralandırmasının başlangıç noktası (W1).

---

## 14. VSE — Volkan Style Engine (`src/engine/vse.js`)

> Detaylı dokümantasyon: `docs/VSEngine.md`

- `VOLKAN_BASE`: Hardcoded persona tanımı. **Persona JSON'dan beslenmez** (refactor geri alındı — bkz. Değişiklik Geçmişi).
- `CLASSIFICATION_BLOCK`: Model iç analiz için kullanır, çıktıya yazmaz.
- `STYLE_CONFIG`: `prime` (Dengeli), `viral` (Viral), `clean` (Sade)
- Golden Examples: `getFeedbackLog()` → son 3 kullanıcı düzenlemesi prompt'a eklenir

---

## 15. Yeni Bir AI Asistanına Onboarding

Projeyi ilk kez açıyorsan şu dosyaları sırayla oku:

1. `CLAUDE.md` — geliştirme kuralları, komutlar
2. `src/data/constants.js` — 12 alışkanlık (sıra değiştirme)
3. `src/utils/storage.js` — tüm veri okuma/yazma fonksiyonları
4. `src/utils/date.js` — tarih mantığı (03:00 kuralı)
5. `src/engine/vse.js` — içerik üretim motoru (tek kaynak, dışa bağımlılık yok)
6. `src/App.jsx` — tab routing ve global state
7. `docs/VSEngine.md` — VSE detayları

**Asla:** component içinden doğrudan `localStorage` okuma/yazma. Her şey `storage.js` üzerinden.

---

## 16. Değişiklik Geçmişi (Önemli Kararlar)

| Tarih | Değişiklik | Neden |
|---|---|---|
| 2026-04 | CryptoPanic → CryptoCompare | CryptoPanic API erişim sorunu; CryptoCompare daha kararlı |
| 2026-04 | Discord bot kaldırıldı | Doğrudan API entegrasyonu yeterli |
| 2026-04 | VSE refactor geri alındı | `volkan_dev_persona.json` entegrasyonu "Dostlar/Arkadaşlar/Hadi bakalım" klişelerine yol açtı; hardcoded VOLKAN_BASE daha güvenilir |
| 2026-04 | Header ok butonları → swipe | Mobil UX iyileştirmesi |
| 2026-04 | Geçmiş gün read-only | Geri tarihli veri değişikliğini önler |
| 2026-04 | CC key localStorage'a taşındı | Kullanıcı kendi key'ini Ayarlar'dan girebilir, env var fallback kalır |
| 2026-04 | API key şifre koruması | Shoulder surfing ve yetkisiz görüntülemeye karşı |
