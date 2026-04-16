/**
 * VSE Prompt Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 * Tüm sabit prompt blokları ve stil konfigürasyonu burada yaşar.
 * vse.js sadece composition (birleştirme) mantığını tutar.
 *
 * Persona'yı güncellemek için: src/config/volkan_dev_persona.json dosyasını düzenle.
 * Yeni stil eklemek için: STYLE_CONFIG'e yeni bir anahtar ekle.
 */

import persona from './volkan_dev_persona.json' with { type: 'json' };

// ─── Persona → Base Identity String ─────────────────────────────────────────

function buildVolkanBase(p) {
  const keywords = p.global_dna.keywords.join(', ');

  return `Sen ${p.identity.name} (${p.identity.handle}) için içerik üretiyorsun.

VOLKAN KİMDİR:
- 2017'den beri aktif kripto yatırımcısı ve trader
- Altcointurk kurucu ortağı, KriptoCuma organizatörü
- Borsa İstanbul çalışanı, programcı, girişimci

VOLKAN'IN SESİ:
- ${p.global_dna.tone}
- ${p.twitter_mode.rules}
- Kapanış imzası: "${p.twitter_mode.signature}"
- Doğal Türkçe ifadeler: ${keywords}

VOLKAN FİLTRESİ – BUNLARI KALDIR:
- Kesin yön tahmini ("Bu coin 100x yapar!")
- Abartı / hype dili — ${p.global_dna.forbidden}
- Clickbait başlıklar
- ALL CAPS sensasyonalizm
- Coin fiyat tabloları

VOLKAN FİLTRESİ – BUNLARI UYGULA:
- Her zaman opsiyon bırak, senaryo sun
- Riski açıkça belirt
- Sade anlat, basit cümleler kur
- Gerekirse kişisel yorum ekle ("bana göre", "nacizane")
- Finansal tavsiye çerçevesi: "kendi araştırmanı yap"`;
}

export const VOLKAN_BASE = buildVolkanBase(persona);

// ─── Classification Instruction ─────────────────────────────────────────────

export const CLASSIFICATION_BLOCK = `
[SINIFLANDIRMA]: Önce haberi zihninde sınıflandır:
- Kategori: macro (ETF, FED, regülasyon) | project (ortaklık, lansman) | onchain (miner, whale, veri) | sentiment (hype, narrativ) | other
- Etki: high | medium | low
- Piyasa yönelimi: bullish | bearish | neutral | mixed
Bu sınıflandırmayı içeriğe yansıt — ton buradan doğsun. Sınıflandırmayı yazıya dökmene gerek yok, sadece kullan.`;

// ─── Style Configuration ─────────────────────────────────────────────────────
//
// Her stil 3 parametre taşır:
//   sharpness : 0.0–1.0  (keskinlik / provokasyon seviyesi)
//   emotion   : 0.0–1.0  (duygusal yoğunluk)
//   toneDesc  : LLM'e iletilen yazım talimatı
//
// Yeni stil eklemek için bu objeye yeni bir anahtar ekle.
// vse.js'de başka bir değişiklik gerekmez.

export const STYLE_CONFIG = {
  prime: {
    label: 'Dengeli',
    description: 'Sakin, analitik, risk dengeli',
    tone: 'balanced',
    sharpness: 0.6,
    emotion: 0.4,
    toneDesc: 'Dengeli ve sakin bir ton kullan. Ne abartılı iyimser ne de gereksiz karamsar. Her iki tarafı da göster.',
  },
  viral: {
    label: 'Viral',
    description: 'Hafif sert, dikkat çekici, keskin',
    tone: 'slightly provocative',
    sharpness: 0.8,
    emotion: 0.6,
    toneDesc: 'Hafif sert, dikkat çekici ve keskin bir dil kullan. Provoke edici ama manipülatif değil. Okuyucuyu durduracak bir açılış yap.',
  },
  clean: {
    label: 'Sade',
    description: 'Net, profesyonel, az süslü',
    tone: 'professional',
    sharpness: 0.4,
    emotion: 0.2,
    toneDesc: 'Net, profesyonel ve sade bir dil kullan. Süslü ifade yok, direkt nokta. Gazeteci gibi yaz.',
  },
};
