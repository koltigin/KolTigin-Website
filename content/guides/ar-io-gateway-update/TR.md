---
date: 2026-09-13
---

# AR.IO Gateway Güncelleme

AR.IO Gateway'in güncel tutulması ağ uyumluluğu, güvenlik ve gateway'in güvenilir biçimde çalışması açısından önemlidir.

Bu rehber, resmi `ar-io-node` Git repository'sinden kurulmuş mevcut bir AR.IO Gateway'in güvenli şekilde nasıl güncelleneceğini anlatır.

## Mevcut Release Sürümünü Kontrol Etme

Güncellemeden önce gateway üzerinde çalışan release sürümünü kontrol edin:

```bash
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

Aynı adresi tarayıcıdan da açabilirsiniz:

```text
https://YOUR_DOMAIN/ar-io/info
```

Buradaki:

```text
YOUR_DOMAIN
```

değerini kendi gateway domaininizle değiştirin.

Güncellemeye başlamadan önce mevcut release bilgisini not edin.

Release numarasının içerisinde:

```text
-pre
```

bulunuyorsa gateway kararlı `main` branch yerine `develop` branch üzerinde çalışıyor olabilir.

Production gateway kullanıyorsanız devam etmeden önce doğru branch üzerinde olduğunuzu kontrol edin.

## AR.IO Node Dizinine Girme

Repository home dizinine kurulduysa:

```bash
cd ~/ar-io-node
```

Aktif Git branch'ini kontrol edin:

```bash
git branch --show-current
```

Standart production kurulumunda bunun genellikle:

```text
main
```

olması gerekir.

Repository durumunu kontrol edin:

```bash
git status
```

Tracked dosyalarda manuel değişiklik yaptıysanız `git pull` işleminden önce bunları inceleyin.

Özel yapılandırmaları kontrol etmeden üzerine yazmayın.

## Yeni Release Kontrolü

Remote repository bilgisini güncelleyin:

```bash
git fetch
```

Son commitleri görüntüleyin:

```bash
git log --oneline --decorate -10
```

Local branch durumunu kontrol edin:

```bash
git status
```

Güncellemeden önce resmi AR.IO release notlarını ve duyurularını da kontrol edin.

Yeni release'ler şunları içerebilir:

- yeni environment variable'lar
- değişen varsayılan değerler
- Docker Compose değişiklikleri
- observer değişiklikleri
- Solana yapılandırma değişiklikleri
- yeni servis veya bağımlılıklar

## Yapılandırmayı Yedekleme

Güncellemeden önce `.env` dosyanızın bir yedeğini alın:

```bash
cp .env ~/.ar-io-env-backup-$(date +%Y%m%d-%H%M%S)
```

Wallet veya keypair dosyaları kullanıyorsanız bunların sunucudan ayrı ve güvenli yedeklerinin bulunduğundan emin olun.

Private key, seed phrase veya keypair dosyalarını hiçbir zaman public repository'ye göndermeyin.

## Son Değişiklikleri Alma

Repository'yi güncelleyin:

```bash
git pull
```

İşlemin başarıyla tamamlandığını kontrol edin.

Ardından:

```bash
git status
```

komutunu çalıştırın.

## Yeni Environment Variable'ları Kontrol Etme

AR.IO Gateway güncellemesinin en önemli aşamalarından biri budur.

Güncel örnek environment dosyasını mevcut `.env` dosyanızla karşılaştırın.

Örnek dosyayı incelemek için:

```bash
nano .env.example
```

Mevcut yapılandırmanız:

```bash
nano .env
```

`.env` dosyanızı doğrudan `.env.example` ile değiştirmeyin.

Mevcut `.env`, gateway'inize özel yapılandırmayı içerir.

Bunun yerine yeni eklenen değişkenleri belirleyin ve yalnızca gerekli olanları mevcut `.env` dosyanıza ekleyin.

Özellikle şu alanlarla ilgili değişiklikleri kontrol edin:

- Solana wallet
- observer
- upload signing
- ArNS
- network yapılandırması
- yeni gateway servisleri

## Gateway'i Durdurma

Çalışan container'ları durdurun:

```bash
sudo docker compose down -v
```

Güncel resmi AR.IO upgrade prosedürü `down -v` kullanmaktadır.

AR.IO'nun indekslenmiş gateway verileri disposable Docker volume'larından ayrı tutulduğu için standart gateway güncelleme işlemi indeksleme ilerlemesini silmez.

Ancak standart kurulumu değiştirdiyseniz volume silmeden önce kendi Docker ve storage yapılandırmanızı mutlaka kontrol edin.

## Güncel Docker Image'larını Alma

Mevcut Docker Compose yapılandırmasının kullandığı image'ları çekin:

```bash
sudo docker compose pull
```

Böylece gateway yeniden başlatılmadan önce güncel image'lar hazır olur.

## Güncellenmiş Gateway'i Başlatma

Gateway'i başlatın:

```bash
sudo docker compose up -d
```

Güncel standart AR.IO sürümlerinde başlatma sırasında genellikle:

```text
--build
```

kullanılması gerekmez.

Servisleri kontrol edin:

```bash
sudo docker compose ps
```

## Logları Kontrol Etme

Gateway başladıktan hemen sonra core loglarını inceleyin:

```bash
sudo docker compose logs core -f -n 100
```

Observer loglarını da kontrol edin:

```bash
sudo docker compose logs observer -f -n 100
```

İkisini birlikte takip etmek için:

```bash
sudo docker compose logs core observer -f -n 100
```

Log ekranından çıkmak için:

```text
Ctrl+C
```

kullanın.

Bu işlem gateway'i durdurmaz.

## Gateway Sürümünü Doğrulama

Güncellemeden sonra bilgi endpoint'ini tekrar kontrol edin:

```bash
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

Beklediğiniz release sürümünün çalıştığını doğrulayın.

## Arweave Veri Erişimini Test Etme

Standart gateway testini çalıştırın:

```bash
curl https://YOUR_DOMAIN/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

Beklenen cevap:

```text
1984
```

`1984` cevabını alıyorsanız gateway test transaction'ını başarıyla sunuyor demektir.

## HTTPS Kontrolü

Public endpoint'i kontrol edin:

```bash
curl -I https://YOUR_DOMAIN
```

Güncellemeden sonra HTTPS'in çalışmaya devam ettiğinden emin olun.

## ArNS / Wildcard Kontrolü

Gateway wildcard ArNS routing kullanıyorsa bir subdomain üzerinden test edin:

```bash
curl -I https://ardrive.YOUR_DOMAIN
```

Bu kontrol güncellemenin aşağıdaki bileşenleri etkilemediğini doğrulamaya yardımcı olur:

- wildcard DNS
- wildcard SSL
- Nginx
- `ARNS_ROOT_HOST`
- gateway routing

## Observer Kontrolü

Güncellemeden sonra observer loglarını takip edin:

```bash
sudo docker compose logs observer -f -n 100
```

Şunlarla ilgili tekrar eden hatalara dikkat edin:

- Solana RPC
- observer wallet
- signing
- yetersiz SOL
- network yapılandırması
- upload yapılandırması

## Disk Kullanımını Kontrol Etme

Boş disk alanını kontrol edin:

```bash
df -h
```

Docker kullanımını kontrol edin:

```bash
sudo docker system df
```

Gateway zaman içerisinde önemli miktarda veri biriktirebilir. Bu nedenle disk kullanımı düzenli olarak takip edilmelidir.

## İsteğe Bağlı Docker Temizliği

Birden fazla güncellemeden sonra kullanılmayan Docker kaynakları birikebilir.

Önce mevcut kullanımı kontrol edin:

```bash
sudo docker system df
```

Kullanılmayan Docker kaynaklarını temizlemek isterseniz:

```bash
sudo docker system prune
```

Onaylamadan önce Docker'ın gösterdiği uyarıyı dikkatlice okuyun.

Bu komut kullanılmayan container, network ve image'ları kaldırabilir.

Sunucuda AR.IO dışında başka servisler çalışıyorsa devam etmeden önce nelerin silineceğini kontrol edin.

Production sunucuda agresif Docker temizleme komutlarını kontrol etmeden kullanmayın.

## Hızlı Güncelleme

Sağlıklı çalışan, release notlarını kontrol ettiğiniz ve manuel configuration migration gerektirmediğini doğruladığınız bir gateway için temel güncelleme akışı:

```bash
cd ~/ar-io-node

git status
git pull

sudo docker compose down -v
sudo docker compose pull
sudo docker compose up -d

sudo docker compose ps
sudo docker compose logs core observer -f -n 100
```

Ardından:

```bash
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

ve:

```bash
curl https://YOUR_DOMAIN/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

komutlarını çalıştırın.

Beklenen gateway test cevabı:

```text
1984
```

## Güncelleme Kontrol Listesi

Her güncellemeden sonra şunları doğrulayın:

- repository başarıyla güncellendi
- doğru Git branch aktif
- yeni environment variable'lar kontrol edildi
- `.env` doğru gateway yapılandırmasını koruyor
- Docker container'ları çalışıyor
- core loglarında sürekli tekrarlanan hata yok
- observer doğru çalışıyor
- `/ar-io/info` cevap veriyor
- beklenen release çalışıyor
- gateway testi `1984` döndürüyor
- HTTPS çalışıyor
- wildcard ArNS subdomainleri çalışıyor
- Nginx sağlıklı
- SSL sertifikası geçerli
- yeterli boş disk alanı var
- Solana wallet ve observer yapılandırması doğru

Yalnızca `git pull` komutunun başarılı olması gateway güncellemesinin tamamlandığı anlamına gelmez. Restart işleminden sonra çalışan servisleri ve public gateway'i mutlaka doğrulayın.
