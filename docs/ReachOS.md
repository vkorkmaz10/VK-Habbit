# ReachOS v3.0 — Kural & Mimari Dokümantasyonu

> X (Twitter) algoritmasına göre tweet'leri client-side skorlayan ve boost eden kural motoru.  
> Kaynak: `src/engine/reach/`

---

## Puanlama Sistemi

| Kategori   | Maks. Puan |
|------------|-----------|
| Baz puan   | +30       |
| Hook       | +30       |
| Yapı       | +20       |
| Etkileşim  | +30       |
| Bonus      | +15       |
| Ceza       | -55       |
| **Toplam** | **0–100** |

### Skor Seviyeleri

| Aralık  | Etiket       |
|---------|-------------|
| 0–20    | Critical     |
| 21–40   | Below Average|
| 41–60   | Average      |
| 61–79   | Strong       |
| 80–100  | Exceptional  |

---

## Kurallar

### 🪝 Hook Kuralları

| Kural ID | Açıklama | Puan |
|----------|----------|------|
| `hook-generic-pattern` | "let me explain", "şimdi anlatayım" gibi generik açılışlar | **-8** |
| `hook-length-check` | Hook ≤15 karakter (-3) · ≤80 karakter (+5) · ≤120 (+2) · >120 (-4) | **-4 / +5** |
| `hook-number-data` | Hook'ta sayı veya veri var ($100K, %40, 5 yıl) | **+8** |
| `hook-multi-sentence` | Hook satırında birden fazla cümle | **-3** |
| `hook-open-loop` | Satır `:`, `—`, `...` ile bitiyor | **+10** |
| `hook-contrarian-claim` | "overrated", "underrated", "yanlış biliniyor", "aksine" | **+7** |
| `hook-story-opener` | "Geçen hafta", "Dün", "3 yıl önce", "True story:" | **+6** |
| `hook-pattern-interrupt` | "Stop", "Never", "Bırak", "Asla", "Yapma" ile başlıyor | **+7** |
| `hook-bold-claim` | "The best", "No one", "Herkes", "En iyi" ile başlıyor | **+5** |
| `hook-list-promise` | "5 şey", "3 adım", "7 ders" gibi liste vaadi | **+6** |
| `hook-compound-quality` | 2+ hook sinyali aynı anda mevcut | **+7** |
| `hook-contrast-surprise` | "0'dan $1M'a", "herkes X der ama aslında Y" | **+6** |

---

### 🏗 Yapı Kuralları

| Kural ID | Açıklama | Puan |
|----------|----------|------|
| `structure-char-length` | <30 karakter (-5) · ≤70 (+2) · **71–110 sweet spot (+7)** · ≤200 (+5) · ≤280 (+4) · ≤560 (+2) · >560 single (-4) | **-6 / +7** |
| `penalty-hashtag-spam` | 3 veya daha fazla hashtag | **-6** |
| `penalty-emoji-spam` | 5 veya daha fazla emoji | **-3** |
| `structure-thread-length` | Thread: **5–8 tweet sweet spot (+6)** · ≤12 (+3) · <3 (-4) · >15 (-3) | **-4 / +6** |
| `structure-line-breaks` | 100+ karakter metinde satır boşluğu kullanımı | **+5** |
| `quality-readability` | Flesch-Kincaid: ≤8. sınıf (+4) · ≤10. sınıf (+1) · >10. sınıf (-3) | **-3 / +4** |

---

### 💬 Etkileşim Kuralları

| Kural ID | Açıklama | Puan |
|----------|----------|------|
| `engagement-cta-presence` | Soru / "sence" / "ne düşünüyorsun" (+8) · Retorik soru (-3) · CTA yok (-6) | **-6 / +8** |
| `engagement-bookmark-value` | "Adım", "nasıl", "rehber", "şablon", numaralı liste | **+8** |
| `engagement-choice-question` | "A mı B mi?", "Hangisi?", "Seç:" | **+10** |

---

### ⚠️ Ceza Kuralları

| Kural ID | Açıklama | Puan |
|----------|----------|------|
| `penalty-engagement-bait` | "Beğen eğer", "RT yap", "Takip et için" | **-12** |
| `penalty-text-wall` | 280+ karakter, satır boşluğu yok, thread değil | **-7** |
| `penalty-ai-slop-words` | "delve", "leverage", "nihayetinde", "paradigma" gibi AI kelimeler: 2+ (-7) / 4+ (-14) | **-14** |
| `penalty-ai-slop-structure` | "Furthermore", "Moreover", "Sonuç olarak" gibi yapısal AI kalıpları | **-8** |
| `penalty-stale-formula` | "Unpopular opinion:", "Hot take:", "Thread 🧵" | **-5** |
| `penalty-hedging-opener` | "Belki", "Sanırım", "Emin değilim", "Bana göre" ile başlıyor | **-5** |
| `penalty-combative-tone` | "Aptal", "Salak", "Kapa çeneni" vb. hakaret | **-10** |
| `penalty-dead-ending` | Soru veya açık döngü olmadan kapanıyor | **-4** |
| `penalty-hashtag-placement` | Tweet `#` ile başlıyor | **-4** |
| `penalty-all-caps-spam` | Kelimelerin %30'undan fazlası BÜYÜK HARF | **-4** |
| `penalty-grammar` | Dilbilgisi hatası başına -3 puan, maks. | **-9** |
| `penalty-link-external` | Dış link tweet içinde (X/Twitter linki hariç) | **-8** |

---

### ✨ Bonus Kuralları

| Kural ID | Açıklama | Puan |
|----------|----------|------|
| `bonus-first-person` | Tweet'te birinci tekil şahıs kullanımı | **+4** |
| `bonus-media-present` | Görsel / video eklenmiş | **+4** |
| `quality-sentiment-tone` | Yapıcı + pozitif ton (+5) · Pozitif (+3) · Negatif (-4) · Sinik (-5) | **-5 / +5** |

---

## Reach Tahmini (`forecast.js`)

```
Tahmini Erişim = Takipçi × 0.10 × SkorÇarpanı × MedyaÇarpanı × ZamanÇarpanı
Aralık: Tahmin ±45%
```

| Etken | Değer |
|-------|-------|
| Skor 0–40 | 0.5× |
| Skor 40–60 | 1.0× |
| Skor 60–80 | 1.5× |
| Skor 80+ | 2.0× |
| Görsel / Video | 2.0× |
| Peak saat (Sal–Cum, 09:00–14:00 UTC) | 1.3× |

---

## Volkan Persona Koruması

Boost akışında (Reach'i Artır butonu) aşağıdaki kurallar **otomatik düzeltilmez**. Volkan'ın sesine özgüdür:

| Kural | Neden Korunuyor |
|-------|----------------|
| `penalty-hedging-opener` | "bana göre", "nacizane" Volkan'ın karakteristik tonu |
| `penalty-combative-tone` | Viral tarzda bazen gerekli |
| `engagement-cta-presence` | Volkan'ın doğal CTA stili sistem promptta tanımlı |

Boost System Prompt olarak `buildTweetPrompt()` çıktısı (VSE persona + altın örnekler) kullanılır. Kullanıcı prompt'u sadece ihlal edilen kuralların `boostInstruction`'larını listeler.

---

## Dosya Yapısı

```
src/engine/reach/
├── index.js                  # Public API: scoreTweet(), buildBoostPrompt()
├── engine.js                 # ScoreEngine — kuralları çalıştırır, toplar
├── all-client-rules.js       # Tüm kuralları tek array'de toplar
├── forecast.js               # Erişim tahmini hesaplama
├── claude.js                 # Claude Sonnet ile AI skor (opsiyonel)
├── config/
│   └── weights.json          # Kategori ağırlıkları ve tier tanımları
└── rules/
    ├── hook-rules.js          # 5 hook kuralı
    ├── advanced-hook-rules.js # 7 gelişmiş hook kuralı
    ├── structure-rules.js     # 6 yapı kuralı
    ├── engagement-rules.js    # 2 etkileşim kuralı
    ├── penalty-rules.js       # 8 ceza kuralı
    ├── ai-detection-rules.js  # 3 AI tespit kuralı
    ├── quality-signal-rules.js# 4 kalite/bonus kuralı
    ├── reply-potential-rules.js# 3 yanıt potansiyeli kuralı
    └── link-detection.js      # 1 link kuralı
```

---

## Public API

```js
import { scoreTweet, buildBoostPrompt } from '../engine/reach';

// Skorlama
const { score, tier, breakdown } = scoreTweet(text, {
  hasMedia: true,   // görsel eklendiyse (default: false)
  isThread: false,  // thread modundaysa (default: false)
  threadLength: 7,  // thread tweet sayısı
});

// Boost prompt'u üret (sadece başarısız kurallar dahil edilir)
const boostPrompt = buildBoostPrompt(originalText, breakdown);
// → Gemini'ye gönderilecek user prompt metni
```

### `breakdown` objesi

```js
breakdown: [
  {
    ruleId: 'hook-generic-pattern',
    triggered: true,
    points: -8,
    severity: 'warning',      // 'critical' | 'warning' | 'positive' | 'info'
    suggestion: 'Genel kalıp hook — somut sayı, cesur iddia veya soruyla aç.',
  },
  ...
]
```

---

## Temel X Algoritma Gerçekleri (Kural Kaynakları)

| Sinyal | Etki |
|--------|------|
| Yanıt | Like'tan **27×** değerli |
| Bookmark | Like'tan **20×** değerli |
| Görsel | Erişimde **2×** boost |
| 3+ hashtag | Etkileşim **~%40** düşer |
| Dış link | Erişim **%30–50** düşer |
| Block/Report | **-148×** ile **-738×** like eşdeğeri |
| 71–110 karakter sweet spot | **%17** daha fazla etkileşim |
| Thread 5–8 tweet | **2.4×** etkileşim |
| Satır boşlukları | Okunabilirlik **%20–30** artar |
