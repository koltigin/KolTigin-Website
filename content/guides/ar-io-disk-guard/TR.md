---
slug: ar-io-disk-guard
date: 2026-11-17
---

# AR.IO Disk Guard

AR.IO Disk Guard, AR.IO Core sunucularında boş disk alanını otomatik olarak koruyan bir araçtır.

## Hızlı kurulum

AR.IO sunucunuza SSH ile bağlandıktan sonra aşağıdaki komutu sunucunun terminalinde çalıştırın. Script doğrudan KolTigin.xyz üzerinden indirilir, dil seçimini yaptırır, ilk kontrolü gerçekleştirir ve otomatik korumayı kurar.

```bash
curl -fsSL https://koltigin.xyz/downloads/ario/ario-disk-guard.sh -o /root/ario-disk-guard.sh && chmod 700 /root/ario-disk-guard.sh && bash /root/ario-disk-guard.sh
```

Dil ekranında Türkçe için `1` seçin. Ardından otomatik korumayı etkinleştirmek için ekranda gösterilen onay kelimesini yazın.

## Ne yapar?

Araç, disk kapasitesini otomatik algılar ve diskin en az yarısını boş tutmayı hedefler. İlk kontrolün ardından arka planda her 15 dakikada bir çalışır.

Boş alan hedefin altına düştüğünde yalnızca eski AR.IO cache dosyalarını temizler. Hedefe ulaştığında işlem durur. Kurulumdan sonra rutin manuel temizlik veya ek ayar gerekmez.

## Korunan veriler

AR.IO Disk Guard yalnızca doğrulanmış AR.IO cache dizininde işlem yapar.

Şu veriler silinmez veya değiştirilmez:

- SQLite veritabanları
- Redis verileri
- Docker volume’leri
- Diğer node’lar ve projeler
- AR.IO cache dizini dışındaki dosyalar

Temizlik gerektiğinde AR.IO Core geçici olarak durdurulur ve işlem tamamlandığında otomatik olarak yeniden başlatılır.

## Durum ve kayıtlar

Boş alanı, zamanlayıcı durumunu ve son kayıtları görmek için:

```bash
bash /root/ario-disk-guard.sh --status
```

Bir kontrol tamamlandıktan sonra servisin kapalı görünmesi normaldir. Zamanlayıcı aracı 15 dakikada bir çalıştırır; işini bitirdiğinde görev kapanır.

## Kaldırma

AR.IO Disk Guard zamanlayıcısını ve script dosyalarını kaldırmak için:

```bash
bash /root/ario-disk-guard.sh --uninstall
```

Kaldırma işlemi AR.IO verilerini, cache dosyalarını veya Docker container’larını silmez.

