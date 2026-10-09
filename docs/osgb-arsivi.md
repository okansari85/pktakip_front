# PKTakip — Modül yapısı ve OSGB Arşivi (tasarım kararları)

Durum: tasarım aşaması, kod yazılmadı. Kararlar 8 Ekim 2026'da kullanıcıyla birlikte alındı.

## İsim
- Ürün adı şimdilik **PKTakip** kalır. "Uzman Takip" adı konuşuldu, değişiklik ertelendi.

## Modüller
- Uygulama modüllerden oluşur; **her modülün kendi Genel Bakış'ı** vardır.
- Modüller ayrı ayrı satılır. Müşteri kendisi satın alır; süper admin de elle açıp kapatabilir.
- Kapalı modül menüde görünmez.

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
- Yapay zeka her belgenin türünü, tarihini ve tutanaklardaki çalışanları bulur. Uzman onaylar; onaysız hiçbir şey kaydedilmez.
- Yapay zeka okuması **kredi ile** yapılır.
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
