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
| Ikonlar | lucide-react |
| Tarih | date-fns |
| AI | Google Gemini API (gemini-2.5-flash, fallback: 2.0-flash, 2.5-flash-lite) |
| Depolama | localStorage (backend yok) |
| Deploy | Vercel (Serverless Functions + Static) |
| PWA | Service Worker, manifest, auto-update |

---

## 2. Klasör Yapısı

```
vkgym/
├── api/                          # Vercel Serverless Functions
│   ├── cp-news.js                # CryptoCompare News API proxy
│   ├── news.js                   # Multi-source RSS feed parser
│   ├── fetch-url.js              # URL scraper (Jina AI fallback)
│   └── chat.js                   # Claude API proxy (legacy)
│
├── src/
│   ├── main.jsx                  # React entry point
│   ├── App.jsx                   # Tab router + global state
│   ├── index.css                 # Global styles (Dark Neon theme)
│   │
│   ├── components/
│   │   ├── Header.jsx            # Week navigator + SVG score rings
│   │   ├── DailyView.jsx         # Habit checklist + weight slider
│   │   ├── WeeklyReport.jsx      # Weekly stats + body heatmap
│   │   ├── TodoView.jsx          # Task manager + Pomodoro timer
│   │   ├── CalendarView.jsx      # Local events + Google Calendar sync
│   │   ├── ContentView.jsx       # News feed + VSE content generator
│   │   ├── BodyHighlighter.jsx   # SVG muscle group visualizer
│   │   └── SettingsView.jsx      # Backup/restore + API key management
│   │
│   ├── engine/
│   │   └── vse.js                # VSE: prompt composition logic (pure JS)
│   │
│   ├── config/
│   │   ├── vse_prompts.js        # Prompt constants: VOLKAN_BASE, CLASSIFICATION_BLOCK, STYLE_CONFIG
│   │   ├── volkan_dev_persona.json  # Persona tanımı (identity, tone, platform rules)
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
currentTab değeri → Render edilen içerik
─────────────────────────────────────────
'habit'    → Header + DailyView + WeeklyReport
'todo'     → Header + TodoView
'calendar' → Header + CalendarView
'content'  → ContentView  (display:none ile gizlenir, unmount edilmez!)
'page5'    → SettingsView
```

> **Önemli:** `ContentView` her zaman mount'ta kalır (`display:none` / `display:flex` toggle). Tab değişince React state'i sıfırlanmaz. Üretilen içerikler `sessionStorage`'da da yedeklenir.

Her sekmenin **bağımsız** `selectedDateStr` ve `refreshTrigger` state'i vardır.

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

### 4.3 Veri Şeması

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
  /api/cp-news                              /api/news
  (Vercel serverless)                  (Vite middleware / Vercel)
       ↓                                          ↓
  sentiment field                          AI/Tech sınıflandırma
  (positive/negative/neutral)              (isAiTech keyword check)
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

### 7.1 URL Scraper Katmanları (`api/fetch-url.js`)
1. Doğrudan fetch (browser headers)
2. Cloudflare tespit → **Jina AI fallback** (`https://r.jina.ai/{url}`)
3. `blocked: true` flag döner → ContentView sarı uyarı + URL kopyala

---

## 8. API Katmanı (Vercel Serverless)

| Endpoint | Dosya | Yöntem | Açıklama |
|---|---|---|---|
| `/api/cp-news` | `api/cp-news.js` | GET | CryptoCompare News, 20 haber, 5dk cache |
| `/api/news` | `api/news.js` | GET | Multi-source RSS (CoinDesk, CoinTelegraph, Decrypt, TheBlock) |
| `/api/fetch-url` | `api/fetch-url.js` | POST `{url}` | URL içerik kazıyıcı, Jina AI fallback |
| `/api/chat` | `api/chat.js` | POST | Claude API proxy (legacy) |

**Dev ortamında** bu endpoint'ler `vite.config.js` içindeki middleware olarak çalışır.  
**Production'da** aynı dosyalar Vercel Serverless Function olarak deploy edilir.

---

## 9. Güvenlik & Environment Variables

### Kural
> Hiçbir API anahtarı frontend bundle'ına girmez. `VITE_` prefix'i **kullanılmaz**.

| Değişken | Nerede kullanılır | Nerede saklanır |
|---|---|---|
| `CRYPTOCOMPARE_API_KEY` | `api/cp-news.js` | Vercel Dashboard + `.env` |
| `ANTHROPIC_API_KEY` | `api/chat.js` | Vercel Dashboard + `.env` |
| `GEMINI_API_KEY` | Frontend localStorage (`vkgym_gemini_key`) | Kullanıcı girer |

**Gemini key** kullanıcı tarafından Settings → API Keys alanından girilir ve localStorage'da saklanır. Bu bilinçli bir trade-off: uygulama backend'siz çalışıyor.

### `.env` Kuralları
- `.env` dosyası `.gitignore`'da — asla commit edilmez
- `.env.example` şablonu repo'da var
- Vite'de `loadEnv(mode, cwd, '')` ile tüm env var'lar (prefix'siz) server middleware'e aktarılır

---

## 10. UI/UX — Dark Neon Tema

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
├── Header.jsx          (SVG progress rings, hafta navigasyonu)
├── [Tab Content]
│   ├── DailyView       → WeightSlider + CheckboxList + MuscleModal
│   ├── TodoView        → TaskList + PomodoroTimer
│   ├── CalendarView    → MonthView + DayEvents + GoogleSync
│   ├── ContentView     → NewsFeed + ChatArea + StylePicker
│   └── SettingsView    → BackupPanel + APIKeys
└── BottomNav           (5 sekme)
```

---

## 11. PWA Yapısı

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

## 12. Tarih Mantığı (`src/utils/date.js`)

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

## 13. Yeni Bir AI Asistanına Onboarding

Projeyi ilk kez açıyorsan şu dosyaları sırayla oku:

1. `CLAUDE.md` — geliştirme kuralları, komutlar
2. `src/data/constants.js` — 12 alışkanlık (sıra değiştirme)
3. `src/utils/storage.js` — tüm veri okuma/yazma fonksiyonları
4. `src/utils/date.js` — tarih mantığı (03:00 kuralı)
5. `src/engine/vse.js` + `src/config/vse_prompts.js` — içerik üretim motoru
6. `src/App.jsx` — tab routing ve global state
7. `docs/VSEngine.md` — VSE detayları

**Asla:** component içinden doğrudan `localStorage` okuma/yazma. Her şey `storage.js` üzerinden.
