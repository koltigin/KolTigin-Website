# AIOZ DePIN CLI v1.2.6 Kurulum Rehberi

> Ubuntu tabanlı x86_64 (amd64) bilgisayar ve VPS sunucuları için Türkçe
> kurulum rehberi.

Bu rehber, AIOZ DePIN CLI v1.2.6’nın kurulmasını, ilk node anahtarının
oluşturulmasını, node’un test edilmesini ve `systemd` ile arka planda
otomatik çalıştırılmasını anlatır.

> **Güvenlik:** `privkey.json` dosyanızı ve kurtarma kelimelerinizi
> (mnemonic) hiç kimseyle paylaşmayın. Ana cüzdanınızın özel anahtarını
> node sunucusunda kullanmayın.

## 1. Gerekli paketleri kurun

``` bash
sudo apt update
sudo apt install -y curl tar
```

VPS üzerinde `root` kullanıcısı ile kurulum:

``` bash
mkdir -p /root/aioz
cd /root/aioz
```

## 2. AIOZ DePIN CLI v1.2.6’yı indirin

``` bash
cd /root/aioz
curl -LO https://github.com/AIOZNetwork/aioz-depin-cli/releases/download/v1.2.6/aioz-depin-linux-amd64-1.2.6.tar.gz
tar -xzf aioz-depin-linux-amd64-1.2.6.tar.gz
mv aioz-depin-cli-linux-amd64 aioz-depin-cli
chmod +x aioz-depin-cli
./aioz-depin-cli version
```

Beklenen sürüm:

``` text
1.2.6
```

## 3. Yeni node anahtarı oluşturun

Bu adımı yalnızca yeni bir node oluşturuyorsanız uygulayın:

``` bash
cd /root/aioz
./aioz-depin-cli keytool new --save-priv-key privkey.json
chmod 600 /root/aioz/privkey.json
```

`privkey.json` dosyasını ve kurtarma kelimelerini güvenli, tercihen
çevrimdışı ve şifreli bir ortamda yedekleyin.

### Mevcut anahtar kullanılacaksa

Yeni anahtar oluşturmayın. Mevcut `privkey.json` dosyanızı:

``` text
/root/aioz/privkey.json
```

konumuna yerleştirin ve izinlerini sınırlandırın:

``` bash
chmod 600 /root/aioz/privkey.json
```

## 4. Node’u ilk kez çalıştırın

``` bash
cd /root/aioz

./aioz-depin-cli start \
  --home /root/aioz/depin-data \
  --priv-key-file /root/aioz/privkey.json
```

Node’un sorunsuz çalıştığını gördükten sonra manuel testi `Ctrl+C` ile
sonlandırabilirsiniz.

## 5. systemd servisini oluşturun

``` bash
sudo nano /etc/systemd/system/aioz-depin.service
```

Aşağıdaki içeriği ekleyin:

``` ini
[Unit]
Description=AIOZ DePIN Node
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/aioz
ExecStart=/root/aioz/aioz-depin-cli start --home /root/aioz/depin-data --priv-key-file /root/aioz/privkey.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Nano’da kaydetmek için `Ctrl+O`, `Enter`, ardından `Ctrl+X` kullanın.

## 6. Servisi etkinleştirin ve başlatın

``` bash
sudo systemctl daemon-reload
sudo systemctl enable --now aioz-depin.service
```

Kontrol:

``` bash
systemctl status aioz-depin.service --no-pager -l
systemctl is-enabled aioz-depin.service
systemctl is-active aioz-depin.service
```

Beklenen durum:

``` text
enabled
active
```

## 7. Logları görüntüleyin

Canlı loglar:

``` bash
journalctl -u aioz-depin.service -f
```

Son 100 kayıt:

``` bash
journalctl -u aioz-depin.service -n 100 --no-pager
```

`journalctl -f` ekranından `Ctrl+C` ile çıkmak node’u durdurmaz.

## 8. Node’un çalışma durumunu kontrol edin

``` bash
pgrep -af 'aioz-depin|aioz'
```

Node istatistikleri:

``` bash
cd /root/aioz
./aioz-depin-cli stats
```

## 9. Servis yönetimi

``` bash
sudo systemctl start aioz-depin.service
sudo systemctl stop aioz-depin.service
sudo systemctl restart aioz-depin.service
systemctl status aioz-depin.service --no-pager -l
```

## 10. Otomatik başlatmayı kontrol edin

``` bash
systemctl is-enabled aioz-depin.service
```

Çıktı `enabled` ise servis sistem açılışında otomatik başlatılır.

## 11. Depolama sınırını ayarlayın

Örneğin 1000 GB:

``` bash
cd /root/aioz

./aioz-depin-cli storage limit 1000 \
  --priv-key-file /root/aioz/privkey.json
```

Değeri sunucunuzun disk kapasitesi ve kullanılabilir alanına göre
belirleyin.

## 12. Ödül bakiyesini kontrol edin

``` bash
cd /root/aioz

./aioz-depin-cli reward balance \
  --priv-key-file /root/aioz/privkey.json
```

## 13. Hızlı çalışma durumu kontrolü

``` bash
echo "=== SUNUCU ==="
hostname

echo "=== AIOZ SERVİS DURUMU ==="
systemctl status aioz-depin.service --no-pager -l

echo "=== AIOZ SÜREÇLERİ ==="
pgrep -af 'aioz-depin|aioz'

echo "=== AIOZ CLI SÜRÜMÜ ==="
/root/aioz/aioz-depin-cli version
```

## 14. Sorun giderme

``` bash
journalctl -u aioz-depin.service -n 100 --no-pager
ls -lah /root/aioz
ls -l /root/aioz/aioz-depin-cli
ls -l /root/aioz/privkey.json
```

Çalıştırma izni gerekirse:

``` bash
chmod +x /root/aioz/aioz-depin-cli
```

Servis dosyasında değişiklik yaptıysanız:

``` bash
sudo systemctl daemon-reload
sudo systemctl restart aioz-depin.service
```

## 15. Standart kurulum yapısı

``` text
/root/aioz
/root/aioz/aioz-depin-cli
/root/aioz/privkey.json
/root/aioz/depin-data
/etc/systemd/system/aioz-depin.service
```

## Güvenlik önerileri

- `privkey.json` ve kurtarma kelimelerinizi paylaşmayın.
- Mümkünse her node için ayrı bir anahtar kullanın.
- Ana cüzdanınızın özel anahtarını node sunucusunda saklamayın.
- Anahtarların çevrimdışı ve şifreli yedeğini bulundurun.
- Sunucunun ele geçirildiğinden şüpheleniyorsanız sunucuda bulunan özel
  anahtarları güvenilir kabul etmeyin.
- Bilmediğiniz script veya çalıştırılabilir dosyaları `root` yetkisiyle
  çalıştırmayın.
- AIOZ yazılımını yalnızca resmi kaynaklardan indirin.

## Resmî kaynaklar

- AIOZ DePIN CLI: https://github.com/AIOZNetwork/aioz-depin-cli
- AIOZ Network: https://aioz.network/

------------------------------------------------------------------------

**Rehber tarihi:** 29 Ağustos 2026  
**AIOZ DePIN CLI:** v1.2.6

> Bu rehber topluluk tarafından hazırlanmıştır ve resmî AIOZ Network
> dokümantasyonu değildir.
