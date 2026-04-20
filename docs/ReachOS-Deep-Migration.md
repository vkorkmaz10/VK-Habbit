# ReachOS Derin Migration Planı (v3.0 Parite)

## Hedef

Mevcut 10 kurallı, 0-tabanlı skorlama yerine **AytuncYildizli/reach-optimizer (MIT) v3.0** modeline birebir geç. Aynı tweet'in skoru bizim PWA'da ve eklentide ±5 puan içinde aynı çıksın.

## Kapsam Kararları (onaylı)

| # | Karar |
|---|---|
| 1 | Doğrudan port — kural dosyaları TS→JS (lisans MIT) |
| 2 | Skorlama Claude API ile (yeni `vkgym_anthropic_key`) — Gemini sadece içerik üretir |
| 3 | Reach Forecast var (followers + score + media + zaman) |
| 4 | Self-learning **atla** (browser eklentisi olmadan X metrik çekmek mümkün değil) |
| 5 | UI: bar breakdown (Hook / Yapı / Etkileşim / Cezalar / Bonuslar) — eklenti tarzı |
| 6 | Volkan persona öncelikli; boost'ta hedging gibi Volkan-imzası kurallar whitelist |

## Yeni Skorlama Modeli (v3.0)

```
score = clamp(
  baseScore (30)
  + hook    (0..+30)
  + structure (0..+20)
  + engagement (0..+30)
  - penalty (0..-55)
  + bonus   (0..+15),
  0, 100
)
```

Tier eşikleri:
- 0-20  → Critical (Don't Post)
- 21-40 → Below Average
- 41-60 → Average
- 61-79 → Strong
- 80+   → Exceptional

## Dosya Yapısı

### Yeni dosyalar

```
src/engine/reach/
  rules/
    hook-rules.js              # 5 temel hook kuralı (port)
    advanced-hook-rules.js     # 7 ileri hook (port)
    structure-rules.js         # 5 yapı kuralı (port)
    engagement-rules.js        # 2 CTA/bookmark (port)
    penalty-rules.js           # 2 bait/wall (port)
    ai-detection-rules.js      # 4 slop/AI (port + Claude verify)
    quality-signal-rules.js    # 3 sentiment/readability (port)
    reply-potential-rules.js   # 7 choice/contrast (port)
  config/
    weights.json               # v3.0 ağırlıkları (port)
  scoreEngine.js               # rule loop + tier hesabı
  forecast.js                  # reach forecast formülü
  index.js                     # public API: scoreTweet, buildBoostPrompt, forecastReach
  claude.js                    # Anthropic API wrapper (sadece skorlamaya destek)
```

### Değiştirilecek

- `src/engine/reachOS.js` → ince shim, yeni `engine/reach/index.js`'e proxy
- `src/components/ReachScoreBadge.jsx` → 5 bar (Hook/Yapı/Etkileşim/Cezalar/Bonuslar) + forecast bloğu + öneriler listesi
- `src/components/ContentView.jsx` → live re-score Claude opsiyonel (debounce 800ms), forecast input (followers)
- `src/utils/storage.js` → `vkgym_anthropic_key`, `vkgym_x_followers` getter/setter
- `src/index.css` → genişletilmiş badge + bar stilleri
- `src/config/reachos_rules.js` → DEPRECATED (sil veya legacy klasöre taşı)
- Ayarlar sekmesi (App.jsx veya yeni `SettingsView.jsx` — şimdiki yapıya bakacağım) → Anthropic key + followers input

### Cloudflare Function

`functions/api/claude-score.js` (yeni) — Anthropic API'yi proxy'le, key client'tan gelir, server'a leak olmaz.

## Volkan Persona × Reach Çatışma Yönetimi

### Whitelist (skor düşse de boost'a girmez)
- `penalty-hedging-language` ("bana göre", "nacizane")
- `penalty-combative-tone` (Viral stilde gerekli)
- `bonus-first-person-voice` (zaten Volkan tarzı, otomatik geçer)

### Boost prompt mantığı
```
1. scoreTweet() → tüm breakdown
2. failingRules.filter(r => !VOLKAN_WHITELIST.includes(r.id))
3. Sadece kalanların boostInstruction'larını Gemini'ye gönder
4. Gemini system prompt: VOLKAN_BASE + REACHOS_DIRECTIVES (mevcut)
```

## Reach Forecast Formülü

Repo'dan port (extension'ın `forecast-engine.ts` dosyası):
```
baseReach = followers × baselineCTR (0.10)
scoreMultiplier = 0.5 + (score / 100) × 1.5    // 0.5x - 2x arası
mediaMultiplier = hasMedia ? 2.0 : 1.0
timeMultiplier = isPeakHour(UTC) ? 1.3 : 1.0

forecast = baseReach × scoreMultiplier × mediaMultiplier × timeMultiplier
range = [forecast × 0.55, forecast × 1.45]
```

What-if scenarios:
- Add image → forecast × 2.0
- Post at peak time → forecast × 1.48
- Align with trend → forecast × 1.16
- All combined → forecast × 2.34

## UI: Yeni Badge

```
┌───────────────────────────────────────────┐
│  REACH 36/100         [Düzelt] [Geri Al] │
│  Below Average                            │
│                                           │
│  Hook        ░░░░░░░░░░  +0              │
│  Yapı        ░░░░░░░░░░  +0              │
│  Etkileşim   ████░░░░░░  +8              │
│  Cezalar     █░░░░░░░░░  -2              │
│  Bonuslar    ░░░░░░░░░░  +0              │
│                                           │
│  TAHMİN: 122 (67-177)  ▼ 0.6x ortalama   │
│                                           │
│  ÖNERİLER:                                │
│  • Hook çok uzun — 120 karakter altı yap  │
│  • CTA tetiklendi ✓                       │
│  • Görsel eklersen +39%                   │
└───────────────────────────────────────────┘
```

## Uygulama Sırası

1. **Port: rules engine** (~6 dosya, ~350 satır)
   - 9 rule dosyasını TS→JS çevir
   - weights.json kopyala
   - scoreEngine.js: rule loop + clamp + tier
   - Birim test: README'deki "Tom Lee tweet'i" senin gördüğün 36 ± 3 çıkmalı

2. **Forecast modülü** (~50 satır)
   - forecast.js: formül + what-if
   - Followers input localStorage (`vkgym_x_followers`)

3. **Claude entegrasyonu** (~80 satır)
   - claude.js wrapper (Anthropic Messages API)
   - claude-score.js Cloudflare Function (proxy + CORS)
   - Slop verify, hook 6-dim — opsiyonel; key yoksa skip
   - Ayarlar UI: Anthropic key input

4. **Volkan whitelist + boost güncellemesi**
   - VOLKAN_WHITELIST sabiti
   - buildBoostPrompt filter mantığı

5. **UI yenisi**
   - ReachScoreBadge: 5 bar + forecast + öneriler listesi
   - CSS: bar dolgusu, renk skalası
   - Live re-score (mevcut akış korunur, sadece skor formülü değişir)

6. **Eski kodu temizle**
   - `src/config/reachos_rules.js` sil
   - `src/engine/reachOS.js` ince shim'e indir

7. **Architecture.md güncelle**

## Verification

1. Senin paylaştığın "Tom Lee tweet"ini aynısı ile skorla → **36 ± 5** çıkmalı (eklenti = 36)
2. "Sence Bitcoin neden çakıldı? 👇" → hook +25, CTA +15, kısa, slop yok → **70-80**
3. "delve into the multifaceted tapestry of crypto markets" → AI slop maxed → **0-15**
4. Forecast: 1000 follower + score 70 + image → ~233 reach tahmini
5. Boost akışı: hedging içeren tweet'in skoru düşse de "bana göre" boost'a girmez (Volkan korunur)
6. Build + lint clean
7. Mobil test: badge mobile'da scroll edilebilir/okunabilir

## Token / Para Maliyeti

- Skorlama 100% client-side regex — **0 token**
- Claude verify (opsiyonel): tweet başına ~500 input + 100 output token = **~$0.002/tweet** (Sonnet 4.5)
- Auto-optimize 5 round (opsiyonel): **~$0.01/tweet**
- Forecast: 0 token (formül)

Toplam: günde 10 tweet boost + verify → **~$0.10/gün**

## Süre Tahmini

- 1-2: 90 dk
- 3: 60 dk
- 4: 20 dk
- 5: 60 dk
- 6-7: 30 dk

**Toplam: ~4.5 saat** (kesintisiz). Sen "başla" deyince ardışık execute ederim.

## Risk

- **Türkçe slop detection:** repo İngilizce slop pattern'leri var. Türkçe için listeyi genişletmem gerekecek (mevcut "delve, leverage" gibi maddeleri Türkçe karşılıkları ile). Bu kısım için Volkan tarzına aykırı kelime listesi yapacağım: "söylenebilir ki", "değerlendirildiğinde", "bilindiği üzere" vb.
- **Claude rate limit:** debounce 800ms + cache (aynı text yeniden çağırma)
- **Mobil performans:** 36 regex × her tuş = ~5ms toplam, sorun olmaz

---

**Onay bekliyorum:** "başla" dersen 1→7 sırayla execute, build + lint, sonra commit/push onayı isteyeceğim.
