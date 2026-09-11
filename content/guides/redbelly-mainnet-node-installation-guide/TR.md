---
date: 2026-09-11
---

# Redbelly Mainnet Node Kurulum Rehberi

Bu rehber, Redbelly Mainnet node'unun resmi `rbn-installer` kullanılarak kurulmasını ve kurulum sonrasında node'un çalıştığının kontrol edilmesini anlatır.

Installer; Redbelly binary kurulumu, TLS sertifikası, systemd servisi ve gerekli sistem yapılandırmalarının büyük bölümünü otomatik olarak gerçekleştirir.

## 1. Kurulum Öncesi

Kuruluma başlamadan önce node için kullanacağınız bir domain veya subdomain'i sunucunuzun IP adresine yönlendirin.

Örnek:

```text
redbelly.example.com
```

DNS sağlayıcınızda sunucunun IP adresine yönlenen bir **A kaydı** oluşturun.

Örnek:

```text
Type: A
Name: redbelly
Value: YOUR_SERVER_IP
```

DNS kaydının doğru IP adresine yönlendiğini kontrol edebilirsiniz:

```bash
nslookup redbelly.example.com
```

### Gerekli Portlar

Firewall üzerinde aşağıdaki portların açık olduğundan emin olun:

| Port | Protokol | Kullanım |
|---|---|---|
| 22 | TCP | SSH |
| 80 | TCP | Let's Encrypt / Certbot |
| 1888 | TCP | Consensus |
| 1111 | TCP | Recovery |
| 6540 | UDP | Status Server |

UFW kullanıyorsanız:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 1888/tcp
sudo ufw allow 1111/tcp
sudo ufw allow 6540/udp
```

Firewall durumunu kontrol edin:

```bash
sudo ufw status
```

> Consensus ve Recovery portları, Redbelly node registration sırasında bildirdiğiniz portlarla aynı olmalıdır.

## 2. Node Registration

Kurulumdan önce node'un Redbelly tarafında kayıt edilmiş olması gerekir.

Registration sırasında aşağıdaki bilgiler istenir:

- Node Hostname
- Reward Address
- Vote Address
- Consensus Port
- Recovery Port
- Discord kullanıcı adı

Registration işlemi Redbelly tarafından onaylandıktan sonra node'unuza özel bir **Node ID** verilir.

Bu Node ID'yi kurulum sırasında kullanacağınız için hazır bulundurun.

Ayrıca Vote/Signing adresinizin private key'ine ihtiyacınız olacaktır.

> **Önemli:** Private key'inizi hiçbir kişiyle paylaşmayın. Private key yalnızca installer'ın kendi terminal ekranındaki ilgili alana girilmelidir.

## 3. Mainnet Installer'ı İndirin

Redbelly tarafından sağlanan en güncel Mainnet installer dosyasını Node Operator Support Portal üzerinden indirin.

Installer sürüme göre örneğin şu şekilde olabilir:

```text
rbn-installer-mainnet-v1.3.16.run
```

Bu rehberde sürüm numarası:

```text
rbn-installer-mainnet-vX.X.X.run
```

şeklinde gösterilecektir.

`X.X.X` yerine indirdiğiniz güncel Mainnet sürümünü kullanın.

Installer dosyasını SCP, SFTP veya tercih ettiğiniz başka bir yöntemle sunucunuza yükleyin.

## 4. Installer'ı Çalıştırın

Installer dosyasına çalıştırma izni verin:

```bash
chmod +x rbn-installer-mainnet-vX.X.X.run
```

Paket listesini güncelleyin:

```bash
sudo apt update
```

Ardından installer'ı çalıştırın:

```bash
sudo ./rbn-installer-mainnet-vX.X.X.run
```

Installer kurulum boyunca gerekli bilgileri interaktif olarak soracaktır.

## 5. Installer Soruları ve Verilecek Cevaplar

### Domain / DNS

Node için daha önce DNS kaydını oluşturduğunuz hostname'i girin.

Örnek:

```text
redbelly.example.com
```

`https://` eklemeyin.

### SSL / Certbot

Installer SSL/TLS sertifikasının Certbot kullanılarak oluşturulmasını sorduğunda:

```text
y
```

seçin.

Sertifika kaydı için istenen e-posta adresini girin.

Installer Let's Encrypt sertifikasını oluşturacak ve Redbelly için gerekli sertifika yapılandırmasını gerçekleştirecektir.

### Consensus Port

Varsayılan Consensus portu:

```text
1888
```

Registration sırasında farklı bir port bildirmediyseniz varsayılan değeri kullanın.

Installer varsayılan olarak `1888` gösteriyorsa yalnızca **Enter** tuşuna basabilirsiniz.

### Recovery Port

Varsayılan Recovery portu:

```text
1111
```

Registration sırasında farklı bir port bildirmediyseniz varsayılan değeri kullanın.

Installer varsayılan olarak `1111` gösteriyorsa yalnızca **Enter** tuşuna basabilirsiniz.

### UDP Status Server

Installer UDP Status Server'ı etkinleştirmek isteyip istemediğinizi soracaktır:

```text
Enable UDP status server which allows tracking basic node statistics (y/n) (default: y):
```

Cevap:

```text
y
```

Varsayılan cevap `y` ise yalnızca **Enter** tuşuna da basabilirsiniz.

UDP Status Server node durumunun izlenmesini sağlar ve monitoring sistemleri ile Telegram bot gibi araçlarda kullanılabilir.

### UDP Status Port

Varsayılan UDP Status Server portu:

```text
6540
```

Varsayılan değer gösteriliyorsa **Enter** tuşuna basabilirsiniz.

### Debug Logging

Normal node kullanımı için:

```text
n
```

seçin.

Varsayılan değer `n` ise yalnızca **Enter** tuşuna basabilirsiniz.

### Logrotate

Log dosyalarının otomatik olarak yönetilmesi için:

```text
y
```

seçin.

Varsayılan değer `y` ise **Enter** yeterlidir.

### State Scheme

Installer'ın varsayılan değeri:

```text
path
```

Standart kurulumda varsayılan değeri kullanmak için **Enter** tuşuna basın.

### GC Mode

Installer'ın varsayılan değeri:

```text
full
```

Standart kurulumda varsayılan değeri kullanmak için **Enter** tuşuna basın.

### Database Snapshot

Installer güncel database snapshot'ını indirmek isteyip istemediğinizi soracaktır.

Yeni bir node kurulumu için:

```text
y
```

seçin.

Varsayılan değer `y` ise yalnızca **Enter** tuşuna basabilirsiniz.

Installer güncel Mainnet database snapshot'ını indirerek node'un başlangıç senkronizasyonunu gerçekleştirir.

### Node ID

Redbelly registration işlemi tamamlandıktan sonra size verilen Node ID'yi girin.

Örnek:

```text
114
```

Bu yalnızca örnektir. **Kendi node'unuza ait Node ID'yi kullanın.**

### Vote / Signing Private Key

Installer Vote/Signing adresinizin private key'ini isteyecektir.

Private key'i `0x` öneki olmadan girin.

Private key'i terminale yapıştırdığınızda karakterlerin ekranda görünmemesi normaldir. Input güvenlik nedeniyle gizlenmektedir.

> **Güvenlik:** Private key'inizi hiçbir kişiyle paylaşmayın ve ekran görüntüsü, rehber, log veya herhangi bir herkese açık ortamda yayınlamayın.

## 6. Kurulum Sonrası Node Kontrolü

Installer işlemini tamamladıktan sonra Redbelly prosesinin çalışıp çalışmadığını kontrol edin:

```bash
pgrep rbbc
```

Komut bir PID döndürüyorsa `rbbc` prosesi çalışmaktadır.

Ardından Redbelly servisinin durumunu kontrol edin:

```bash
sudo systemctl status redbelly.service
```

Başarılı bir kurulumda servis durumunun:

```text
Active: active (running)
```

olması gerekir.

Servis loglarını görüntülemek için:

```bash
journalctl -u redbelly.service
```

Canlı Redbelly loglarını takip etmek için:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs.log
```

Hata loglarını takip etmek için:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs_error.log
```

Canlı log ekranından çıkmak için:

```text
Ctrl + C
```

kullanabilirsiniz.

## Faydalı Komutlar

Node durumunu kontrol etmek:

```bash
sudo systemctl status redbelly.service
```

Node'u yeniden başlatmak:

```bash
sudo systemctl restart redbelly.service
```

Node'u durdurmak:

```bash
sudo systemctl stop redbelly.service
```

Node'u başlatmak:

```bash
sudo systemctl start redbelly.service
```

Canlı logları takip etmek:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs.log
```

Hata loglarını takip etmek:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs_error.log
```

---

Kurulum tamamlandıktan ve `redbelly.service` servisi `active (running)` durumuna geldikten sonra node'unuzu düzenli olarak takip edebilirsiniz.

Yeni bir Redbelly Mainnet sürümü yayınlandığında mevcut node'u güncellemek için ayrıca **Redbelly Mainnet Node Güncelleme Rehberi**ni kullanabilirsiniz.
