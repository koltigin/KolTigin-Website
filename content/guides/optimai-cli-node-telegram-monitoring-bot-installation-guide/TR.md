---
slug: optimai-cli-node-telegram-izleme-botu-kurulum-rehberi
date: 2026-11-18
coverLogos: ["/assets/images/cover-logos/optimai.svg"]
---

# OptimAI CLI Node Telegram İzleme Botu Kurulum Rehberi

Bu rehber, Ubuntu VPS üzerinde systemd ile çalışan OptimAI Clean Node için Telegram bildirimlerini kurar. Monitor node’u veya imzayı sizin yerinize çalıştırmaz; node sağlığını ve 14 günlük imza geri sayımını izler.

## Botun bildirdikleri

- Otomatik alınan node adı ve node ID
- Node’un systemd üzerinden başlangıç tarihi ve çalışma süresi
- Docker ve `optimai.service` sağlığı
- 14 günlük imza geri sayımı
- 7 gün, 3 gün, 24 saat, 6 saat ve süre dolum uyarıları
- Node veya Docker çalışmayı durdurduğunda kritik uyarı

İmza başlangıcı `optimai.service` için `ActiveEnterTimestamp` değerinden alınır. Node yeniden başlatıldığında monitor yeni başlangıç zamanını görür ve geri sayımı otomatik eşitler.

## Gereksinimler

- Ubuntu VPS ve systemd ile çalışan aktif OptimAI CLI node
- Docker’ın çalışıyor olması
- `optimai-cli` komutunun PATH içinde olması
- Telegram hesabı
- [OptimAI Telegram Monitor Universal ZIP paketi](https://koltigin.xyz/downloads/common/optimai-telegram-monitor-universal.zip)

## 1. Telegram botunu oluşturun

1. Telegram’da `@BotFather` hesabını açın.
2. `/newbot` yazın.
3. Bot için görüntülenen bir ad belirleyin.
4. Kullanıcı adı belirleyin; kullanıcı adı `bot` ile bitmelidir.
5. BotFather’ın verdiği **HTTP API token** değerini güvenli bir yere kaydedin. Bu değer `123456789:AA...` biçimindedir. Botun kullanıcı adını (`@ornek_bot`) veya sayısal bot ID’sini girmeyin. Token bir şifre gibidir; kimseyle paylaşmayın.

## 2. Monitorü indirin ve kurun

### Ubuntu/Linux

Aşağıdaki blok ZIP’i geçici klasöre indirir, açar, menüyü başlatır ve işlem bittiğinde ZIP ile geçici klasörü siler:

```bash
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
curl -fL -o "$TEMP_DIR/optimai-monitor.zip" "https://koltigin.xyz/downloads/common/optimai-telegram-monitor-universal.zip"
unzip -q "$TEMP_DIR/optimai-monitor.zip" -d "$TEMP_DIR"
sudo bash "$TEMP_DIR/optimai-telegram-monitor-universal/menu.sh"
```

Menüde önce **Türkçe** veya **English**, ardından **Ubuntu/Linux** seçilir. Script şunları otomatik doğrular ve alır:

- `Device` ve node ID: `optimai-cli node device`
- Node başlangıcı: `systemctl show optimai.service -p ActiveEnterTimestamp --value`
- Node/Docker sağlığı

Script yalnızca bot token’ını ister. Ardından Telegram’da botunuza `/start` göndermenizi ister ve chat ID’nizi otomatik alır. Node, Docker, node adı/ID ve servis başlangıcı da script tarafından doğrulanır. Kurulum sonunda Telegram’a ilk durum mesajı gelir.

Kurulum sırasında düzenli durum özeti sıklığı seçilir: **15 dakika, 30 dakika, 1 saat, 12 saat veya 24 saat**. Node/imza kritik uyarıları seçilen özet sıklığından bağımsız olarak en geç 15 dakika içinde kontrol edilir.

### macOS

```bash
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
curl -fL -o "$TEMP_DIR/optimai-monitor.zip" "https://koltigin.xyz/downloads/common/optimai-telegram-monitor-universal.zip"
unzip -q "$TEMP_DIR/optimai-monitor.zip" -d "$TEMP_DIR"
bash "$TEMP_DIR/optimai-telegram-monitor-universal/menu.sh"
```

Menüden **macOS** seçilir. Bu komutu `sudo` ile çalıştırmayın; monitor mevcut macOS kullanıcısına kurulur.

### Windows (PowerShell)

PowerShell’i normal kullanıcı olarak açın ve aşağıdaki komutları çalıştırın:

```powershell
$TempDir = Join-Path $env:TEMP ("optimai-monitor-" + [guid]::NewGuid())
try {
  New-Item -ItemType Directory -Path $TempDir | Out-Null
  Invoke-WebRequest "https://koltigin.xyz/downloads/common/optimai-telegram-monitor-universal.zip" -OutFile "$TempDir\optimai-monitor.zip"
  Expand-Archive "$TempDir\optimai-monitor.zip" -DestinationPath $TempDir
  Set-ExecutionPolicy -Scope Process Bypass
  & "$TempDir\optimai-telegram-monitor-universal\menu.ps1"
} finally {
  Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}
```

Menüden **Windows** seçilir. Son satır kurulum tamamlandıktan sonra indirilen ZIP ve geçici klasörü siler.

## 5. Bildirimleri okuyun

Seçilen sıklıktaki durum özeti; node adını, node ID’yi, node başlangıcını, çalışma süresini ve imzaya kalan zamanı içerir. Node kapalıysa veya Docker erişilemezse kritik bildirim gönderilir.

İmza zamanı yaklaştığında bot hatırlatır. Süre dolduğunda manuel olarak OptimAI giriş/imza yenilemesini tamamlayın ve node’u yeniden başlatın. Monitor yeni systemd başlangıç zamanını sonraki kontrolde algılar.

## Yararlı komutlar

Anlık monitor durumu:

```bash
sudo /usr/local/lib/optimai-telegram-monitor/optimai-telegram-monitor.sh --status
```

Özet sıklığını sonradan değiştirmek için:

```bash
sudo /usr/local/lib/optimai-telegram-monitor/optimai-telegram-monitor.sh --set-interval
```

Node servisi:

```bash
systemctl status optimai.service --no-pager
```

Son node günlükleri:

```bash
journalctl -u optimai.service -n 80 --no-pager -l
```

## Monitorü kaldırma

Bu komut arka plan kontrol zamanlayıcısını ve VPS’te saklanan token/chat ID yapılandırmasını kaldırır:

```bash
sudo /usr/local/lib/optimai-telegram-monitor/install-optimai-cli-telegram-monitor.sh --uninstall
```

Bu işlem Telegram bot hesabını silmez. Botu tamamen silmek için BotFather’da `/deletebot` kullanın. Token’ın sızdığını düşünüyorsanız BotFather’da `/revoke` ile token’ı yenileyin.

macOS kaldırma komutu:

```bash
~/.local/lib/optimai-telegram-monitor/install-macos-cli-node.sh --uninstall
```

Windows kaldırma komutu:

```powershell
& "$env:LOCALAPPDATA\OptimAI-Telegram-Monitor\install-windows-cli-node.ps1" -Action Uninstall
```

## Güvenlik notu

Monitor seed phrase, özel anahtar veya OptimAI hesap parolanızı istemez. Bu bilgileri hiçbir Telegram mesajında, ekran görüntüsünde veya destek talebinde paylaşmayın.
