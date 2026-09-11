---
date: 2026-09-11
---

# Redbelly Mainnet Telegram Monitoring Bot Kurulum Rehberi

Bu rehber, Redbelly Mainnet node'unuzu Telegram üzerinden otomatik olarak takip etmek için KolTigin Redbelly Monitor scriptinin kurulumunu açıklar.

Monitor belirlediğiniz aralıklarla node durumunu kontrol eder ve Telegram'a otomatik rapor gönderir.

Raporda şu bilgiler bulunur:

- Node senkronizasyon durumu
- `redbelly.service` durumu
- Mevcut rol: Governor / Candidate
- Sonraki turdaki rol
- Node block yüksekliği
- Redbelly Mainnet network block yüksekliği
- Block farkı
- Superblock
- Recovery durumu
- Redbelly node sürümü
- SSL sertifika durumu ve kalan süre
- CPU load
- RAM kullanımı
- Disk kullanımı

Kurulum systemd service ve timer kullanır. Cron yapılandırması gerekmez.

---

## 1. Telegram Bot Oluşturma

Telegram'da **@BotFather** hesabını açın.

Yeni bot oluşturmak için:

```text
/newbot
```

komutunu gönderin.

BotFather sizden:

1. Bot adı
2. Bot kullanıcı adı

isteyecektir.

Kullanıcı adı `bot` ile bitmelidir.

Örnek:

```text
My Redbelly Monitor
my_redbelly_monitor_bot
```

Bot oluşturulduktan sonra BotFather size bir **Bot Token** verecektir.

Örnek biçim:

```text
1234567890:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Bu token gizlidir. Başkalarıyla paylaşmayın.

---

## 2. Chat ID Alma

Yeni oluşturduğunuz Telegram botunu açın ve:

```text
/start
```

gönderin.

Ardından sunucunuzda aşağıdaki komutu çalıştırın.

`YOUR_BOT_TOKEN` bölümünü BotFather'ın verdiği token ile değiştirin:

```bash
curl -s "https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates" | jq
```

Çıktıda aşağıdakine benzer bölümü bulun:

```json
"chat": {
  "id": 123456789,
  "type": "private"
}
```

Buradaki:

```text
123456789
```

değeri sizin **Chat ID** değerinizdir.

> `result` boş görünüyorsa Telegram'da botunuza tekrar bir mesaj gönderin ve komutu yeniden çalıştırın.

---

## 3. Redbelly Monitor'ü İndirme ve Kurma

Root kullanıcısına geçin:

```bash
sudo -i
```

Aşağıdaki komutu tek parça halinde çalıştırın:

```bash
cd /root && \
curl -fsSL https://koltigin.xyz/downloads/redbelly/redbelly-monitor.sh -o redbelly-monitor.sh && \
chmod +x redbelly-monitor.sh && \
./redbelly-monitor.sh
```

Installer açıldığında önce dil seçimi görüntülenir:

```text
1) Türkçe
2) English

Dil / Language [1]:
```

Türkçe için:

```text
1
```

seçin.

Ardından installer aşağıdaki bilgileri isteyecektir:

```text
🤖 Telegram Bot Token:
💬 Telegram Chat ID:
🌐 Redbelly node alan adı (örn. node.example.com):
⏱ Kaç dakikada bir Telegram mesajı gönderilsin? [30]:
```

### Bot Token

BotFather'dan aldığınız token'ı girin.

### Chat ID

Önceki adımda öğrendiğiniz Chat ID değerini girin.

### Node alan adı

Redbelly node'unuz için kayıtlı alan adını girin.

Örnek:

```text
node.example.com
```

### Mesaj aralığı

Telegram durum raporunun kaç dakikada bir gönderileceğini belirleyin.

Varsayılan:

```text
30
```

dakikadır.

Değeri değiştirmek istemiyorsanız Enter tuşuna basabilirsiniz.

---

## 4. Telegram Bağlantı Testi

Installer önce Telegram Bot Token ve Chat ID bilgilerini test eder.

Başarılı olduğunda Telegram'a şu mesaj gelir:

```text
✅ Redbelly Telegram Monitor bağlantı testi başarılı.
```

Ardından installer monitor dosyasını, yapılandırmayı ve systemd timer'ı oluşturur.

Kurulum tamamlandığında ilk node raporu otomatik olarak gönderilir.

---

## 5. Telegram Node Raporu

Başarılı kurulumdan sonra Telegram'da buna benzer bir rapor görürsünüz:

```text
🧾 Redbelly Mainnet Node

📊 Durum: ✅ Senkronize
⚙️ Servis: ✅ Active
🏛 Rol: ⚪ Candidate
🔄 Sonraki Tur: ⚪ Candidate
📦 Node Bloğu: ...
🌐 Network Bloğu: ...
📉 Fark: ...
🔷 Superblock: ...
♻️ Recovery: ✅ Complete
🧩 Version: ...
🔐 Sertifika: ✅ Geçerli
🕒 Zaman: ...

💻 Sunucu
🧠 CPU Load: ...
🗂 RAM: ...
💽 Disk: ...
```

### Governor / Candidate

`Rol`, node'un mevcut Redbelly reconfiguration turundaki durumunu gösterir.

`Sonraki Tur`, loglarda bildirilen bir sonraki turdaki durumunu gösterir.

---

## 6. Timer Durumunu Kontrol Etme

Monitor systemd timer ile otomatik çalışır.

Timer durumunu görmek için:

```bash
systemctl status redbelly-telegram-monitor.timer
```

Bir sonraki çalışma zamanını görmek için:

```bash
systemctl list-timers redbelly-telegram-monitor.timer
```

Timer'ın `active` olması gerekir.

---

## 7. Manuel Rapor Gönderme

Planlanan zamanı beklemeden Telegram'a yeni bir rapor göndermek için:

```bash
systemctl start redbelly-telegram-monitor.service
```

Logları kontrol etmek için:

```bash
journalctl -u redbelly-telegram-monitor.service -n 50 --no-pager
```

---

## 8. Monitor Dosyaları

Kurulum aşağıdaki dosyaları oluşturur:

```text
/usr/local/bin/redbelly-telegram-monitor
/etc/redbelly-telegram-monitor.conf
/etc/systemd/system/redbelly-telegram-monitor.service
/etc/systemd/system/redbelly-telegram-monitor.timer
```

Telegram Bot Token yapılandırma dosyasında saklandığı için:

```text
/etc/redbelly-telegram-monitor.conf
```

dosyasını paylaşmayın.

---

## 9. Monitor'ü Kaldırma

Monitor'ü kaldırmak için installer dosyasının bulunduğu dizinde:

```bash
sudo ./redbelly-monitor.sh --uninstall
```

komutunu çalıştırın.

Installer:

- systemd timer'ı durdurur
- monitor service'ini kaldırır
- monitor dosyasını kaldırır
- yapılandırma dosyasını kaldırır

Redbelly node veya blockchain verileri silinmez.

---

## 10. Script'i Güncelleme

KolTigin üzerinde yeni bir `redbelly-monitor.sh` sürümü yayınlandığında installer'ı yeniden indirmek için:

```bash
cd /root
curl -fsSL https://koltigin.xyz/downloads/redbelly/redbelly-monitor.sh -o redbelly-monitor.sh
chmod +x redbelly-monitor.sh
```

Ardından installer yeniden çalıştırılabilir:

```bash
sudo ./redbelly-monitor.sh
```

---

## Hızlı Komutlar

Timer durumu:

```bash
systemctl status redbelly-telegram-monitor.timer
```

Bir sonraki çalışma:

```bash
systemctl list-timers redbelly-telegram-monitor.timer
```

Manuel rapor:

```bash
systemctl start redbelly-telegram-monitor.service
```

Monitor logları:

```bash
journalctl -u redbelly-telegram-monitor.service -n 50 --no-pager
```

Kaldırma:

```bash
sudo ./redbelly-monitor.sh --uninstall
```

---

**Download**

```text
https://koltigin.xyz/downloads/redbelly/redbelly-monitor.sh
```
