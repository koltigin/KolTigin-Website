---
coverLogos: ["/assets/images/guides/how-to-get-an-arns-domain/cover-logos/ario-logo.svg","/assets/images/cover-logos/cloudflare-white.jpg"]
slug: ar-io-gateway-icin-domain-cloudflare-dns-ve-otomatik-ssl-kurulumu
date: 2026-10-17
title: "AR.IO Gateway için Domain, Cloudflare DNS ve Otomatik SSL Kurulumu"
description: "Mevcut Ubuntu sunucunuzdaki AR.IO gateway'i kendi alan adınızda yayınlamak; Cloudflare DNS ve Let's Encrypt ile wildcard SSL sertifikasını otomatik yenilemek için uygulanabilir rehber."
---

# AR.IO Gateway için Domain, Cloudflare DNS ve Otomatik SSL Kurulumu

AR.IO gateway'inizi kendi alan adınızla yayınlamak için ayrıca klasik web hosting satın almanız gerekmez. Gateway zaten internete açık bir Ubuntu/VPS sunucusunda çalışıyorsa, alan adınızı o sunucuya yönlendirmeniz yeterlidir.

Buradaki önemli ayrım şudur: **Domain tek başına içerik barındırmaz.** Bu rehberde hosting görevini mevcut Ubuntu sunucunuz ve üzerindeki AR.IO gateway üstlenir. Cloudflare ise DNS yönetimi ve Let's Encrypt doğrulaması için kullanılır.

Bu kurulum, örnek olarak `ario.koltigin.xyz` ve `*.ario.koltigin.xyz` için uygulanmış ve yenileme testi başarıyla doğrulanmıştır. Aynı adımları kendi alan adınıza uyarlayabilirsiniz.

## 1. Gerekenler

* Bir domain (`ornekalanadi.com` gibi) — istediğiniz registrar'dan alınmış olabilir.
* İnternete açık IP adresi bulunan, AR.IO gateway ve Nginx çalıştıran Ubuntu sunucusu.
* Cloudflare hesabı.
* Alan adının registrar paneline erişim.

> API token, parola, özel anahtar veya `cloudflare.ini` dosyasını kimseyle paylaşmayın; Git deposuna da eklemeyin.

## 2. Domain'i Cloudflare DNS'e taşıyın

Cloudflare Dashboard'da **Add a site** seçeneğiyle alan adınızı ekleyin. Cloudflare mevcut kayıtları tarar; yine de nameserver değiştirmeden önce tüm kayıtları kontrol edin.

Özellikle şu kayıtları atlamayın:

* Web ve servisler için A / AAAA / CNAME
* E-posta için MX
* SPF, DKIM, DMARC ve servis doğrulamaları için TXT
* Varsa CAA, SRV ve diğer özel kayıtlar

Cloudflare size iki nameserver verir. Registrar panelinde, alan adınızın mevcut nameserver'larını bu iki değerle değiştirin. Bu, domain transferi değildir; domaininiz aynı registrar'da kalır, yalnızca DNS yetkisi Cloudflare'e geçer.

Değişiklik tamamlanınca Cloudflare zone durumu **Active** görünmelidir. Yayılma genellikle kısa sürer; bazı durumlarda 24 saate kadar uzayabilir.

### DNSSEC kullanıyorsanız

Eski DNS sağlayıcısına ait DS kaydı registrar panelinde duruyorsa, nameserver değişiminden önce kaldırın. Cloudflare Active olduktan sonra Cloudflare'ın DNSSEC bölümünü etkinleştirin ve verdiği DS bilgisini registrar paneline ekleyin. Eski DS kaydını bırakmak alan adının hiç çözümlenememesine neden olabilir.

## 3. AR.IO gateway DNS kayıtlarını oluşturun

Cloudflare → DNS → Records bölümünde aşağıdaki kayıtları ekleyin. `SUNUCU_IPV4` yerine Ubuntu sunucunuzun genel IP adresini yazın.

| Tür | Ad | Hedef | Proxy durumu |
|---|---|---|---|
| A | `ario` | `SUNUCU_IPV4` | DNS only |
| A | `*.ario` | `SUNUCU_IPV4` | DNS only |
| AAAA | `ario` | `SUNUCU_IPV6` | DNS only — yalnız IPv6 gerçekten çalışıyorsa |
| AAAA | `*.ario` | `SUNUCU_IPV6` | DNS only — yalnız IPv6 gerçekten çalışıyorsa |

Bu örnekte sonuç `ario.ornekalanadi.com` ve tüm alt alan adlarının (`x.ario.ornekalanadi.com`) aynı sunucuya yönlenmesidir.

Başlangıçta kayıtları **DNS only** (gri bulut) bırakın. Böylece bağlantı doğrudan Nginx/sunucunuza gelir ve AR.IO gateway davranışını ek proxy katmanı olmadan doğrularsınız. Cloudflare proxy'sini daha sonra, yalnız HTTP(S) trafiği ve uygulama uyumluluğu test edildiyse açabilirsiniz.

E-posta kayıtları için Cloudflare proxy kullanılmaz: MX ve ilgili e-posta hedefleri DNS only kalmalıdır.

## 4. Wildcard SSL sertifikasını otomatikleştirin

Wildcard sertifikası (`*.ario.ornekalanadi.com`) için DNS-01 doğrulaması gerekir. Ubuntu 24.04 üzerinde gerekli araçları kurun:

```bash
apt update
apt install -y certbot python3-certbot-dns-cloudflare
```

Cloudflare'da yalnızca kendi zone'unuz için sınırlı bir API token oluşturun:

* Permission: **Zone / DNS / Edit**
* Zone Resources: yalnız ilgili alan adı

Token'ı güvenli bir dosyaya kaydedin:

```bash
install -d -m 700 /root/.secrets/certbot
nano /root/.secrets/certbot/cloudflare.ini
```

Dosya içeriği yalnızca şu biçimde olmalıdır:

```ini
dns_cloudflare_api_token = TOKEN_BURAYA
```

Dosyayı root dışındaki kullanıcılara kapatın:

```bash
chmod 600 /root/.secrets/certbot/cloudflare.ini
```

Sertifikayı alın:

```bash
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/certbot/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 60 \
  -d ario.ornekalanadi.com \
  -d '*.ario.ornekalanadi.com'
```

Nginx yapılandırmanız sertifikayı şu dosyalardan kullanmalıdır:

```nginx
ssl_certificate     /etc/letsencrypt/live/ario.ornekalanadi.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/ario.ornekalanadi.com/privkey.pem;
```

Değişiklikten sonra önce Nginx'i test edin, sonra yeniden yükleyin:

```bash
nginx -t && systemctl reload nginx
```

## 5. Yenileme sonrası Nginx'i otomatik yeniden yükleyin

Certbot sertifikayı yenilediğinde Nginx'in yeni dosyaları alması gerekir. Bir deploy hook oluşturun:

```bash
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/bin/sh
set -e
nginx -t >/dev/null 2>&1
systemctl reload nginx
EOF

chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Ubuntu'nun Certbot zamanlayıcısını etkinleştirin:

```bash
systemctl enable --now certbot.timer
systemctl status certbot.timer
```

Son olarak tüm zinciri gerçek sertifika tüketmeden test edin:

```bash
/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
echo "Exit code: $?"

certbot renew --dry-run --run-deploy-hooks
```

Başarılı kurulumda hook için `Exit code: 0` görünür; dry-run sonucunda da `all simulated renewals succeeded` mesajı alınır.

## 6. Eski manual Certbot kurulumlarından geçiş notu

Sertifika daha önce `--manual` yöntemiyle alınmışsa otomatik yenilenmez. Bu durumda yenileme yapılandırmasını `dns-cloudflare` authenticator'ına geçirmeniz gerekir. `--force-renewal` yalnızca bu tür geçiş veya onarım durumlarında kullanılmalıdır; rutin bakım adımı değildir ve gereksiz kullanımı Let's Encrypt oran sınırlarına takılabilir.

## 7. Son kontrol listesi

* Cloudflare zone durumu Active.
* `ario` ve `*.ario` kayıtları doğru IP'ye, DNS only olarak çözülüyor.
* `cloudflare.ini` dosyasının izni `600`.
* Nginx `nginx -t` testinden geçiyor.
* `certbot.timer` etkin.
* `certbot renew --dry-run --run-deploy-hooks` başarıyla tamamlanıyor.

Bu kontroller tamamlandığında domain, mevcut AR.IO gateway sunucunuza yönlenir; ek bir shared hosting hizmetine ihtiyaç kalmaz ve SSL yenilemesi otomatik yürür.
