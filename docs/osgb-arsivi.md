# PKTakip — Modül yapısı ve OSGB Arşivi (tasarım kararları)

Durum: tasarım aşaması, kod yazılmadı. Kararlar 8 Ekim 2026'da kullanıcıyla birlikte alındı.

## İsim
- Ürün adı şimdilik **PKTakip** kalır. "Uzman Takip" adı konuşuldu, değişiklik ertelendi.

## Modüller
- Uygulama modüllerden oluşur; **her modülün kendi Genel Bakış'ı** vardır. *(10 Ekim: yeniden değerlendiriliyor; aşağıdaki "Açık konu"ya bakın.)*
- **Fiyatlandırma (10 Ekim 2026'da değişti):** Modüller ayrı satılmaz. OSGB Arşivi **aynı pakette, aynı kredi** ile çalışır; fiyatlar aynıdır.
- Kapalı modül menüde görünmez.

> **Açık konu (10 Ekim):** Her modülün altına ayrı Genel Bakış ve Türkiye haritası koymak tekrar olur. Önerilen: tek, ortak bir Genel Bakış (harita + özet + yapılacaklar); bugünkü Genel Bakış'ın periyodik kontrole özel sekmeleri Durum Raporu'na taşınır; arşivin karşılığı "Arşiv Durumu" olur. Henüz onaylanmadı.

```
▾ Periyodik Kontrol
    Genel Bakış   (bugünkü)
    Ekipmanlar
    Tesisatlar
    Raporlar
▸ OSGB Arşivi     (yalnızca OSGB hesapları)
    Genel Bakış
    Arşiv
    Çalışanlar
────────────
İşyerleri         (ortak)
Ayarlar           (ortak)
```

- Modül başlıkları açılır kapanır.
- İşyeri üstteki menüden seçilir.

## Fiyatlandırma ilkeleri (10 Ekim 2026, uygulandı)
- **Tek limit: işyeri.** Her `location_business_entity` kaydı bir işyeri; pasif işyeri ya da pasif lokasyon sayılmaz. Bütün modüller aynı limiti kullanır; modüllere ayrı limit konmaz.
- **Ekipman, çalışan ve kullanıcı sayısı sınırsız.** Kullanıcı başı ücret yok (rakiplerin çoğu kullanıcı başı alıyor; arşivde tek operasyon kullanıcısıyla delinebildiği için seçilmedi).
- **Kredi** yalnızca yapay zeka okumasında düşer; elle kullanım kredisiz.
- Limitler (fiyatlar değişmedi): Mini 10, Standart 25, Plus sınırsız; OSGB Başlangıç 75, Pro sınırsız; kurumsal paketler sınırsız; ücretsiz deneme 3 işyeri. Başlangıç 75: rakiplerde 1.999 TL ≈ 2–3 uzman kullanıcısı, uzman başına 20–25 işyeri varsayımı, +%10.

## OSGB Arşivi
**Birim:** İşyeri (SGK sicili). Her işyerinin kendi arşivi vardır.

**Belge türleri:** Yalnızca yasal zorunlu olanlar (İSG Hizmetleri Yönetmeliği Md. 13/2).
- Yeni tür şimdilik eklenmez.
- Yapı ileride eklenebilecek şekilde kurulur: süper adminin ortak türleri ve OSGB'nin kendine özel türleri.

| Belge | Eksik sayılır |
|---|---|
| Onaylı defter suretleri | Hiç suret yoksa **"Eksik"**. Suret varsa sözleşme başlangıcından itibaren ay şeridi gösterilir ve yüklenmeyen aylar görünür ("2 ay yüklenmedi"). |
| Yıllık çalışma planı | O yılın planı yoksa. Her yıl ayrı kalemdir. |
| Yıllık değerlendirme raporu | O yılın raporu yoksa. Her yıl ayrı kalemdir. |
| İSG eğitim kaydı (çalışan başına) | Aktif çalışanın hiç eğitim kaydı yoksa. Süre dolması eksik sayılmaz. |

**Belgeler**
- Toplu olarak, seçili işyerinin Arşiv sayfasından yüklenir.
- **Elle yükleme her zaman vardır ve kredi düşmez** (10 Ekim 2026): uzman belge türünü ve tarihini kendisi seçer. Gerekçe: ödemeye razı OSGB sahibi "yapay zekasız" program istedi.
- **Yapay zeka okuması isteğe bağlıdır ve kredi düşer:** her belgenin türünü, tarihini ve tutanaklardaki çalışanları bulur. Uzman onaylar; onaysız hiçbir şey kaydedilmez.
- Aynı belge üst üste eklenir. **Belge tarihine göre en son olan geçerlidir**; eskiler geçmişte kalır.

**Çalışanlar**
- Çalışanlar eğitim katılım tutanaklarından alınır.
- Ad soyadla tanınır. Tutanakta TC no varsa o da okunur ve eşleştirmede kullanılır.
- Çalışan başına tutulan belge şimdilik yalnızca İSG eğitim kaydıdır.

**Sil / Pasife al**
- **Sil:** Belge ya da çalışan silinir. Uzman kendisi siler, onay gerekmez.
- **Pasife al:** Çalışan görünmez.

**Kim yükler**
- Yönetici ve operasyon her işyerine yükler.
- Uzman yalnızca atandığı işyerlerine yükler.

**Sözleşme**
- Başlangıç ve bitiş tarihleri ortak İşyeri formunda girilir. Bu alanlar yalnızca Arşiv modülü açık OSGB hesaplarında görünür.
- Sözleşme bitince işyerinin arşivi **klasörlü ZIP** olarak indirilir; ardından işyeri pasif olur.
- ZIP'in içeriği: belge türü ve yıla göre klasörler, çalışan eğitimleri kişi kişi, Excel belge listesi.

**Sayfalar.** İşyeri seçilmemişse kapsamdaki tüm işyerleri gösterilir.
- **Genel Bakış:**
  - özet sayılar,
  - işyeri durum tablosu (en çok eksiği olan işyeri üstte; satıra tıklayınca o işyeri seçilir ve Arşiv açılır),
  - sözleşmesi biten ve yaklaşan işyerleri,
  - son yüklenen belgeler.
- **Arşiv:** Defter suretleri, çalışma planları ve değerlendirme raporları, geçmişleriyle birlikte.
- **Çalışanlar:** Aktif çalışanlar ve eğitim kayıtları.

**Hatırlatma:** Yönetici ve uzmanlara haftalık "şu işyerlerinde şu belgeler eksik" e-postası gider.

## Arka plan
- Bir OSGB sahibi "OSGB arşivini takip eden, yapay zekasız bir programa ayda 2.000 TL veririm" dedi.
- Diğer OSGB'ler ve PK firmaları PKTakip'in mevcut hâli için "satmaz" dedi.
