# OptimAI CLI Node Kurulum Rehberi — Ubuntu 24.04 VPS

OptimAI Network'e katılmanın farklı yolları bulunuyor. Teknik seviyenize ve kullanmak istediğiniz cihaza göre Lite Node, Telegram Node, Core Node Desktop, Core Node CLI veya Edge Node seçeneklerinden birini kullanabilirsiniz.

- **Lite Node:** Chrome, Brave ve Opera gibi desteklenen Chromium tabanlı tarayıcılarda çalıştırılabilir.
- **Telegram Node:** Telegram Mini App üzerinden kullanılabilir.
- **Core Node Desktop:** Windows, macOS ve Ubuntu Linux üzerinde çalıştırılabilir.
- **Core Node CLI:** Windows, macOS, Ubuntu Linux ve sunucularda çalıştırılabilir.
- **Edge Node:** iOS ve Android cihazlarda kullanılabilir.

OptimAI hesabıyla birden fazla desteklenen cihazda node çalıştırmak mümkündür. Ancak tüm node'ların ağın hesap, görev ve ödül kurallarına uyması gerekir.

Bu rehber özellikle **Ubuntu 24.04 kullanan bir VPS veya sunucuda OptimAI Core CLI Node çalıştırmak isteyenler** için hazırlanmıştır.

> **Not:** OptimAI aktif olarak geliştirilmektedir. Node yazılımı, komutlar ve ağ davranışı zaman içinde değişebilir. Kurulumdan önce güncel OptimAI dokümantasyonunu kontrol etmeniz önerilir.

---

## Sistem Gereksinimleri

OptimAI Core Node için temel gereksinimler:

- Ubuntu 22.04 veya üzeri
- En az 4 GB RAM
- En az 2 CPU çekirdeği
- En az 15 GB boş disk alanı
- Aktif internet bağlantısı
- Docker Engine
- OptimAI hesabı

Bu rehber Ubuntu 24.04 üzerinde hazırlanmıştır.

---

## 1. Docker Kontrolü

Öncelikle Docker'ın kurulu olduğunu kontrol edin:

```bash
docker --version
```

Docker servisinin durumunu kontrol edin:

```bash
systemctl status docker --no-pager
```

Docker kurulu ve servis çalışıyorsa doğrudan **2. OptimAI CLI Kurulumu** bölümüne geçebilirsiniz.

### Docker Yüklü Değilse

Docker yüklü değilse aşağıdaki adımlarla Ubuntu 24.04 üzerine Docker Engine kurabilirsiniz.

Öncelikle mevcut paketleri güncelleyin:

```bash
sudo apt update
sudo apt upgrade -y
```

Docker'ın resmi deposunu kullanabilmek için gerekli paketleri yükleyin:

```bash
sudo apt install -y ca-certificates curl
```

Docker'ın GPG anahtarı için dizini oluşturun:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
```

Docker'ın resmi GPG anahtarını indirin:

```bash
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
```

Anahtarın okunabilir olduğundan emin olun:

```bash
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

Docker'ın resmi APT deposunu ekleyin:

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Paket listesini tekrar güncelleyin:

```bash
sudo apt update
```

Docker Engine, CLI, containerd ve Docker Compose eklentilerini yükleyin:

```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Docker servisini etkinleştirin ve başlatın:

```bash
sudo systemctl enable --now docker
```

Kurulumu doğrulayın:

```bash
docker --version
```

Docker servisinin çalıştığını kontrol edin:

```bash
systemctl status docker --no-pager
```

Son olarak Docker'ın container çalıştırabildiğini test edin:

```bash
sudo docker run --rm hello-world
```

`Hello from Docker!` mesajını görüyorsanız Docker kurulumu başarıyla tamamlanmıştır.

> **Not:** Bu rehberde OptimAI servisi `root` kullanıcısıyla çalıştırıldığı için ayrıca kullanıcıyı `docker` grubuna eklemek zorunlu değildir.

---

## 2. OptimAI CLI Kurulumu

Güncel OptimAI CLI binary'sini indirin:

```bash
curl -L https://cli-node.optimai.network/optimai_cli_ubuntu -o optimai-cli
```

Dosyaya çalıştırma izni verin:

```bash
chmod +x optimai-cli
```

CLI'yi sistem genelinde kullanılabilecek dizine taşıyın:

```bash
sudo mv optimai-cli /usr/local/bin/optimai-cli
```

Kurulumu doğrulayın:

```bash
optimai-cli --help
```

CLI sürümünüz destekliyorsa sürümü ayrıca kontrol edebilirsiniz:

```bash
optimai-cli --version
```

---

## 3. OptimAI Hesabına Giriş

Giriş işlemini başlatın:

```bash
optimai-cli auth login
```

CLI size tarayıcıda açmanız gereken bir giriş bağlantısı gösterebilir.

1. Terminalde gösterilen bağlantıyı tarayıcıda açın.
2. OptimAI hesabınıza giriş yapın.
3. Yetkilendirme işlemini tamamlayın.
4. CLI'nin ekranda verdiği yönlendirmeleri takip edin.

Normal giriş yöntemiyle sorun yaşarsanız desteklenen legacy giriş yöntemini deneyebilirsiniz:

```bash
optimai-cli auth login --legacy
```

CLI sürümünüz destekliyorsa giriş durumunu kontrol edin:

```bash
optimai-cli auth status
```

---

## 4. Node'u İlk Kez Başlatma

Node'u başlatın:

```bash
optimai-cli node start
```

Node durumunu başka bir terminalden kontrol edebilirsiniz:

```bash
optimai-cli node status
```

Core Node görevlerini çalıştırabilmek için Docker'a ihtiyaç duyar. Bu nedenle Docker servisinin açık kalması gerekir.

Görev olmadığı dönemlerde node'un boşta beklemesi normaldir. Görev ve ödül mekanizması ağın mevcut iş yüküne ve kurallarına göre değişebilir.

Node'u terminal ön planında çalıştırıyorsanız durdurmak için:

```text
Ctrl+C
```

kullanabilirsiniz.

---

## 5. Ödül Bakiyesini Kontrol Etme

CLI üzerinden ödül bakiyesini kontrol etmek için:

```bash
optimai-cli rewards balance
```

Ödüllerin yalnızca işlem veya cihaz sayısına bağlı olmadığını unutmayın. Görev tamamlama, sonuç kalitesi, doğrulama doğruluğu, uptime, kaynak katkısı, kampanya talebi ve node itibarı gibi farklı faktörler etkili olabilir.

---

## 6. CLI'yi Güncelleme

OptimAI CLI'nin desteklenen güncelleme mekanizmasını kullanmak için:

```bash
optimai-cli update
```

CLI ve node yazılımını güncel tutmak yeni görev tipleri, hata düzeltmeleri ve güvenlik güncellemeleri açısından önemlidir.

---

## 7. Node'u Arka Planda Çalıştırma — systemd

Bir VPS üzerinde node'un SSH bağlantısı kapandıktan sonra da çalışmasını ve sunucu yeniden başladığında otomatik açılmasını istiyorsanız `systemd` kullanabilirsiniz.

Servis dosyasını oluşturun:

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

> Bu örnek, CLI'nin `/usr/local/bin/optimai-cli` konumuna kurulduğu ve node'un `root` kullanıcısı altında çalıştırıldığı bir VPS kurulumu içindir.

---

## 8. systemd Servisini Etkinleştirme

Yeni servis dosyasını systemd'ye tanıtın:

```bash
sudo systemctl daemon-reload
```

Servisin sunucu açılışında otomatik başlamasını etkinleştirin:

```bash
sudo systemctl enable optimai.service
```

Node servisini başlatın:

```bash
sudo systemctl start optimai.service
```

---

## 9. Node Durumunu Kontrol Etme

Servisin durumunu kontrol edin:

```bash
systemctl status optimai.service --no-pager
```

Son logları görüntüleyin:

```bash
journalctl -u optimai.service -n 40 --no-pager -l
```

Docker container'larını kontrol edin:

```bash
docker ps
```

Servisin otomatik başlangıca ayarlı olduğunu doğrulayın:

```bash
systemctl is-enabled optimai.service
```

Beklenen çıktı:

```text
enabled
```

---

## 10. Canlı Logları İzleme

Node loglarını gerçek zamanlı takip etmek için:

```bash
journalctl -u optimai.service -f
```

Çıkmak için:

```text
Ctrl+C
```

---

## 11. Node'u Yeniden Başlatma

Gerektiğinde servisi yeniden başlatın:

```bash
sudo systemctl restart optimai.service
```

Ardından:

```bash
systemctl status optimai.service --no-pager
```

ile tekrar kontrol edebilirsiniz.

---

## 12. Node'a İsim Verme

Kullandığınız CLI sürümü `device rename` komutunu destekliyorsa node'unuzu daha kolay ayırt etmek için isim verebilirsiniz:

```bash
optimai-cli node device rename NODE_ADI
```

Örneğin:

```bash
optimai-cli node device rename VPS-01
```

Birden fazla cihazda node çalıştırıyorsanız her cihaza farklı ve anlaşılır bir isim vermek yönetimi kolaylaştırabilir.

---

## 13. Birden Fazla Cihazda OptimAI Çalıştırma

OptimAI hesabıyla birden fazla desteklenen cihazda node çalıştırabilirsiniz.

Örneğin aynı hesapla:

- macOS üzerinde Core Node Desktop
- Ubuntu masaüstünde Core Node Desktop
- Windows üzerinde Core Node Desktop
- VPS üzerinde Core Node CLI
- Mobil cihazda Edge Node

kullanılabilir.

Aynı ağ veya IP üzerinde farklı cihazlar kullanıyorsanız da her cihazın OptimAI'nin güncel kullanım ve ödül kurallarına uygun şekilde çalıştırılması gerekir.

Birden fazla cihaz kullanılması tek başına daha yüksek ödül garantisi anlamına gelmez.

---

## 14. Alternatif OptimAI Node Seçenekleri

VPS kullanmak istemiyorsanız OptimAI'ye farklı yollarla katılabilirsiniz.

### Core Node Desktop

Grafik arayüzlü Core Node sürümü:

- Windows
- macOS
- Ubuntu Linux

üzerinde kullanılabilir.

### Lite Node

Daha hafif katılım için Lite Node:

- Chrome
- Brave
- Opera

gibi desteklenen Chromium tabanlı tarayıcılarda kullanılabilir.

### Telegram Node

Telegram Mini App üzerinden de OptimAI'ye katılabilirsiniz:

```text
@OptimAI_Node_Bot
```

### Edge Node

Mobil katılım için OptimAI Edge Node:

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

Logları izle:

```bash
journalctl -u optimai.service -f
```

Docker'ı kontrol et:

```bash
docker ps
```

---

## Referans Bağlantısı

OptimAI hesabı oluşturmak isteyenler aşağıdaki referans bağlantısını kullanabilir:

https://node.optimai.network/register?ref=18ADBAE8

**Referans kodu:** `18ADBAE8`

---

## Son Notlar

- Docker, Core CLI Node çalışırken açık olmalıdır.
- Docker kurulu değilse bu rehberdeki Docker Engine kurulum adımlarını kullanabilirsiniz.
- Görev gelmediği dönemler tek başına bir hata göstergesi değildir.
- Node'un durumunu `optimai-cli node status` ile kontrol edebilirsiniz.
- CLI ve node yazılımını güncel tutun.
- VPS üzerinde systemd kullanmak node'un yeniden başlatmalardan sonra otomatik çalışmasını sağlar.
- Birden fazla cihazda node çalıştırılabilir; ancak cihaz sayısı tek başına daha yüksek ödül garantisi değildir.
- OptimAI aktif olarak geliştirildiği için komutlar ve node davranışı zaman içinde değişebilir.
