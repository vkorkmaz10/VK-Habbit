# 𝕏 Score v1.0 — Algoritma Motoru Dokümantasyonu

> 2026 X algoritmasına göre tweet'leri client-side skorlayan motor.  
> Kaynak: `src/engine/xscore/`

---

## Puanlama Sistemi

| Kategori | Maks Puan | Algoritma Karşılığı |
|---|---|---|
| Baz | +20 | Başlangıç |
| **Konuşma** | +35 | Reply 13.5–27× · Yazar cevabı 75–150× |
| **Yayılım** | +25 | Retweet 20× · Quote 25× · Bookmark 10× |
| **Kalma Süresi** | +20 | Dwell time + Hook kalitesi |
| **Cezalar** | −50 | Reach öldüren sinyaller |
| **Toplam** | **0–100** | |

### Skor Seviyeleri

| Aralık | Etiket |
|---|---|
| 80–100 | Viral |
| 61–79 | Güçlü |
| 41–60 | Ortalama |
| 21–40 | Zayıf |
| 0–20 | Ölü |

---

## Kural Seti

### Konuşma (max +35)
| Kural ID | Puan |
|---|---|
| conv-choice-question | +15 |
| conv-direct-question | +10 |
| conv-contrarian | +8 |
| conv-open-question | +5 |
| conv-rhetorical | −5 |
| conv-dead-end | −10 |
| conv-engagement-bait | −15 |

### Yayılım (max +25)
| Kural ID | Puan |
|---|---|
| spread-bookmark-format | +12 |
| spread-shareable-claim | +8 |
| spread-media | +5 |
| spread-first-person | +3 |
| spread-stale-formula | −5 |
| spread-hashtag-spam | −6 |

### Kalma Süresi (max +20)
| Kural ID | Puan |
|---|---|
| dwell-open-loop | +8 |
| dwell-number-data | +6 |
| dwell-story-opener | +4 |
| dwell-line-breaks | +4 |
| dwell-char-length | −5/+4 |
| dwell-text-wall | −6 |
| dwell-generic-hook | −5 |

### Cezalar (max −50)
| Kural ID | Puan |
|---|---|
| pen-external-link | −15 |
| pen-ai-slop (4+) | −14 |
| pen-ai-slop (2-3) | −7 |
| pen-offensive | −12 |
| pen-ai-structure | −6 |
| pen-all-caps | −5 |
| pen-hashtag-start | −4 |
| pen-grammar | −9 maks |

---

## 2026 X Algoritma Ağırlıkları

| Sinyal | Ağırlık (Like = 1×) |
|---|---|
| Bookmark | 10× |
| Retweet | 20× |
| Quote Tweet | ~25× |
| Reply | 13.5–27× |
| Reply + Yazar Cevabı | 75–150× |
| Profile Click | 12× |
| Erken Etkileşim (ilk 30 dk) | ~1000× velocity |

---

## Dosya Yapısı

```
src/engine/xscore/
├── index.js
├── engine.js
├── all-rules.js
├── forecast.js
├── config/weights.json
└── rules/
    ├── conversation-rules.js
    ├── spread-rules.js
    ├── dwell-rules.js
    └── penalty-rules.js
```

## API

```js
import { scorePost, buildBoostPrompt } from '../engine/xscore';
const { score, tier, breakdown, suggestions } = scorePost(text, { hasMedia: true });
// breakdown: { conversation, spread, dwell, penalties }
// tier: 'viral' | 'strong' | 'average' | 'weak' | 'dead'
```
