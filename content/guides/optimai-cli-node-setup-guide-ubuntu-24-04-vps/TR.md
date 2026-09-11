---
date: 2026-09-09
---

# OptimAI CLI Node Kurulum Rehberi — Ubuntu 24.04 VPS

OptimAI Network'e farklı yöntemlerle katılabilirsiniz.

- **Lite Node:** Chrome, Brave ve Opera gibi desteklenen Chromium tabanlı tarayıcılarda çalıştırılabilir.
- **Telegram Node:** Telegram Mini App üzerinden kullanılabilir.
- **Core Node Desktop:** Windows, macOS ve Ubuntu Linux üzerinde çalıştırılabilir.
- **Core Node CLI:** Windows, macOS, Ubuntu Linux ve sunucularda çalıştırılabilir.
- **Edge Node:** iOS ve Android cihazlarda kullanılabilir.

Aynı OptimAI hesabıyla birden fazla desteklenen cihazda node çalıştırabilirsiniz.

Bu rehber, **Ubuntu 24.04 kullanan bir VPS veya sunucuda OptimAI Core CLI Node çalıştırmak isteyenler** için hazırlanmıştır.

> [!IMPORTANT]
> **OptimAI CLI authentication oturumu her 2 haftada (14 gün) bir sona erecek şekilde tasarlanmıştır.**
>
> Authentication süresi dolduğunda node çalışmayı durdurur. Node'un çalışmaya devam edebilmesi için OptimAI hesabınıza **manuel olarak yeniden giriş yapmanız ve node'u yeniden başlatmanız gerekir**.
>
> Yeniden giriş ve başlatma adımlarını bu rehberin **Sorunlar ve Çözümler** bölümünde bulabilirsiniz.

---

## Sistem Gereksinimleri

- Ubuntu 22.04 veya üzeri
- En az 4 GB RAM
- En az 2 CPU çekirdeği
- En az 15 GB boş disk alanı
- Aktif internet bağlantısı
- Docker
- OptimAI hesabı

---

## 1. Docker Kontrolü

```bash
docker --version
```

Docker sürümü görüntüleniyorsa **2. OptimAI CLI Kurulumu** bölümüne geçin.

### Docker Yüklü Değilse

Docker'ı kurun:

```bash
curl -fsSL https://get.docker.com | sh
```

Docker'ı başlatın ve sistem açılışında otomatik çalışmasını etkinleştirin:

```bash
sudo systemctl enable --now docker
```

Kullanıcınızı Docker grubuna ekleyin:

```bash
sudo usermod -aG docker $USER
```

Yeni grup yetkisini etkinleştirin:

```bash
newgrp docker
```

Docker'ı kontrol edin:

```bash
docker ps
```

---

## 2. OptimAI CLI Kurulumu

OptimAI CLI'yi indirin:

```bash
curl -L https://cli-node.optimai.network/optimai_cli_ubuntu -o optimai-cli
```

Çalıştırma izni verin:

```bash
chmod +x optimai-cli
```

CLI'yi `/usr/local/bin` dizinine taşıyın:

```bash
sudo mv optimai-cli /usr/local/bin/optimai-cli
```

Kurulumu kontrol edin:

```bash
optimai-cli --version
```

---

## 3. OptimAI Hesabına Giriş

```bash
optimai-cli auth login
```

- Terminalin verdiği URL'yi tarayıcıda açın.
- OptimAI hesabınıza giriş yapın.
- Tarayıcı localhost adresine yönlendirilirse adres çubuğundaki **tam URL'yi** kopyalayın.
- URL'yi terminale yapıştırın.

Giriş durumunu kontrol edin:

```bash
optimai-cli auth status
```

---

## 4. Node'u İlk Kez Başlatma

```bash
optimai-cli node start
```

Başarılı çalışmada aşağıdakilere benzer loglar görebilirsiniz:

```text
Docker daemon is available
Container created and started
Docker container is healthy
Node is running normally. Connected to server, ready for tasks.
```

Görev geldiğinde aşağıdakilere benzer loglar görülebilir:

```text
Assignments fetched: total=1
Successfully crawled ...
assignment submitted successfully
```

`Assignments fetched: total=0` hata değildir. O anda node'a atanmış görev bulunmadığını gösterir.

---

## 5. Node'u Arka Planda Çalıştırma — systemd

VPS yeniden başladığında OptimAI node'unun otomatik olarak tekrar çalışması için bir systemd servisi oluşturun:

```bash
sudo nano /etc/systemd/system/optimai.service
```

Aşağıdaki içeriği ekleyin:

```ini
[Unit]
Description=OptimAI CLI Node
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=root
Environment=HOME=/root
ExecStart=/usr/local/bin/optimai-cli node start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Dosyayı kaydedip çıkın.

---

## 6. Servisi Etkinleştirme

```bash
sudo systemctl daemon-reload
sudo systemctl enable optimai.service
sudo systemctl start optimai.service
```

---

## 7. Node Durumunu Kontrol Etme

Servis durumunu kontrol edin:

```bash
systemctl status optimai.service --no-pager
```

Son logları görüntüleyin:

```bash
journalctl -u optimai.service -n 40 --no-pager -l
```

Docker container'ını kontrol edin:

```bash
docker ps
```

Servisin VPS açılışında otomatik çalışacağını kontrol edin:

```bash
systemctl is-enabled optimai.service
```

Beklenen çıktı:

```text
enabled
```

---

## 8. Canlı Logları İzleme

```bash
journalctl -u optimai.service -f
```

Log ekranından çıkmak için:

```text
Ctrl+C
```

---

## 9. Node'u Yeniden Başlatma

```bash
sudo systemctl restart optimai.service
```

---

## 10. Node'a İsim Verme

Node'a bir isim vermek için:

```bash
optimai-cli node device rename NODE_ADI
```

Örneğin:

```bash
optimai-cli node device rename VPS-01
```

Birden fazla cihazda node çalıştırıyorsanız farklı isimler kullanmanız node'ları ayırt etmenizi kolaylaştırır.

---

## 11. Ödül Bakiyesini Kontrol Etme

```bash
optimai-cli rewards balance
```

---

## 12. OptimAI CLI'yi Güncelleme

```bash
optimai-cli update
```

---

## 13. Birden Fazla Cihazda OptimAI Çalıştırma

Aynı OptimAI hesabıyla birden fazla desteklenen cihazda node çalıştırabilirsiniz.

Örneğin:

- macOS üzerinde Core Node Desktop
- Ubuntu üzerinde Core Node Desktop
- Windows üzerinde Core Node Desktop
- VPS üzerinde Core Node CLI
- Mobil cihazda Edge Node

Aynı IP üzerindeki farklı cihazlarda da node çalıştırılabilir. Her cihazın OptimAI'nin güncel kullanım ve ödül kurallarına uygun şekilde çalıştırılması gerekir.

---

## 14. Diğer OptimAI Node Seçenekleri

VPS kullanmak zorunda değilsiniz.

### Core Node Desktop

- Windows
- macOS
- Ubuntu Linux

### Lite Node

Desteklenen tarayıcılar üzerinden çalıştırılabilir:

- Chrome
- Brave
- Opera

### Telegram Node

Telegram Mini App üzerinden çalıştırılabilir:

```text
@OptimAI_Node_Bot
```

### Edge Node

Mobil cihazlarda:

- iOS — App Store
- Android — Google Play

üzerinden kullanılabilir.

---

## 15. Faydalı Komutlar

Node'u başlat:

```bash
optimai-cli node start
```

Node durumunu kontrol et:

```bash
optimai-cli node status
```

Ödül bakiyesini kontrol et:

```bash
optimai-cli rewards balance
```

CLI'yi güncelle:

```bash
optimai-cli update
```

Servisi yeniden başlat:

```bash
sudo systemctl restart optimai.service
```

Servis durumunu kontrol et:

```bash
systemctl status optimai.service --no-pager
```

Canlı logları izle:

```bash
journalctl -u optimai.service -f
```

Docker container'ını kontrol et:

```bash
docker ps
```

---

## Referans Bağlantısı

OptimAI hesabı oluşturmak isteyenler aşağıdaki referans bağlantısını kullanabilir:

https://node.optimai.network/register?ref=18ADBAE8

**Referans kodu:** `18ADBAE8`

---

## Notlar

- `Assignments fetched: total=0` hata değildir. O anda görev bulunmadığını gösterir.
- Yeni görev geldiğinde node otomatik olarak çalışır.
- systemd sayesinde VPS yeniden başlatıldığında OptimAI node otomatik olarak tekrar başlar.
- Aynı hesapla birden fazla desteklenen cihazda node çalıştırılabilir.

# Sorunlar ve Çözümler

## Node Offline Oluyor / `Not authenticated` Hatası

OptimAI CLI Node çalışmayı durdurur ve aşağıdaki hatalar görülürse authentication oturumu sona ermiş olabilir:

```text
Not authenticated. Run `optimai-cli auth login` first.
Authentication lost. Stopping node...
```

Bu durumda systemd servisini tekrar tekrar yeniden başlatmak sorunu çözmez. OptimAI hesabına yeniden giriş yapılması gerekir.

### 1. OptimAI Servisini Durdurun

```bash
systemctl stop optimai
```

### 2. Yeniden Giriş İşlemini Başlatın

```bash
optimai-cli auth login --paste
```

### 3. Tarayıcıdan Giriş Yapın

Terminalde verilen OptimAI giriş bağlantısını kendi bilgisayarınızın tarayıcısında açın.

OptimAI hesabınıza giriş yaptıktan sonra **Copy code** seçeneğiyle verilen kodu kopyalayın.

### 4. Kodu VPS Terminaline Yapıştırın

Kopyaladığınız kodu terminalde aşağıdaki istemin bulunduğu yere yapıştırın:

```text
Paste the redirected URL (or just the `code` parameter):
```

Enter'a basın.

Başarılı olduğunda:

```text
Signed in successfully.
```

mesajı görüntülenir.

### 5. OptimAI Servisini Başlatın

```bash
systemctl start optimai
```

### 6. Servisin Çalıştığını Kontrol Edin

```bash
systemctl status optimai --no-pager -l
```

Sağlıklı durumda:

```text
Active: active (running)
```

görülmelidir.

> **Not:** Birden fazla VPS üzerinde yapılan testlerde authentication kaybının ilk node kimliğinin oluşturulmasından yaklaşık 14 gün sonra gerçekleştiği gözlemlenmiştir. Ancak OptimAI'nin resmi dokümantasyonunda 14 günlük bir authentication süresi şu anda açıkça belirtilmemektedir. Bu nedenle bunun kesin ve tasarlanmış bir token süresi olduğu doğrulanana kadar gözlemsel bir bulgu olarak değerlendirilmelidir.
