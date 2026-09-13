---
date: 2026-09-13
---

# AR.IO Gateway Sorun Giderme

Bu rehber, AR.IO Gateway çalıştırırken karşılaşılabilecek yaygın sorunları ve bunları teşhis etmek için kullanılabilecek pratik kontrolleri kapsar.

Yapılandırmayı değiştirmeden önce problemin hangi katmanda olduğunu belirlemeye çalışın:

- Docker
- AR.IO core servisi
- Observer
- DNS
- SSL
- Nginx
- ArNS çözümleme
- Solana wallet yapılandırması
- disk alanı
- çalışan release sürümü

## İlk Kontroller

Önce servislerin durumuna bakın:

```bash
cd ~/ar-io-node
sudo docker compose ps
```

Core logları:

```bash
sudo docker compose logs core -n 100
```

Observer logları:

```bash
sudo docker compose logs observer -n 100
```

İkisini birlikte canlı takip etmek için:

```bash
sudo docker compose logs core observer -f -n 100
```

Public gateway'i kontrol edin:

```bash
curl -I https://YOUR_DOMAIN
```

AR.IO bilgilerini kontrol edin:

```bash
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

Arweave veri erişimini test edin:

```bash
curl https://YOUR_DOMAIN/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

Beklenen cevap:

```text
1984
```

## Release Sürümü Yanlış veya `-pre` İçeriyor

Çalışan release'i kontrol edin:

```bash
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

Ardından Git branch'ini kontrol edin:

```bash
cd ~/ar-io-node
git branch --show-current
```

Normal production gateway için genellikle:

```text
main
```

branch'i kullanılmalıdır.

Repository bilgisini güncelleyin:

```bash
git fetch
git status
```

Gerekirse:

```bash
git pull
```

Ardından gateway'i mevcut AR.IO güncelleme prosedürüne göre yeniden başlatın.

Release bilgisinin içinde:

```text
-pre
```

bulunması, gateway'in beklenen kararlı release yerine pre-release veya development sürümünde çalıştığını gösterebilir.

## Gateway Network Araçlarında Offline Görünüyor

Gateway bazı network dashboardlarında offline görünürken sunucu ve servisler çalışmaya devam ediyor olabilir.

Bağımsız olarak kontrol edin.

Container'lar:

```bash
sudo docker compose ps
```

Public gateway:

```bash
curl -I https://YOUR_DOMAIN
```

Veri erişimi:

```bash
curl https://YOUR_DOMAIN/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

DNS:

```bash
dig +short YOUR_DOMAIN
```

Loglar:

```bash
sudo docker compose logs core observer -n 200
```

Bu testler başarılıysa harici bir dashboard geçici olarak farklı bir durum gösterse bile gateway sağlıklı olabilir.

## Observer Report `report pending` Gösteriyor

Şu endpoint'i kontrol edin:

```text
https://YOUR_DOMAIN/ar-io/observer/reports/current
```

Sonuç:

```text
report pending
```

gösteriyorsa Observer henüz raporu hazırlıyor olabilir.

Yalnızca rapor geçici olarak pending olduğu için gateway'i restart veya rebuild etmeyin.

Observation döngüsünün tamamlanmasını bekleyip tekrar kontrol edin.

## Observer `Cannot read properties of undefined` Hatası Veriyor

Observer bazı kontroller sırasında:

```text
Cannot read properties of undefined
```

benzeri bir hata gösterebilir.

Güncel AR.IO troubleshooting dokümanına göre bu, Observer henüz uygulanmamış veya mevcut olmayan bazı verileri kontrol ederken görülebilen bir durumdur.

Bu mesajı tek başına gateway'in bozuk olduğunun göstergesi olarak değerlendirmeyin.

Şunları ayrıca kontrol edin:

- gateway veri sunabiliyor mu
- `/ar-io/info` cevap veriyor mu
- Docker servisleri çalışıyor mu
- normal Observer raporları oluşuyor mu

## Gateway Observation Kontrolünden Geçemiyor

Diğer observer'lar gateway için failure raporluyorsa öncelikle public erişimi doğrulayın.

```bash
curl -I https://YOUR_DOMAIN
```

Ardından:

```bash
curl https://YOUR_DOMAIN/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

`.env` içerisindeki şu değerleri dikkatlice kontrol edin:

```env
AR_IO_WALLET=
ARNS_ROOT_HOST=
```

`AR_IO_WALLET` doğru gateway operatorünü göstermelidir.

`ARNS_ROOT_HOST`, gateway'in public root hostname'iyle eşleşmelidir.

Ayrıca şunları kontrol edin:

- DNS
- SSL sertifikası
- wildcard DNS
- wildcard SSL
- Nginx
- güncel AR.IO release
- Observer yapılandırması

## Failed Epoch

Gateway bir epoch içerisinde başarısız olduysa nedenini belirlemek için Observer raporunu kullanın.

Önce gateway erişimini kontrol edin:

```bash
curl -I https://YOUR_DOMAIN
```

Test transaction'ını kontrol edin:

```bash
curl https://YOUR_DOMAIN/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

Observer raporu:

```text
https://YOUR_DOMAIN/ar-io/observer/reports/current
```

Mevcutsa AR.IO Network Portal üzerinden manuel observation da çalıştırabilirsiniz.

Yaygın failure nedenleri:

- gateway'e ulaşılamaması
- süresi dolmuş SSL sertifikası
- DNS problemleri
- hatalı ArNS yapılandırması
- yavaş ArNS resolution
- hatalı gateway yapılandırması
- eski node release'i

Gateway yeterli sayıda prescribed observer kontrolünden geçemezse ilgili epoch için failed olarak değerlendirilebilir ve o epoch ödüllerini alamayabilir.

## `.env` Değişiklikleri Gateway'e Yansımıyor

Şu dosyada değişiklik yaptıysanız:

```text
.env
```

ancak gateway eski değerleri kullanmaya devam ediyorsa container'ların yeni environment ile yeniden oluşturulması gerekebilir.

Önce dosyayı kontrol edin:

```bash
nano .env
```

Ardından kullanılan release için uygun Docker Compose prosedürüyle servisleri yeniden başlatın.

Örneğin:

```bash
sudo docker compose down
sudo docker compose up -d
```

Mevcut AR.IO release dokümanı özellikle recreate veya rebuild işlemi istiyorsa o sürümün talimatlarını uygulayın.

Ardından:

```bash
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

ile kontrol edin.

`.env` dosyasını değiştirmek, zaten çalışan container içerisindeki environment değerlerini otomatik olarak değiştirmez.

## Gateway Başlamıyor

Kontrol edin:

```bash
sudo docker compose ps
```

Ardından:

```bash
sudo docker compose logs core -n 200
```

Şunlara dikkat edin:

- eksik environment variable
- hatalı wallet yapılandırması
- port çakışması
- database hataları
- permission hataları
- yetersiz disk alanı
- Docker image problemleri

Servisleri tekrar başlatmayı deneyin:

```bash
sudo docker compose up -d
```

Ardından logları hemen kontrol edin:

```bash
sudo docker compose logs core observer -f -n 100
```

## Nginx 502 Bad Gateway Hatası Veriyor

`502 Bad Gateway` genellikle Nginx'in çalıştığını ancak arkasındaki AR.IO servisine başarılı şekilde ulaşamadığını gösterir.

Nginx:

```bash
sudo systemctl status nginx
```

AR.IO container'ları:

```bash
cd ~/ar-io-node
sudo docker compose ps
```

Core logları:

```bash
sudo docker compose logs core -n 200
```

Gateway servisinin lokal portta dinleyip dinlemediğini kontrol edin:

```bash
sudo ss -lntp | grep 3000
```

Nginx proxy ayarını kontrol edin:

```nginx
proxy_pass http://localhost:3000;
```

Sonra:

```bash
sudo nginx -t
```

Başarılıysa:

```bash
sudo systemctl reload nginx
```

Gerçek problem AR.IO core container'ın çalışmamasıysa Nginx'i tekrar tekrar restart etmek sorunu çözmez.

## Domainde 404 veya Nginx Hatası

Önce Nginx'i test edin:

```bash
sudo nginx -t
```

Durumunu kontrol edin:

```bash
sudo systemctl status nginx
```

Aktif yapılandırmayı görüntüleyin:

```bash
sudo nginx -T
```

Şunun:

```nginx
server_name YOUR_DOMAIN *.YOUR_DOMAIN;
```

gateway domaininizle eşleştiğini doğrulayın.

Ayrıca:

```env
ARNS_ROOT_HOST=YOUR_DOMAIN
```

değerini kontrol edin.

DNS:

```bash
dig +short YOUR_DOMAIN
```

Wildcard DNS:

```bash
dig +short test.YOUR_DOMAIN
```

## Domain Çözümlenmiyor

Ana gateway domainini kontrol edin:

```bash
dig +short YOUR_DOMAIN
```

Sunucunuzun IP adresini döndürmelidir.

Wildcard:

```bash
dig +short test.YOUR_DOMAIN
```

Her ikisi de gateway sunucusuna çözülmelidir.

Tipik DNS yapısı:

```text
YOUR_DOMAIN        -> SERVER_IP
*.YOUR_DOMAIN      -> SERVER_IP
```

DNS kayıtlarını yeni değiştirdiyseniz yayılım için zaman tanıyın.

Çakışan A, AAAA veya CNAME kayıtlarını da kontrol edin.

## Ana Domain Çalışıyor Fakat ArNS Subdomainleri Çalışmıyor

Bu durum çoğunlukla gateway'in kendisinden ziyade wildcard routing yapılandırmasına işaret eder.

Wildcard DNS:

```bash
dig +short test.YOUR_DOMAIN
```

Bilinen bir ArNS tarzı hostname:

```bash
curl -I https://ardrive.YOUR_DOMAIN
```

Nginx:

```nginx
server_name YOUR_DOMAIN *.YOUR_DOMAIN;
```

`.env`:

```env
ARNS_ROOT_HOST=YOUR_DOMAIN
```

SSL sertifikasının da her ikisini kapsadığını doğrulayın:

```text
YOUR_DOMAIN
*.YOUR_DOMAIN
```

Root gateway çalışıyor fakat wildcard hostlar çalışmıyorsa özellikle şu alanlara odaklanın:

- wildcard DNS
- wildcard sertifika
- Nginx `server_name`
- `ARNS_ROOT_HOST`

## Tarayıcı `Your Connection Is Not Private` Gösteriyor

Mevcut sertifikaları kontrol edin:

```bash
sudo certbot certificates
```

Sertifikanın son kullanma tarihini ve kapsadığı domainleri kontrol edin.

ArNS subdomainleri sunuyorsanız sertifika hem root gateway'i hem wildcard hostname'i kapsamalıdır.

Örneğin:

```text
gateway.example.com
*.gateway.example.com
```

Sertifika süresi dolduysa yenileyin veya yeni sertifika alın ve Nginx'in doğru sertifika dosyalarını kullandığından emin olun.

Ardından:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Wildcard SSL Sertifikası Alınamıyor

Wildcard sertifikalar genellikle DNS challenge gerektirir.

Örnek:

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d YOUR_DOMAIN \
  -d '*.YOUR_DOMAIN'
```

Certbot aşağıdakine benzer bir TXT kaydı isteyecektir:

```text
_acme-challenge.YOUR_DOMAIN
```

Yayılımı kontrol edin:

```bash
dig TXT _acme-challenge.YOUR_DOMAIN
```

Beklenen TXT kaydı internette görünmeden Certbot işlemine devam etmeyin.

Yaygın hata nedenleri:

- TXT kaydının yanlış DNS zone'a eklenmesi
- eski TXT kaydının hâlâ bulunması
- DNS propagation gecikmesi
- yanlış domain
- wildcard domainin sertifika isteğine eklenmemesi

## Sertifika Yenilendi Ama Nginx Eski Sertifikayı Kullanıyor

Kontrol edin:

```bash
sudo certbot certificates
```

Nginx'in kullandığı sertifika yollarını görüntüleyin:

```bash
sudo nginx -T | grep -E 'ssl_certificate|ssl_certificate_key'
```

Dosya yollarını doğruladıktan sonra:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Dışarıdan kontrol edin:

```bash
curl -Iv https://YOUR_DOMAIN
```

Sertifikanın başarıyla yenilenmiş olması tek başına yeterli değildir. Nginx yeni sertifikayı yüklememiş olabilir.

## Nginx Yapılandırmasını Değiştirdim Ama Değişiklik Yansımadı

Her zaman önce test edin:

```bash
sudo nginx -t
```

Sonra reload:

```bash
sudo systemctl reload nginx
```

Kontrol:

```bash
sudo systemctl status nginx
```

Configuration ve sertifika değişikliklerinde genellikle reload yeterlidir.

Sunucunun tamamen reboot edilmesi normalde gerekli değildir.

## AR.IO Header Sorunları

AR.IO reverse proxy yapılandırmasının AR.IO'ya özgü header'ları aktardığını doğrulayın.

Nginx `location /` içerisinde:

```nginx
proxy_set_header X-AR-IO-Origin $http_x_ar_io_origin;
proxy_set_header X-AR-IO-Origin-Node-Release $http_x_ar_io_origin_node_release;
proxy_set_header X-AR-IO-Hops $http_x_ar_io_hops;
```

satırları bulunmalıdır.

Standart proxy header'larını da koruyun:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Değişiklikten sonra:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Observer Başlamıyor

Kontrol edin:

```bash
sudo docker compose ps
```

Ardından:

```bash
sudo docker compose logs observer -n 200
```

`.env` yapılandırmasını kontrol edin.

Özellikle:

```env
RUN_OBSERVER=true
OBSERVER_WALLET=
```

değerlerine bakın.

Kullandığınız yapılandırmaya göre:

```env
OBSERVER_PRIVATE_KEY=
```

veya:

```env
OBSERVER_KEYPAIR_PATH=
```

değerini doğrulayın.

Kullanılıyorsa upload signer yapılandırmasını da kontrol edin.

Private key'leri public support kanallarına veya ekran görüntülerine eklemeyin.

## Solana Wallet veya Signing Hataları

Core ve Observer loglarını kontrol edin:

```bash
sudo docker compose logs core observer -n 200
```

Şunları doğrulayın:

- operator public key
- observer public key
- observer private key veya keypair
- upload signing key veya keypair
- Solana RPC bağlantısı
- gerekli işlemler için yeterli SOL

Sorun giderirken private key paylaşmayın.

## ArNS İsimleri Çok Yavaş Açılıyor

Normal gateway istekleri çalışıyor fakat ArNS isimleri çok yavaş çözümleniyorsa şunları kontrol edin:

- gateway güncel release üzerinde mi
- `ARNS_ROOT_HOST` doğru mu
- wildcard DNS çalışıyor mu
- DNS resolver sağlıklı mı
- sunucu kaynakları tükenmiş mi
- disk darboğazı var mı

Load:

```bash
uptime
```

Memory:

```bash
free -h
```

Disk:

```bash
df -h
```

Container kullanımı:

```bash
sudo docker stats
```

AR.IO troubleshooting rehberi, sürekli yüksek ArNS resolution sürelerinin gateway yapılandırma problemi gösterebileceğini belirtiyor.

## Disk Alanı Bitti

Kontrol edin:

```bash
df -h
```

Inode kullanımını da kontrol edin:

```bash
df -i
```

Dosya sisteminde boş alan bulunmasına rağmen inode'ların tamamı tükenmişse yeni dosya oluşturulamayabilir.

Docker kullanımı:

```bash
sudo docker system df
```

Büyük dizinleri bulun:

```bash
sudo du -xh /var/lib/docker 2>/dev/null | sort -h | tail -30
```

AR.IO dizini:

```bash
sudo du -xh ~/ar-io-node 2>/dev/null | sort -h | tail -30
```

Gateway database veya indexed data dosyalarını ne olduklarını doğrulamadan silmeyin.

Silme işleminden önce disk alanını gerçekte hangi dosyaların kullandığını belirleyin.

## Docker Çok Fazla Disk Kullanıyor

Kontrol edin:

```bash
sudo docker system df
```

Kullanılmayan Docker kaynaklarını kaldırmak için:

```bash
sudo docker system prune
```

Onay vermeden önce gösterilen listeyi ve uyarıyı okuyun.

Sunucuda başka Docker uygulamaları da bulunuyorsa onların ihtiyaç duyabileceği kaynakları silmediğinizden emin olun.

Production gateway üzerinde agresif cleanup seçeneklerini kontrol etmeden kullanmayın.

## Sunucu Kaynaklarını Kontrol Etme

CPU/load:

```bash
uptime
```

Memory:

```bash
free -h
```

Disk:

```bash
df -h
```

Inode:

```bash
df -i
```

Docker:

```bash
sudo docker stats
```

Bu kontroller, configuration problemi ile kaynak tükenmesini hızlı şekilde birbirinden ayırmaya yardımcı olur.

## Firewall Kontrolü

UFW durumunu kontrol edin:

```bash
sudo ufw status
```

Tipik public portlar:

```text
22/tcp
80/tcp
443/tcp
```

Nginx arkasındaki AR.IO internal portunun normal şartlarda doğrudan public internete açılması gerekmez.

## 80 veya 443 Portu Başka Bir Servis Tarafından Kullanılıyor

Kontrol edin:

```bash
sudo ss -lntp | grep -E ':80|:443'
```

Normalde public HTTP/HTTPS portlarını Nginx kullanmalıdır.

Standalone Certbot kullanırken port 80 çakışması da yaşanabilir.

Certbot port 80 kullanım hatası veriyorsa:

- uygun webroot/Nginx/DNS challenge yöntemini kullanın
- veya challenge için ilgili servisi bilinçli olarak durdurup işlem sonrasında tekrar başlatın

Processleri kontrol etmeden sonlandırmayın.

## Hızlı Sorun Giderme Sırası

Gateway aniden cevap vermeyi bıraktığında şu sıra pratik bir başlangıçtır:

```bash
cd ~/ar-io-node

sudo docker compose ps
sudo docker compose logs core -n 100
sudo docker compose logs observer -n 100

df -h
df -i

sudo nginx -t
sudo systemctl status nginx

dig +short YOUR_DOMAIN
dig +short test.YOUR_DOMAIN

curl -I https://YOUR_DOMAIN
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

Bu sıra, yapılandırmayı değiştirmeye başlamadan önce application, storage, reverse proxy, DNS ve public endpoint katmanlarını kontrol eder.

## Sorun Giderme Kontrol Listesi

Bir AR.IO Gateway sorununu araştırırken şunları kontrol edin:

- doğru release çalışıyor
- uygun durumda `main` branch aktif
- Docker container'ları sağlıklı
- core servisi cevap veriyor
- Observer çalışıyor
- domain doğru çözümleniyor
- wildcard DNS doğru çözümleniyor
- SSL sertifikası geçerli
- wildcard sertifika geçerli
- Nginx yapılandırması başarılı
- Nginx doğru backend'e yönleniyor
- AR.IO header'ları aktarılıyor
- `ARNS_ROOT_HOST` doğru
- `AR_IO_WALLET` doğru
- Solana signing yapılandırması doğru
- gerektiğinde yeterli SOL mevcut
- disk alanı yeterli
- inode mevcut
- sunucu kaynakları sağlıklı
- gateway `1984` test transaction'ını döndürüyor
- Observer raporlarında sürekli failure bulunmuyor

Sorun giderirken her seferinde tek bir değişiklik yapın. Aynı anda çok sayıda configuration değişikliği yapmak, sorunu hangi değişikliğin çözdüğünü veya oluşturduğunu belirlemeyi zorlaştırır.
