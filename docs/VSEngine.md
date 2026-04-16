# VSE — Volkan Style Engine

> **TL;DR:** Ham kripto haberi girer, Volkan Korkmaz'ın sesinde Türkçe tweet/thread/script çıkar.  
> Engine, React'tan bağımsız saf JS modülleridir. API çağrısı yapmaz, sadece prompt üretir.

---

## 1. Ne Yapar

VSE, içerik üretiminin "beyin" katmanıdır. İki şeyi birbirinden ayırır:

- **Prompt Building** (`vse.js`) — neyi nasıl soracağını bilir  
- **Prompt Constants** (`vse_prompts.js`) — kim olduğunu ve nasıl konuştuğunu tanımlar

ContentView bu iki katmandan gelen çıktıyı Gemini API'ye gönderir.

---

## 2. Veri Akışı

```
Kullanıcı bir haber seçer (veya serbest metin girer)
             ↓
     scrapeArticle(url)          ← api/fetch-url.js
             ↓
   { title, content, source }    ← newsInput objesi
             ↓
  Stil seçimi: prime / viral / clean
             ↓
  ┌─────────────────────────────────┐
  │         vse.js                  │
  │  buildTweetPrompt(newsInput, style)  │
  │  buildThreadPrompt(newsInput, style) │
  │         ↓                      │
  │  vse_prompts.js'den import:     │
  │  VOLKAN_BASE                    │
  │  CLASSIFICATION_BLOCK           │
  │  STYLE_CONFIG[style]            │
  │         ↓                      │
  │  buildGoldenExamplesFromFeedback│  ← storage.js'den
  └─────────────────────────────────┘
             ↓
   { systemPrompt, userPrompt }
             ↓
      Gemini API çağrısı          ← ContentView.jsx → callGemini()
             ↓
        Ham metin çıktı
             ↓
   Tweet: direkt göster
   Thread: splitThreadBlocks() ile bloklara ayır
             ↓
   Kullanıcı düzenler → saveFeedback()   ← storage.js
             ↓
   Bir sonraki üretimde golden example olarak enjekte edilir
```

---

## 3. Dosya Yapısı

```
src/
├── engine/
│   └── vse.js              # Prompt composition mantığı (fonksiyonlar)
└── config/
    ├── vse_prompts.js       # Sabitler: VOLKAN_BASE, CLASSIFICATION_BLOCK, STYLE_CONFIG
    ├── volkan_dev_persona.json   # Persona tanımı — tek kaynak hakikat
    └── persona_references.json  # Manuel referans içerik şablonları
```

### Sorumluluk Dağılımı

| Dosya | Ne Tutar | Ne Tutmaz |
|---|---|---|
| `vse.js` | Prompt birleştirme fonksiyonları, golden example injection | Sabit stringler |
| `vse_prompts.js` | `VOLKAN_BASE`, `CLASSIFICATION_BLOCK`, `STYLE_CONFIG` | Fonksiyon mantığı |
| `volkan_dev_persona.json` | Kimlik, ses tonu, platform kuralları, yasak ifadeler | Prompt formatları |
| `persona_references.json` | Örnek tweet/thread/YouTube içerikleri (kullanıcı doldurur) | Canlı engine mantığı |

---

## 4. Stil Sistemi (STYLE_CONFIG)

Üç yerleşik stil bulunur. Her stil `sharpness`, `emotion` ve `toneDesc` parametrelerine sahiptir.

| Stil | Label | Sharpness | Emotion | Ne Zaman |
|---|---|---|---|---|
| `prime` | Dengeli | 0.6 | 0.4 | Standart analiz, dengeli yorumlar |
| `viral` | Viral | 0.8 | 0.6 | Dikkat çekici açılışlar, tartışmalı konular |
| `clean` | Sade | 0.4 | 0.2 | Haber özeti, hızlı bilgi aktarımı |

**Yeni stil eklemek:**

```js
// src/config/vse_prompts.js → STYLE_CONFIG içine ekle:
expert: {
  label: 'Uzman',
  description: 'Teknik, derinlemesine analiz',
  tone: 'technical',
  sharpness: 0.5,
  emotion: 0.2,
  toneDesc: 'Teknik terimler kullanabilirsin, ama erişilebilir kal. Grafik verilere atıf yap.',
},
```

Başka hiçbir dosyada değişiklik gerekmez.

---

## 5. Tweet Prompt Anatomisi

`buildTweetPrompt(newsInput, style)` çağrısı şu system prompt'u üretir:

```
[VOLKAN_BASE]                   ← Kimlik + ses tonu + filtreler
[CLASSIFICATION_BLOCK]          ← Haberi zihinsel olarak sınıflandır
[GÖREV]: Tek bir tweet üret.
[STİL: DENGELI]:                ← STYLE_CONFIG[style].toneDesc
  Dengeli ve sakin bir ton...
FORMAT KURALLARI:
  - Türkçe yaz, her zaman
  - Maksimum 280 karakter
  - Yapı: güçlü açılış → ana insight → çatışma/nüans → yumuşak sonuç
  - Maksimum 1 emoji
  - Gereksiz giriş cümlesi yok
  - Hashtag spam yok
[ALTIN ÖRNEKLER]                ← Varsa, son 3 kullanıcı düzenlemesi
```

User prompt:
```
Başlık: "Bitcoin ETF onaylandı"
Kaynak: CryptoCompare
Haber içeriği: [ilk 1200 karakter]

İçeriği üret.
```

---

## 6. Thread Prompt Anatomisi

`buildThreadPrompt(newsInput, style)` tweet'e kıyasla iki fark içerir:

1. **Kaynak zorunluluğu** — "Haberdeki spesifik verileri MUTLAKA kullan. Veri uydurmak yasak."
2. **Blok sistemi** — Konunun derinliğine göre 5–10 tweet, seçilebilir bloklar:

```
ZORUNLU:
  • intro       — headline kır, merak uyandır
  • conclusion  — açık kapı bırakan kapanış

OPSİYONEL (konuya göre seç):
  • explainContext    — arka plan, neden şimdi önemli
  • expandDriver:bull — yükseliş argümanı (veriye dayalı)
  • expandDriver:bear — risk faktörleri
  • addExtraData      — haber içeriğinden sayı/tarih/şirket
  • interpretConflict — aynı anda bullish & bearish neden olunabilir
  • scenarioA         — pozitif senaryo
  • scenarioB         — negatif senaryo
  • personalTake      — Volkan'ın yorumu ("bana göre")
```

**Uzunluk karar mantığı:**
```
Basit haber      → 5-6 tweet
Orta derinlik    → 7-8 tweet
Karmaşık konu    → 9-10 tweet
```

**Format:** `1/7`, `2/7` ... Her tweet max 280 karakter. İlk tweet `🧵` ile başlar.

---

## 7. Golden Examples — Öğrenen Sistem

VSE, kullanıcının düzenlediği içerikleri "altın örnek" olarak biriktirerek zamanla Volkan'ın tarzına yaklaşır.

### Akış

```
Kullanıcı içeriği düzenler → [Kaydet] butonuna basar
      ↓
saveFeedback({ mode, style, original, edited, newsTitle, newsSource })
      ↓
localStorage['vkgym_vse_feedback'] → entry dizisine eklenir
      ↓
Bir sonraki buildTweetPrompt / buildThreadPrompt çağrısında:
      ↓
buildGoldenExamplesFromFeedback(mode, style)
  → aynı mode+style için son 3 düzenleme alınır
  → "ALTIN ÖRNEKLER" bloğu olarak system prompt sonuna eklenir
```

### Feedback Entry Şeması

```json
{
  "id": "1714000000000-abc12",
  "timestamp": "2026-04-15T10:30:00.000Z",
  "newsTitle": "Bitcoin ETF onaylandı",
  "newsSource": "https://...",
  "mode": "tweet",
  "style": "prime",
  "original": "VSE'nin ürettiği orijinal metin",
  "edited": "Kullanıcının düzenlediği final metin"
}
```

### API

```js
import { saveFeedback, getFeedbackLog } from '../utils/storage';
import { buildGoldenExamplesFromFeedback } from '../engine/vse';

// Kaydet
saveFeedback({ mode: 'tweet', style: 'viral', original: '...', edited: '...' });

// Tüm logu oku
const log = getFeedbackLog();

// Engine'de kullan (otomatik çağrılır)
const examples = buildGoldenExamplesFromFeedback('thread', 'prime');
```

---

## 8. Persona Katmanı

`volkan_dev_persona.json` VSE'nin kimlik kaynağıdır. `vse_prompts.js` bu JSON'u `buildVolkanBase()` fonksiyonu ile VOLKAN_BASE string'ine dönüştürür.

### JSON Alanları

```json
{
  "identity": {
    "name": "Volkan Korkmaz",
    "handle": "@vkorkmaz10",
    "vibe": "Şeffaf, Enerjik, Mentör ruhlu, Samimi"
  },
  "global_dna": {
    "tone": "Samimi, teknik ama sade, abi/dost canlısı",
    "forbidden": "Asla robotik veya kurumsal ağız kullanma",
    "keywords": ["arkadaşlar", "dostlar", "vallahi", "billahi"]
  },
  "twitter_mode": {
    "rules": "Kısa, vurucu, dinamik. Hook ile başla.",
    "signature": "Hadi bakalım"
  },
  "youtube_mode": {
    "transitions": ["Akabinde", "Nihayetinde", "Haliyle", ...],
    "structure": "Tümdengelim (Önce Makro/Piyasa, sonra Mikro/Altcoin)"
  }
}
```

**Persona'yı güncellemek için:** Sadece `volkan_dev_persona.json` dosyasını düzenle. `vse.js` veya `vse_prompts.js`'e dokunmak gerekmez.

---

## 9. persona_references.json — Manuel Altın Örnekler

Otomatik feedback sistemi dışında, manuel olarak doldurulabilen referans içerik şablonu.

```json
{
  "x_single_tweets": [{ "content": "BURAYA YAPIŞTIRILACAK" }],
  "x_threads":       [{ "hook": "...", "body": "...", "closing": "..." }],
  "youtube_scripts": [{ "intro": "...", "structure": "..." }]
}
```

`ContentView.jsx`'te YouTube script ve hızlı komutlar için `getGoldenExamplesBlock(type)` fonksiyonu bu dosyayı okur. "BURAYA YAPIŞTIRILACAK" placeholder'larını tespit edip atlar.

---

## 10. YouTube Modu

YouTube scriptleri VSE üzerinden değil, ContentView'deki ayrı bir prompt bloğu ile üretilir. Persona JSON'daki `youtube_mode` alanı bu scriptlere renk katar:

- **Transitions:** "Akabinde", "Nihayetinde", "Haliyle", "Ufak ufak", "Şöyle bir bakalım"
- **Yapı:** Tümdengelim — Önce makro piyasa durumu, sonra spesifik altcoin/pozisyon analizi

---

## 11. Sık Sorulan Sorular

**S: Yeni bir mod eklemek istiyorum (örn. LinkedIn).**  
C: `vse.js`'e yeni bir `buildLinkedInPrompt(newsInput, style)` fonksiyonu ekle. `VOLKAN_BASE` ve `CLASSIFICATION_BLOCK` aynı kalır, sadece format kuralları değişir.

**S: Volkan'ın tonunu değiştirmek istiyorum.**  
C: `volkan_dev_persona.json` → `global_dna.tone` veya `twitter_mode.rules` güncelle. Başka değişiklik gerekmez.

**S: Golden examples çalışmıyor, neden?**  
C: `localStorage['vkgym_vse_feedback']` boş olabilir. En az 1 içerik üret, düzenle ve kaydet. Sonraki üretimde enjekte edilir.

**S: Gemini hangi model?**  
C: Primary: `gemini-2.5-flash`. Fallback sırası: `gemini-2.0-flash` → `gemini-2.5-flash-lite`. Model listesi `ContentView.jsx → GEMINI_MODELS` dizisinde.
