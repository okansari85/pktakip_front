# CLAUDE.md

PKTakip uygulama önyüzü (Nuxt + PrimeVue 4.5 + Chart.js). Backend: `C:\Users\zanba\Desktop\taseron_managment` (canlı Taşeron uygulamasıyla ortak Laravel). Tanıtım sitesi: `C:\Users\zanba\Desktop\pktakip_landing`.

## Çalışma biçimi
- Yeni ekran/akışta önce tasarımı sade Türkçe ile anlat, açık onay al; sonra kod.
- Değiştireceğin bölümleri (dosya, fonksiyon, etki, dokunulmayanlar) önce listele; ekranda görünen adları kullan.
- Çok adımlı işte her sayfadan önce sor, bitince göster.
- Commit/push kullanıcıda.

## Arayüz kuralları
- Arayüz dili Türkçe.
- Önce PrimeVue'nun hazır bileşeni; grafik için Chart.js; yeni npm paketi ancak sorarak.
- Modallar dışarı tıklayınca kapanmaz (`.modal-backdrop` üzerinde `@click.self` yok); yalnızca X / İptal kapatır.
- İşlem başladığı yerden çıkar: form içinde "tür" toggle'ı yerine girişi ait olduğu satıra/karta koy.
- Rapordan (yapay zeka) gelen hiçbir değişiklik otomatik uygulanmaz; açık onay, varsayılan "mevcut kalsın".
- Yapay zeka çağrılarında otomatik yeniden deneme yok. 402 (kredi/limit) gelince dur ve mesajı göster.

## Hesaplar
- Bireysel uzman (`tenant_type=expert`) ekranları bitti; yeni davranışı osgb/corporate ile koşulla.
- Süper admin ekranları (`expert-super-admin`) diğer rollere görünmez.
- Backend'in çok kelimeli ilişki anahtarları snake_case gelir (`location_business_entity`).

## Backend
- Backend'de yalnızca yeni kod eklenir; mevcut metot/route değişmez (ayrıntı: backend `CLAUDE.md`).
- Laragon PHP 8.4: `/c/laragon/bin/php/php-8.4.12-nts-Win32-vs17-x64/php.exe artisan …`.
