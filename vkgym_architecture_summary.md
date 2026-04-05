# VK-Gym Alışkanlık & Fitness Takip Uygulaması (Mimari ve Özellik Yapısı)

Bu doküman, uygulamanın teknik altyapısını, veri akışını, mevcut arayüz bileşenlerini ve hesaplama mantığını diğer yapay zekalara açıklamak amacıyla oluşturulmuştur.

## 1. Teknolojiler
- **Framework:** React 19 (Vite ile oluşturulmuş)
- **Stil Yönetimi:** Vanilla CSS (Tailwind kullanılmıyor, özel `index.css` ile Glassmorphism ve Dark neon (yeşil siyah) tema tasarımı).
- **Veritabanı:** Tarayıcı tabanlı `localStorage`. API veya harici sunucu bağımlılığı yok, tamamen yerel.
- **Ekstra Kütüphaneler:** `date-fns` (Zaman hesaplamaları için), `lucide-react` (İkonlar için).

## 2. LocalStorage Veri Yapısı
Veriler `vkgym_data` anahtarı ile bir JSON objesi olarak tutulur.
```json
{
  "startDate": "2026-03-23",
  "days": {
     "2026-04-05": { 
       "w": 75.50,          // O günkü kilo değeri (veya girilmediyse null)
       "c": [1,0,1,...],    // 12 adet rutin görevinin check durumu (0 veya 1)
       "m": ["Chest", "Core"] // O gün çalışılan kas grupları dizisi
     }
  }
}
```

## 3. Günlük Rutin & Puanlama Sistemi (Scoring Logic)
Kullanıcının her gün yapması beklenen **12 maddelik** bir alışkanlık listesi vardır. Veriler `constants.js` dosyasından okunur. Maddeler iki gruba ayrılmıştır:

1. **Sabit/Temel Rutinler (9 Madde - Her gün zorunlu):** Kahvaltı, Ana Öğün, Akşam Yemeği, Gece Öğünü, Su (2 Lt), Kreatin, Uyku (7+), Karın (Kas), Adım/Kardiyo.
2. **Antrenman Şartlı Rutinler (3 Madde - Esnek):** Whey, Antrenman, Ağırlık Artışı.

**Puanlama Algoritması:**
- Kullanıcının haftada **4 ila 5 antrenman** yapma hedefi vardır.
- **Eğer o gün "Antrenman" tiki atıldıysa:** Puan hesaplanırken tüm 12 madde baz alınır. `(Yapılanlar / 12) * 100` oranında puan çıkar.
- **Eğer o gün "Antrenman" tiki YOKSA (Dinlenme günüyse):** Puan hesaplanırken **sadece 9 Sabit Rutin** baz alınır. O antrenman harici günlerin alabileceği maksimum tavan puan ise kullanıcının o *hafta boyunca kaç gün antrenman yaptığına* bağlanır.
  - O hafta 5 antrenman yapıldıysa: Dinlenme günlerinde maksimum 100 puan alınabilir.
  - O hafta 4 antrenman yapıldıysa: Maksimum 90 puan (ufak kota kesintisi).
  - 4'ten az ise: Maksimum 70 puan olarak kısıtlanır.

## 4. Kullanıcı Arayüzü (UI) Yapısı
Uygulama `App.jsx` üzerinde birbiriyle iletişim halinde olan bileşenlerden (components) oluşur. Tüm akışta "Seçili Tarih" (`selectedDateStr`) merkeze alınır.

### A. Bottom Navigation (Alt Yönlendirme)
Sayfanın en altında `lucide-react` destekli 5 bölmeli bir bar bulunur.
- **Habit:** Ana modül (Aşağıdaki modüller burada çalışır).
- **To-Do:** Prototip aşamasında boş bekleyen modül.
- Diğer eklentiler (3. 4. ve 5. sekmeler) planlama için beklemektedir.

### B. Header Component
- Seçili haftanın ismini ("23 - 29 Mart Haftası") ve haftanın günlerini barındırır.
- Ok işaretleriyle ileri/geri haftalara geçiş sağlanır (gelecek haftalara geçiş blokelidir).
- Her günün kendi başarı puanına (`calculateDayScore` fonksiyonundan dönen 0-100 değere) göre yuvarlak `svg` formatında yeşil ilerleme - progress barları vardır.

### C. DailyView Component
O an seçilen günün (selectedDateStr) veri girişi alanıdır.
1. **Kilo Girişi:** Slider ile (varsayılan kilo 75 veya en son girilen veri baz alınarak) sağa sola çekilebilir. Kilo yazısına tıklandığında pop-up (Modal) açılır ve manuel kilo (`type="number"`) girilebilir.
2. **Görevler Listesi (Checkboxes):** Tıklandığı an `updateCheck` ile veritabanına işler.
3. **Kas Pop-up'ı:** "Antrenman" (8. indeks) görevine tik atıldığı anda orta ekranda Modal açılır. Kullanıcıya "Chest, Back, Biceps, Triceps, Core, Legs" arasından seçim yaptırılır ve günün `dayData.m` alanına (çalışılan bölgeler array olarak) kaydedilir. Bu işlem sırasında `public` klasöründeki ikonlar gösterilir.

### D. WeeklyReport Component
Seçili haftanın genel dökümünü ve geri bildirimlerini yapar.
- **İstatistikler:** Haftanın ortalama gün puanı, Ortalama kilosu ve toplam antrenman sayısını listeler.
- **Geri Bildirim (Feedback):** Geçen haftanın ortalama kilosu ile bu haftanınki karşılaştırılır. Değişim değerine bağlı olarak (`weightDiff`); Kilo Kaybı (Kırmızı), Düşük (Sarı), İyi, Çok İyi (Neon Yeşil) veya Fazla Hızlı (Kırmızı) gibi sistem dönüşleri yapar.
- **Haftalık Kas Raporu:** Kullanıcının antrenmanlara girerek kaydettiği tüm kas dizileri bir havuzda toplanır. Sadece etiket sistemiyle (Badge/Pills tasarımıyla) o hafta çalışan vücut bölümleri alt kısımda listelenir. *(Not: İleriye dönük olarak buraya bir SVG vücut ısı haritası - Heatmap konması planlanmaktadır, kodda bunun altyapısı mevcuttur).*

## 5. Mevcut Durum & Gelecek Planlama İhtiyaçları
- Temel mimari, puan sistemi ve kayıt mekanizmaları stabil şekilde çalışmaktadır.
- Şu anda "Bottom Navigation" kullanılarak uygulamaya rotalama mekanizması eklenmiştir ancak **To-Do bölümü ve yan sekmeler** boştur. Yeni verilecek komutların burayı geliştirmesi beklenebilir.
- WeeklyReport tarafındaki vücut illüstrasyonunun SVG kodlaması yeni verilecek vizyon doğrultusunda güncellenmeye açıktır.
