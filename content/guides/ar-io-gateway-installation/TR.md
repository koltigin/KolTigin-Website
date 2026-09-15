---
date: 2026-09-13
slug: ar-io-gateway-kurulumu
---

# AR.IO Gateway Kurulumu

Bu rehber, Ubuntu sunucu üzerinde Docker, özel domain, SSL ve Nginx kullanarak bir AR.IO Gateway kurulumunu anlatır.

AR.IO protokol katmanı Solana'ya taşındı. Gateway hâlâ Arweave verilerini sunar ve indeksler, ancak operator ve observer kimlikleri artık Solana adreslerini kullanır.

Bu rehber gateway altyapısını çalışır hale getirmeye odaklanır. Gateway'i AR.IO ağına kaydetmek ve ARIO stake etmek ayrı işlemlerdir.

## Sistem Gereksinimleri

### Minimum

- 4 CPU çekirdeği
- 4 GB RAM
- 500 GB depolama
- SSD önerilir
- Stabil 50 Mbps internet bağlantısı

### Önerilen

- 12 CPU çekirdeği
- 32 GB RAM
- 2 TB SSD
- Stabil 1 Gbps internet bağlantısı

Uzun süre çalışacak production gateway için SSD ve yeterli boş disk alanı kullanılması önemlidir.

## Sunucuyu Güncelleme

```bash
sudo apt update -y && sudo apt upgrade -y
```

## Gerekli Paketleri Kurma

```bash
sudo apt install -y curl openssh-server git certbot nginx sqlite3 build-essential
```

SSH servisini etkinleştirin:

```bash
sudo systemctl enable ssh
```

## Firewall Ayarları

SSH, HTTP ve HTTPS portlarına izin verin:

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

Kontrol edin:

```bash
sudo ufw status
```

UFW'yi etkinleştirirken SSH bağlantınızı engellemediğinizden emin olun.

## Docker Kurulumu

Docker'ın resmi repository'sini ekleyin:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl

sudo install -m 0755 -d /etc/apt/keyrings

sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc

sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
```

Docker Engine ve Docker Compose'u kurun:

```bash
sudo apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin
```

Kurulumu kontrol edin:

```bash
docker --version
docker compose version
```

## Node.js Kurulumu

NVM'yi kurun:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Shell'i yeniden yükleyin:

```bash
source ~/.bashrc
```

Güncel resmi AR.IO kurulum dokümanında kullanılan Node.js sürümünü kurun:

```bash
nvm install 20.11.1
nvm use 20.11.1
npm install -g yarn@1.22.22
```

Sürümleri kontrol edin:

```bash
node -v
npm -v
yarn -v
```

## AR.IO Node Repository'sini Klonlama

Gateway'i tutacağınız dizine geçin:

```bash
cd ~
```

Resmi repository'yi klonlayın:

```bash
git clone -b main https://github.com/ar-io/ar-io-node
```

Dizine girin:

```bash
cd ar-io-node
```

Gateway veritabanları node verileriyle birlikte tutulur. Ayrı bir SSD veya disk kullanacaksanız gateway büyük bir index oluşturmaya başlamadan önce depolama konumunu planlayın.

## Solana Cüzdanlarını Hazırlama

Güncel AR.IO protokolü Solana kimliklerini kullanır.

Bir operator ve observer adresine ihtiyacınız vardır.

Operator:

```text
AR_IO_WALLET
```

ile tanımlanır.

Observer:

```text
OBSERVER_WALLET
```

ile tanımlanır.

Observer adresi gateway için benzersiz olmalıdır.

Basit bir kurulumda aynı Solana keypair birden fazla gateway rolünde kullanılabilir. Daha güçlü anahtar ayrımı isteyen operatorler observer için ayrı bir keypair kullanabilir.

Private key veya keypair JSON dosyalarını hiçbir zaman paylaşmayın.

## Environment Dosyasını Oluşturma

AR.IO node dizininde:

```bash
nano .env
```

Temel yapılandırma:

```env
GRAPHQL_HOST=turbo-gateway.com
GRAPHQL_PORT=443
START_HEIGHT=1000000

RUN_OBSERVER=true

ARNS_ROOT_HOST=YOUR_DOMAIN

AR_IO_WALLET=YOUR_SOLANA_OPERATOR_PUBLIC_KEY
OBSERVER_WALLET=YOUR_SOLANA_OBSERVER_PUBLIC_KEY

OBSERVER_PRIVATE_KEY=YOUR_OBSERVER_BASE58_PRIVATE_KEY
SOLANA_UPLOAD_PRIVATE_KEY=YOUR_OBSERVER_BASE58_PRIVATE_KEY
```

Aşağıdaki alanları kendi bilgilerinizle değiştirin:

```text
YOUR_DOMAIN
YOUR_SOLANA_OPERATOR_PUBLIC_KEY
YOUR_SOLANA_OBSERVER_PUBLIC_KEY
YOUR_OBSERVER_BASE58_PRIVATE_KEY
```

Gerçek değerleri yazarken `< >` işaretlerini kullanmayın.

### Keypair Dosyası Kullanmak

Inline private key yerine JSON keypair kullanmak istiyorsanız gerekli dosyayı gateway'in `wallets` dizinine yerleştirin.

Ardından:

```env
OBSERVER_PRIVATE_KEY=
SOLANA_UPLOAD_PRIVATE_KEY=
```

satırlarını kullanmayın ve bunun yerine:

```env
OBSERVER_KEYPAIR_PATH=/app/wallets/YOUR_OBSERVER_KEYPAIR.json
SOLANA_UPLOAD_KEYPAIR_PATH=/app/wallets/YOUR_OBSERVER_KEYPAIR.json
```

kullanın.

Aynı rol için hem inline private key hem de keypair path tanımlamayın.

## Cüzdan Dosyalarını Koruma

Private key içeren dosyalar dışarıdan erişilebilir olmamalıdır.

Örneğin:

```bash
chmod 600 wallets/*.json
```

Aşağıdaki dosya ve bilgileri public Git repository'ye göndermeyin:

```text
.env
wallets/
private key
seed phrase
```

## DNS Ayarları

Gateway için bir domaine ihtiyacınız vardır.

Örnek gateway domaini:

```text
gateway.example.com
```

Gateway domainini sunucunun IP adresine yönlendiren A kaydı oluşturun:

```text
gateway.example.com -> SERVER_IP
```

AR.IO, ArNS isimlerinin çözümlenebilmesi için wildcard subdomain desteğine de ihtiyaç duyar.

Ayrıca:

```text
*.gateway.example.com -> SERVER_IP
```

kaydı oluşturun.

Sonuçta:

```text
gateway.example.com
*.gateway.example.com
```

aynı gateway sunucusuna yönlenmelidir.

DNS yayılımının tamamlanmasını bekleyin.

Ana domaini kontrol edin:

```bash
dig +short gateway.example.com
```

Wildcard kaydını kontrol edin:

```bash
dig +short test.gateway.example.com
```

Her ikisi de sunucunuzun IP adresini döndürmelidir.

## Gateway'i Başlatma

AR.IO node dizininde:

```bash
sudo docker compose up -d
```

Container'ları kontrol edin:

```bash
sudo docker compose ps
```

Core loglarını takip edin:

```bash
sudo docker compose logs core -f -n 100
```

Core ve observer loglarını birlikte takip edin:

```bash
sudo docker compose logs core observer -f -n 100
```

Log ekranından çıkmak için:

```text
Ctrl+C
```

kullanın. Bu işlem container'ları durdurmaz.

## Lokal Gateway Kontrolü

Servislerin durumunu kontrol edin:

```bash
sudo docker compose ps
```

Core loglarını inceleyebilirsiniz:

```bash
sudo docker compose logs core -n 100
```

`ARNS_ROOT_HOST` tanımlandığında localhost üzerinden yapılan bazı testler, yapılandırılmış public hostname üzerinden yapılan isteklerle aynı şekilde davranmayabilir. Bu nedenle son doğrulama domain üzerinden yapılmalıdır.

## SSL Sertifikası Alma

AR.IO gateway'in hem ana domain hem de wildcard ArNS subdomainleri için HTTPS desteğine ihtiyacı vardır.

Örneğin:

```text
gateway.example.com
*.gateway.example.com
```

için DNS challenge kullanarak wildcard sertifika alın:

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d gateway.example.com \
  -d '*.gateway.example.com'
```

Certbot sizden bir DNS TXT kaydı oluşturmanızı isteyecektir.

DNS sağlayıcınızda istenen TXT kaydını oluşturun ve devam etmeden önce kaydın internette görünmesini bekleyin.

Kontrol:

```bash
dig TXT _acme-challenge.gateway.example.com
```

Beklenen TXT değeri görünmeden Certbot işlemine devam etmeyin.

### Wildcard Sertifika Yenileme

Manual DNS yöntemiyle alınan wildcard sertifikalar genellikle otomatik olarak yenilenemez.

Production gateway için DNS sağlayıcınızın API'sini kullanan desteklenen bir Certbot DNS plugin veya başka bir ACME otomasyonu tercih edilmelidir.

Sertifikaları kontrol edin:

```bash
sudo certbot certificates
```

Gateway sertifikasının süresinin dolmasına izin vermeyin.

## Nginx Yapılandırması

Nginx yapılandırmasını açın:

```bash
sudo nano /etc/nginx/sites-available/default
```

Aşağıdakine benzer bir yapılandırma kullanın:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name gateway.example.com *.gateway.example.com;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;

    server_name gateway.example.com *.gateway.example.com;

    ssl_certificate /etc/letsencrypt/live/gateway.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gateway.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_http_version 1.1;

        proxy_set_header X-AR-IO-Origin $http_x_ar_io_origin;
        proxy_set_header X-AR-IO-Origin-Node-Release $http_x_ar_io_origin_node_release;
        proxy_set_header X-AR-IO-Hops $http_x_ar_io_hops;
    }
}
```

Buradaki:

```text
gateway.example.com
```

değerini kendi gateway domaininizle değiştirin.

`X-AR-IO-*` header'ları AR.IO gateway iletişimi açısından önemlidir ve proxy yapılandırmasından çıkarılmamalıdır.

## Nginx Yapılandırmasını Test Etme

Reload işleminden önce mutlaka test edin:

```bash
sudo nginx -t
```

Sonuç başarılıysa:

```bash
sudo systemctl reload nginx
```

Servisi kontrol edin:

```bash
sudo systemctl status nginx
```

## HTTPS Kontrolü

Gateway'i kontrol edin:

```bash
curl -I https://gateway.example.com
```

Ardından resmi AR.IO test transaction'ını deneyin:

```bash
curl https://gateway.example.com/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

Beklenen cevap:

```text
1984
```

`1984` cevabını alıyorsanız gateway domain üzerinden Arweave verisini başarıyla sunuyor demektir.

## Gateway Bilgilerini Kontrol Etme

AR.IO bilgi endpoint'ini kontrol edin:

```bash
curl -s https://gateway.example.com/ar-io/info | jq
```

Özellikle wallet ve network bilgilerini kontrol edin.

Solana geçişinden sonra gateway'in hedeflediğiniz network için doğru Solana yapılandırmasını göstermesi gerekir.

## Wildcard / ArNS Kontrolü

Bilinen bir ArNS tarzı subdomain ile kontrol yapabilirsiniz:

```bash
curl -I https://ardrive.gateway.example.com
```

İstek wildcard DNS kaydı ve wildcard SSL sertifikası üzerinden gateway'e ulaşmalıdır.

Ana domain çalışıyor fakat subdomainler çalışmıyorsa şunları kontrol edin:

- wildcard DNS
- wildcard SSL sertifikası
- Nginx `server_name`
- `ARNS_ROOT_HOST`
- gateway logları

## Observer Kontrolü

Observer loglarını takip edin:

```bash
sudo docker compose logs observer -f -n 100
```

Core ve observer servislerini birlikte takip etmek için:

```bash
sudo docker compose logs core observer -f -n 100
```

Observer sorunlarının yaygın nedenleri:

- hatalı Solana wallet yapılandırması
- eksik private key veya keypair
- işlem ücretleri için yetersiz SOL
- upload signer yapılandırması
- Solana RPC bağlantı problemi
- yanlış network yapılandırması

## Faydalı Komutlar

Çalışan container'ları kontrol edin:

```bash
sudo docker compose ps
```

Gateway'i başlatın:

```bash
sudo docker compose up -d
```

Gateway'i durdurun:

```bash
sudo docker compose down
```

Gateway'i yeniden başlatın:

```bash
sudo docker compose restart
```

Core logları:

```bash
sudo docker compose logs core -f -n 100
```

Observer logları:

```bash
sudo docker compose logs observer -f -n 100
```

Nginx kontrolü:

```bash
sudo nginx -t
sudo systemctl status nginx
```

Sertifika kontrolü:

```bash
sudo certbot certificates
```

Disk kullanımı:

```bash
df -h
```

Docker disk kullanımı:

```bash
sudo docker system df
```

## Son Kontrol Listesi

Kurulumu tamamlamadan önce şunları doğrulayın:

- Docker container'ları çalışıyor
- Core servisi sağlıklı
- Observer çalışıyor
- Domain doğru sunucuya yönleniyor
- Wildcard DNS çalışıyor
- HTTPS çalışıyor
- Wildcard HTTPS çalışıyor
- Nginx yapılandırması geçerli
- AR.IO header'ları proxy üzerinden aktarılıyor
- Gateway testi `1984` döndürüyor
- `/ar-io/info` endpoint'i cevap veriyor
- Solana wallet yapılandırması doğru
- Observer için gerekli signing yapılandırması mevcut
- Gerekli protokol işlemleri için cüzdanlarda yeterli SOL bulunuyor

## AR.IO Ağına Katılma

Bir gateway çalıştırmak ile gateway'i AR.IO Gateway Address Registry'ye kaydetmek farklı işlemlerdir.

Production gateway öncelikle şu özelliklerle tamamen çalışır durumda olmalıdır:

- özel domain
- HTTPS
- wildcard ArNS çözümleme
- çalışan gateway istekleri
- doğru Solana wallet yapılandırması

Network registration işlemi güncel sistemde ARIO operator stake ve Solana işlem ücretleri için SOL gerektirir.

Gateway kurulumunu ve kontrollerini tamamladıktan sonra network registration işlemine geçin.
