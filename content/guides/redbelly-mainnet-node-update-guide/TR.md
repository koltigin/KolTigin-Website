---
date: 2026-09-11
---

# Redbelly Mainnet Node Güncelleme Rehberi

Bu rehber, yeni bir Redbelly Mainnet node sürümü yayınlandığında mevcut node'un güncel installer kullanılarak nasıl güncelleneceğini anlatır.

Normal bir güncellemede mevcut blockchain database'inin korunması önemlidir. Bu nedenle installer sırasında database ile ilgili soruya verilecek cevaba özellikle dikkat edin.

## 1. Güncel Installer'ı İndirin

Redbelly Node Operator Support Portal'a giriş yapın:

https://redbelly.atlassian.net/servicedesk/customer/portal/13/article/1960869898

Yayınlanan en güncel Mainnet installer dosyasını indirin.

Örneğin:

```text
rbn-installer-mainnet-v1.3.16.run
```

Bu rehberde sürüm numarası:

```text
rbn-installer-mainnet-vX.X.X.run
```

şeklinde gösterilecektir.

`X.X.X` yerine indirdiğiniz güncel Mainnet sürümünü kullanın.

## 2. Yeni Installer'ı Sunucuya Yükleyin

Sunucunuza SCP, SFTP veya tercih ettiğiniz başka bir yöntemle bağlanın.

Eski installer dosyasını artık kullanmayacaksanız silebilirsiniz.

Örneğin:

```bash
rm rbn-installer.run
```

veya eski installer sürüm numarası içeriyorsa:

```bash
rm rbn-installer-mainnet-vOLD.VERSION.run
```

> Bu işlem yalnızca eski installer dosyasını siler. Redbelly node database'ini veya blockchain verilerini silmeyin.

İndirdiğiniz yeni installer dosyasını sunucunuza yükleyin.

Örneğin:

```text
rbn-installer-mainnet-vX.X.X.run
```

## 3. Güncellemeyi Başlatın

Yeni installer dosyasına çalıştırma izni verin:

```bash
chmod +x rbn-installer-mainnet-vX.X.X.run
```

Ardından installer'ı çalıştırın:

```bash
sudo ./rbn-installer-mainnet-vX.X.X.run
```

Installer mevcut Redbelly kurulumunu algılayarak güncelleme işlemini başlatacaktır.

## 4. Güncelleme Sırasında Önemli Sorular

Güncelleme sırasında özellikle iki soruya dikkat edin.

### UDP Status Server

Installer UDP Status Server'ı etkinleştirmek isteyip istemediğinizi sorabilir:

```text
Do you want to enable the UDP status server? (y/n)
```

Cevap:

```text
y
```

UDP Status Server node durumunun izlenmesini sağlar ve monitoring sistemleri, Telegram bot ve benzeri araçlar tarafından kullanılabilir.

### Database — Önemli

Installer mevcut database'i algıladığında aşağıdaki soruyu soracaktır:

```text
Database detected, do you want to clear the locally stored data and re-download the chain
```

Normal bir node güncellemesinde cevap:

```text
n
```

olmalıdır.

Seçeneklerin anlamı:

```text
y → Mevcut database silinir ve blockchain verileri yeniden indirilir.
n → Mevcut database korunur.
```

> **ÖNEMLİ:** Normal bir node güncellemesinde mevcut senkronize database'i korumak için `n` seçin.

`y` seçilmesi mevcut database'in temizlenmesine ve blockchain verilerinin yeniden indirilmesine neden olur. Bu nedenle database'i özellikle sıfırlamak istemediğiniz sürece `y` seçmeyin.

## 5. Güncelleme Sonrası Sürüm Kontrolü

Installer tamamlandıktan sonra kullandığınız installer sürümünü kontrol edin:

```bash
sudo ./rbn-installer-mainnet-vX.X.X.run -- --version
```

## 6. Node'un Çalıştığını Kontrol Edin

Güncelleme tamamlandıktan sonra Redbelly prosesini kontrol edin:

```bash
pgrep rbbc
```

Ardından servis durumunu kontrol edin:

```bash
sudo systemctl status redbelly.service
```

Beklenen durum:

```text
Active: active (running)
```

Servis çalışıyorsa güncelleme sonrasında node yeniden aktif durumdadır.

## 7. Logları Kontrol Edin

Canlı Redbelly loglarını takip etmek için:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs.log
```

Hata loglarını kontrol etmek için:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs_error.log
```

Systemd servis loglarını görüntülemek için:

```bash
journalctl -u redbelly.service
```

Canlı log ekranından çıkmak için:

```text
Ctrl + C
```

kullanabilirsiniz.

## Kısa Güncelleme Özeti

```text
1. Güncel Mainnet installer'ı indirin.
2. Installer'ı sunucuya yükleyin.
3. chmod +x rbn-installer-mainnet-vX.X.X.run
4. sudo ./rbn-installer-mainnet-vX.X.X.run
5. UDP Status Server → y
6. Database clear / re-download → n
7. Installer sürümünü kontrol edin.
8. redbelly.service durumunu kontrol edin.
9. Node loglarını kontrol edin.
```

> **Hatırlatma:** Güncelleme sırasında en kritik seçim database sorusudur. Normal bir güncellemede mevcut blockchain verilerini korumak için **`n`** seçin.

