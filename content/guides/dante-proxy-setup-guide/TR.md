---
slug: dante-proxy-kurulum-rehberi
date: 2026-11-18
coverLogos: ["/assets/images/cover-logos/dante-socks-proxy-logo.svg"]
---

# Dante Proxy Kurulum Rehberi

> Ev internet IP'niz değiştiğinde Dante proxy erişimini ve yalnızca gerekli UFW iznini güvenle güncelleyen rehber.

## Amaç

`update-dante-ip.sh`, evinizin güncel genel IPv4 adresini seçtiğiniz 1–6 sunucudaki Dante yapılandırmasına uygular. UFW değişikliği yalnızca özel yapılandırma dosyanızda belirlediğiniz hedef sunucuda, yalnızca TCP `33534` için yapılır; listedeki diğer sunucuların UFW yapılandırmasına dokunulmaz.

## Çalışma ortamı

Aynı `update-dante-ip.sh` betiği tüm platformlarda kullanılır; ayrı Windows betiği yoktur.

- **macOS / Linux:** Terminal uygulamasını açın.
- **Windows:** Önce [Git for Windows](https://git-scm.com/download/win) kurun, ardından Başlat menüsünden **Git Bash** açın. Bu komutları PowerShell veya Komut İstemi'nde değil Git Bash içinde çalıştırın.

## Kurulum

1. Betiği indirin ve çalıştırma izni verin:

   ```bash
   curl -fL https://koltigin.xyz/downloads/common/update-dante-ip.sh -o ~/update-dante-ip.sh
   chmod 700 ~/update-dante-ip.sh
   ```

2. Betiğin kurulum sihirbazını başlatın:

   ```bash
   ~/update-dante-ip.sh --setup
   ```

3. Sihirbaz önce kaç sunucu eklemek istediğinizi sorar; `1` ile `6` arasında seçim yapabilirsiniz. Ardından yalnız seçtiğiniz sayı kadar sunucu adresi, SSH kullanıcı adı, UFW güncellemesi yapılacak sunucunun numarası ve Dante portu sorulur. Bilgileri sorulara yanıtlayarak girin; yapılandırma kodu yazmanız gerekmez. Dosya yalnız bilgisayarınızda `~/.config/dante-update/servers.conf` yolunda, izinleri kısıtlanmış biçimde tutulur. Web sitenize veya Git deponuza yüklemeyin.

## Güvenli ilk çalıştırma

Kullanıcı sadece `~/update-dante-ip.sh` çalıştırırsa önce Türkçe/English seçimi, ardından şu menü gösterilir: kurulum/düzenleme, güvenli ön denetim, IP güncelleme veya çıkış. Önce hiçbir değişiklik yapmayan denetimi çalıştırın:

```bash
~/update-dante-ip.sh --check
```

Bu denetim genel IPv4 adresinizi algılar, seçtiğiniz tüm sunucuların SSH/Dante erişimini ve hedef sunucuda UFW'nin etkin olduğunu doğrular. Başarılı olursa güncellemeyi çalıştırın:

```bash
~/update-dante-ip.sh
```

Betik Terminal/Git Bash içinde çalıştığında önce Türkçe veya English seçimi sorar. Seçimi atlamak için `--lang tr` veya `--lang en` kullanabilirsiniz; zamanlanmış otomatik çalıştırmalarda varsayılan İngilizcedir.

## Sonucu doğrulama

```bash
source ~/.config/dante-update/servers.conf
ssh "$TARGET_HOST" 'ufw status numbered; systemctl is-active danted; grep -A6 "# home-auto" /etc/danted.conf'
```

Beklenen sonuçlar:

- UFW, güncel ev IP'nizden `33534/tcp` erişimine izin verir.
- Kuralda `dante-home-auto` açıklaması bulunur.
- `danted` durumu `active` olur.
- Seçtiğiniz tüm sunucularda `# home-auto` bloğundaki `from:` satırı güncel IP'nizi `/32` ile içerir.

## Güvenlik ve geri alma

- Her değiştirilmiş Dante dosyası sunucuda yedeklenir; servis yeniden başlamazsa betik yedeği geri yüklemeyi dener.
- Betik sadece kendi `dante-home-auto` etiketli eski UFW kurallarını kaldırır; el ile eklenmiş kuralları silmez.
- UFW devre dışıysa betik onu kendiliğinden etkinleştirmez ve işlem yapmadan durur.
- Sunucu adresleriniz yalnızca yerel, izinleri kısıtlanmış yapılandırma dosyasında kalır.


