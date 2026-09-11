---
date: 2026-09-11
---

# Redbelly Node Sorunlar ve Çözümler

Bu rehber, Redbelly Mainnet node işletimi sırasında karşılaşılabilecek bazı yaygın sorunların çözümünü içerir.

Buradaki işlemler standart node kurulumundan farklı olarak bakım ve sorun giderme işlemleridir. Komutlardaki domain değerlerini kendi node bilgilerinizle değiştirin.

---

## 1. Redbelly Node Domain / Hostname Değiştirme

Çalışan bir Redbelly node'un domain veya hostname'i değiştirilecekse yalnızca DNS kaydını değiştirmek yeterli değildir.

Yeni hostname için DNS kaydı ve TLS sertifikası hazırlanmalı, Redbelly servisinin kullandığı sertifika yolları güncellenmeli ve değişiklik Redbelly Support'a bildirilmelidir.

Bu örnekte:

```text
Eski domain: old.example.com
Yeni domain: redbelly.example.com
```

kullanılacaktır.

### 1.1. Değişikliği Redbelly Support'a Bildirin

Hostname değişikliğini yapmadan önce Redbelly Support'a node bilgilerinizle birlikte yeni hostname'i bildirin.

Hazır bulundurmanız gereken temel bilgiler:

```text
Node ID
Eski hostname
Yeni hostname
```

Node registration/monitoring tarafında eski hostname kayıtlı olabileceği için bu adımı atlamayın.

### 1.2. Yeni DNS Kaydını Oluşturun

DNS sağlayıcınızda yeni hostname için sunucunuzun mevcut IP adresine yönlenen bir **A kaydı** oluşturun.

Örnek:

```text
Type: A
Name: redbelly
Value: YOUR_SERVER_IP
```

DNS kaydını kontrol edin:

```bash
nslookup redbelly.example.com
```

Dönen IP adresinin node sunucunuzun IP adresi olduğundan emin olun.

### 1.3. Yeni TLS Sertifikasını Oluşturun

Yeni hostname için Let's Encrypt sertifikası oluşturun:

```bash
sudo certbot certonly --standalone -d redbelly.example.com
```

Certbot başarılı olduğunda sertifikalar genellikle:

```text
/etc/letsencrypt/live/redbelly.example.com/
```

altında oluşturulur.

Kontrol edin:

```bash
sudo ls -l /etc/letsencrypt/live/redbelly.example.com/
```

### 1.4. Redbelly Sertifika Dizini Oluşturun

Yeni domain için Redbelly sertifika dizinini oluşturun:

```bash
sudo mkdir -p /etc/redbelly/certs/redbelly.example.com
```

Yeni sertifikaları Redbelly dizinine kopyalayın:

```bash
sudo cp /etc/letsencrypt/live/redbelly.example.com/fullchain.pem \
/etc/redbelly/certs/redbelly.example.com/fullchain.pem
```

```bash
sudo cp /etc/letsencrypt/live/redbelly.example.com/privkey.pem \
/etc/redbelly/certs/redbelly.example.com/privkey.pem
```

### 1.5. Sertifika Sahipliğini ve İzinlerini Ayarlayın

Redbelly servisi `rbnuser` kullanıcısıyla çalıştığı için sertifika dosyalarının bu kullanıcı tarafından okunabilmesi gerekir.

Sahipliği ayarlayın:

```bash
sudo chown rbnuser:rbnuser /etc/redbelly/certs/redbelly.example.com/fullchain.pem
sudo chown rbnuser:rbnuser /etc/redbelly/certs/redbelly.example.com/privkey.pem
```

Dosya izinlerini ayarlayın:

```bash
sudo chmod 644 /etc/redbelly/certs/redbelly.example.com/fullchain.pem
sudo chmod 600 /etc/redbelly/certs/redbelly.example.com/privkey.pem
```

Kontrol edin:

```bash
sudo ls -l /etc/redbelly/certs/redbelly.example.com/
```

Beklenen yapı:

```text
-rw-r--r-- rbnuser rbnuser ... fullchain.pem
-rw------- rbnuser rbnuser ... privkey.pem
```

> **Önemli:** Sertifikalar `root:root` olarak kalırsa Redbelly servisi private key dosyasını okuyamayabilir ve `permission denied` hatasıyla başlayamayabilir.

### 1.6. Redbelly Service Yapılandırmasını Güncelleyin

Önce mevcut servis yapılandırmasını görüntüleyin:

```bash
sudo systemctl cat redbelly.service
```

Servis dosyasının konumunu belirledikten sonra kullandığınız editörle açın.

Örneğin:

```bash
sudo nano /etc/systemd/system/redbelly.service
```

TLS certificate ve key yollarındaki eski domain'i yeni domain ile değiştirin.

Eski:

```text
--tls.cert=/etc/redbelly/certs/old.example.com/fullchain.pem
--tls.key=/etc/redbelly/certs/old.example.com/privkey.pem
```

Yeni:

```text
--tls.cert=/etc/redbelly/certs/redbelly.example.com/fullchain.pem
--tls.key=/etc/redbelly/certs/redbelly.example.com/privkey.pem
```

Başka bir yerde eski hostname kullanılıyorsa onu da yeni hostname ile değiştirin.

Dosyayı kaydedin.

### 1.7. Systemd Yapılandırmasını Yenileyin

Servis dosyasındaki değişiklikleri systemd'ye yükleyin:

```bash
sudo systemctl daemon-reload
```

Redbelly servisini yeniden başlatın:

```bash
sudo systemctl restart redbelly.service
```

Servisin durumunu kontrol edin:

```bash
sudo systemctl status redbelly.service
```

Beklenen durum:

```text
Active: active (running)
```

### 1.8. Yeni Sertifikayı Dışarıdan Doğrulayın

Redbelly Recovery portu üzerinden sunulan sertifikayı kontrol edin:

```bash
echo | openssl s_client \
-servername redbelly.example.com \
-connect redbelly.example.com:1111 2>/dev/null \
| openssl x509 -noout -subject -issuer -dates
```

Çıktıdaki:

```text
subject=
```

alanında yeni hostname'in bulunduğunu ve sertifikanın geçerlilik tarihlerinin doğru olduğunu kontrol edin.

Bu işlem yalnızca dosyanın sunucuda bulunduğunu değil, Redbelly servisinin dışarıya gerçekten yeni sertifikayı sunduğunu doğrular.

### 1.9. Redbelly Support Tarafını Doğrulayın

Domain değişikliği tamamlandıktan sonra Redbelly Support'a:

```text
Node ID
Eski hostname
Yeni hostname
```

bilgileriyle işlemin tamamlandığını bildirin.

Node'un yeni hostname ile Redbelly monitoring/network tarafında doğru göründüğünün teyit edilmesini isteyin.

---

## 2. SSL Sertifikası Otomatik Yenilenmiyor

Redbelly installer Let's Encrypt / Certbot kullanılarak kurulduysa sertifika yenileme işlemleri otomatik olarak gerçekleştirilebilir.

Ancak Certbot `standalone` yöntemiyle yapılandırılmışsa sertifika doğrulaması sırasında TCP port `80` kullanılmalıdır.

Port `80` başka bir servis tarafından kullanılıyorsa otomatik yenileme başarısız olabilir.

### 2.1. Certbot Yapılandırmasını Kontrol Edin

Mevcut sertifikaları görüntüleyin:

```bash
sudo certbot certificates
```

Renewal yapılandırmasını kontrol etmek için:

```bash
sudo grep -R "authenticator" /etc/letsencrypt/renewal/
```

Aşağıdakine benzer bir çıktı görüyorsanız:

```text
authenticator = standalone
```

Certbot yenileme sırasında port `80` üzerinde kendi geçici doğrulama sunucusunu çalıştırmak zorundadır.

### 2.2. Otomatik Yenilemeyi Test Edin

Gerçek sertifikayı değiştirmeden renewal işlemini test edin:

```bash
sudo certbot renew --dry-run
```

İşlem başarılıysa otomatik yenileme yapılandırması çalışıyor demektir.

Port `80` kullanımda olduğu için hata alırsanız sonraki adıma geçin.

### 2.3. Port 80'i Hangi Servisin Kullandığını Kontrol Edin

```bash
sudo ss -ltnp | grep ':80 '
```

Örneğin çıktıda:

```text
nginx
```

görünüyorsa port `80` Nginx tarafından kullanılmaktadır.

> Nginx veya port `80` kullanan başka bir servisi doğrudan durdurmadan önce bu servisin başka bir web sitesi, reverse proxy veya uygulama tarafından kullanılıp kullanılmadığını kontrol edin.

### 2.4. Gereksiz Nginx Port 80'i Kullanıyorsa

Nginx bu sunucuda başka bir hizmet için gerekli değilse geçici olarak durdurabilirsiniz:

```bash
sudo systemctl stop nginx
```

Port `80` durumunu tekrar kontrol edin:

```bash
sudo ss -ltnp | grep ':80 '
```

Çıktı dönmüyorsa port `80` artık boştur.

Certbot testini tekrar çalıştırın:

```bash
sudo certbot renew --dry-run
```

Test başarılı olmalıdır.

### 2.5. Sertifikayı Manuel Olarak Yenileme

Gerekirse gerçek renewal işlemini çalıştırabilirsiniz:

```bash
sudo certbot renew
```

Belirli bir domain için yeni sertifika oluşturmanız gerekiyorsa:

```bash
sudo certbot certonly --standalone -d redbelly.example.com
```

### 2.6. Redbelly Sertifika Dosyalarını Kontrol Edin

Let's Encrypt sertifikaları:

```text
/etc/letsencrypt/live/redbelly.example.com/
```

altında bulunur.

Redbelly tarafından kullanılan sertifikalar ise:

```text
/etc/redbelly/certs/redbelly.example.com/
```

altında bulunabilir.

Kontrol edin:

```bash
sudo ls -l /etc/redbelly/certs/redbelly.example.com/
```

Sahiplik ve izinların aşağıdaki gibi olduğundan emin olun:

```text
fullchain.pem → rbnuser:rbnuser → 644
privkey.pem   → rbnuser:rbnuser → 600
```

Gerekirse:

```bash
sudo chown rbnuser:rbnuser /etc/redbelly/certs/redbelly.example.com/fullchain.pem
sudo chown rbnuser:rbnuser /etc/redbelly/certs/redbelly.example.com/privkey.pem

sudo chmod 644 /etc/redbelly/certs/redbelly.example.com/fullchain.pem
sudo chmod 600 /etc/redbelly/certs/redbelly.example.com/privkey.pem
```

### 2.7. Renewal Hook'u Kontrol Edin

Yeni Redbelly installer sürümleri Let's Encrypt sertifikası yenilendiğinde güncel sertifikaları Redbelly sertifika dizinine aktarmak için renewal hook yapılandırabilir.

Kontrol edin:

```bash
sudo ls -l /etc/letsencrypt/renewal-hooks/post/
```

Redbelly hook'u mevcutsa içeriğini kontrol edebilirsiniz:

```bash
sudo cat /etc/letsencrypt/renewal-hooks/post/redbelly.sh
```

Bu mekanizma Certbot sertifikayı başarıyla yeniledikten sonra çalışır.

> Eğer `certbot renew` port `80` çakışması nedeniyle baştan başarısız oluyorsa renewal hook da çalışamaz. Bu durumda öncelikle Certbot'un sertifikayı başarıyla yenileyebilmesi sağlanmalıdır.

### 2.8. Redbelly Servisini Kontrol Edin

Sertifika işlemlerinden sonra servisi yeniden başlatın:

```bash
sudo systemctl restart redbelly.service
```

Durumunu kontrol edin:

```bash
sudo systemctl status redbelly.service
```

Beklenen durum:

```text
Active: active (running)
```

Son olarak node'un dışarıya sunduğu sertifikayı kontrol edin:

```bash
echo | openssl s_client \
-servername redbelly.example.com \
-connect redbelly.example.com:1111 2>/dev/null \
| openssl x509 -noout -subject -issuer -dates
```

Yeni sertifikanın hostname ve geçerlilik tarihleri doğruysa SSL işlemi tamamlanmıştır.

---

## Hızlı Sorun Kontrolü

Node başlamıyorsa:

```bash
sudo systemctl status redbelly.service
```

Detaylı servis logları:

```bash
journalctl -u redbelly.service
```

Redbelly hata logları:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs_error.log
```

Sertifika izinleri:

```bash
sudo ls -l /etc/redbelly/certs/redbelly.example.com/
```

Port `80` kontrolü:

```bash
sudo ss -ltnp | grep ':80 '
```

Certbot renewal testi:

```bash
sudo certbot renew --dry-run
```

Dışarıya sunulan TLS sertifikasını kontrol etmek:

```bash
echo | openssl s_client \
-servername redbelly.example.com \
-connect redbelly.example.com:1111 2>/dev/null \
| openssl x509 -noout -subject -issuer -dates
```

Bu rehbere Redbelly node işletimi sırasında karşılaşılan yeni sorunlar ve doğrulanmış çözümler zaman içinde eklenebilir.
