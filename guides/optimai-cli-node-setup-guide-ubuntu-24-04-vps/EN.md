# OptimAI CLI Node Setup Guide — Ubuntu 24.04 VPS

There are several ways to participate in the OptimAI Network.

- **Lite Node:** Can run in supported Chromium-based browsers such as Chrome, Brave, and Opera.
- **Telegram Node:** Can run through the Telegram Mini App.
- **Core Node Desktop:** Available for Windows, macOS, and Ubuntu Linux.
- **Core Node CLI:** Available for Windows, macOS, Ubuntu Linux, and servers.
- **Edge Node:** Available for iOS and Android devices.

You can run nodes on multiple supported devices using the same OptimAI account.

This guide is intended for users who want to run an **OptimAI Core CLI Node on an Ubuntu 24.04 VPS or server**.

---

## System Requirements

- Ubuntu 22.04 or later
- At least 4 GB RAM
- At least 2 CPU cores
- At least 15 GB of free disk space
- Active internet connection
- Docker
- OptimAI account

---

## 1. Check Docker

```bash
docker --version
```

If the Docker version is displayed, continue to **2. Install OptimAI CLI**.

### If Docker Is Not Installed

Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
```

Start Docker and enable it to start automatically at boot:

```bash
sudo systemctl enable --now docker
```

Add your user to the Docker group:

```bash
sudo usermod -aG docker $USER
```

Activate the new group permissions:

```bash
newgrp docker
```

Check Docker:

```bash
docker ps
```

---

## 2. Install OptimAI CLI

Download the OptimAI CLI:

```bash
curl -L https://cli-node.optimai.network/optimai_cli_ubuntu -o optimai-cli
```

Make it executable:

```bash
chmod +x optimai-cli
```

Move the CLI to `/usr/local/bin`:

```bash
sudo mv optimai-cli /usr/local/bin/optimai-cli
```

Verify the installation:

```bash
optimai-cli --version
```

---

## 3. Sign In to Your OptimAI Account

```bash
optimai-cli auth login
```

- Open the URL displayed in the terminal.
- Sign in to your OptimAI account.
- If the browser redirects to a localhost address, copy the **complete URL** from the address bar.
- Paste the URL into the terminal.

Check your authentication status:

```bash
optimai-cli auth status
```

---

## 4. Start the Node for the First Time

```bash
optimai-cli node start
```

A successful startup may show logs similar to:

```text
Docker daemon is available
Container created and started
Docker container is healthy
Node is running normally. Connected to server, ready for tasks.
```

When a task is assigned, you may see logs similar to:

```text
Assignments fetched: total=1
Successfully crawled ...
assignment submitted successfully
```

`Assignments fetched: total=0` is not an error. It means there is no task assigned to the node at that moment.

---

## 5. Run the Node in the Background — systemd

To make the OptimAI node start automatically after a VPS reboot, create a systemd service:

```bash
sudo nano /etc/systemd/system/optimai.service
```

Add:

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

Save and exit.

---

## 6. Enable the Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable optimai.service
sudo systemctl start optimai.service
```

---

## 7. Check Node Status

Check the service:

```bash
systemctl status optimai.service --no-pager
```

View the latest logs:

```bash
journalctl -u optimai.service -n 40 --no-pager -l
```

Check the Docker container:

```bash
docker ps
```

Verify that the service will start automatically after reboot:

```bash
systemctl is-enabled optimai.service
```

Expected output:

```text
enabled
```

---

## 8. Follow Live Logs

```bash
journalctl -u optimai.service -f
```

Exit with:

```text
Ctrl+C
```

---

## 9. Restart the Node

```bash
sudo systemctl restart optimai.service
```

---

## 10. Rename the Node

To give the node a recognizable name:

```bash
optimai-cli node device rename NODE_NAME
```

For example:

```bash
optimai-cli node device rename VPS-01
```

Using different names makes it easier to identify nodes when running OptimAI on multiple devices.

---

## 11. Check Reward Balance

```bash
optimai-cli rewards balance
```

---

## 12. Update OptimAI CLI

```bash
optimai-cli update
```

---

## 13. Running OptimAI on Multiple Devices

You can run nodes on multiple supported devices using the same OptimAI account.

For example:

- Core Node Desktop on macOS
- Core Node Desktop on Ubuntu
- Core Node Desktop on Windows
- Core Node CLI on a VPS
- Edge Node on a mobile device

Nodes can also run on different devices sharing the same public IP. Each device should comply with OptimAI's current usage and reward rules.

---

## 14. Other OptimAI Node Options

A VPS is not required to participate in OptimAI.

### Core Node Desktop

Available for:

- Windows
- macOS
- Ubuntu Linux

### Lite Node

Can run through supported browsers such as:

- Chrome
- Brave
- Opera

### Telegram Node

Can run through the Telegram Mini App:

```text
@OptimAI_Node_Bot
```

### Edge Node

Available for:

- iOS — App Store
- Android — Google Play

---

## 15. Useful Commands

Start the node:

```bash
optimai-cli node start
```

Check node status:

```bash
optimai-cli node status
```

Check reward balance:

```bash
optimai-cli rewards balance
```

Update the CLI:

```bash
optimai-cli update
```

Restart the service:

```bash
sudo systemctl restart optimai.service
```

Check service status:

```bash
systemctl status optimai.service --no-pager
```

Follow live logs:

```bash
journalctl -u optimai.service -f
```

Check the Docker container:

```bash
docker ps
```

---

## Referral Link

If you want to create an OptimAI account, you can use the referral link below:

https://node.optimai.network/register?ref=18ADBAE8

**Referral code:** `18ADBAE8`

---

## Notes

- `Assignments fetched: total=0` is not an error. It means there is no task available at that moment.
- The node will process new tasks when they become available.
- systemd allows the OptimAI node to start automatically after the VPS reboots.
- Multiple supported devices can run under the same OptimAI account.

# Sorunlar ve Çözümler

## Node Aniden Offline Oluyor / `Not authenticated` Hatası

Çalışmakta olan OptimAI CLI Node bazı durumlarda authentication oturumunu kaybedebilir. Bu durumda node çalışmayı durdurabilir ve systemd servisi node'u yeniden başlatmaya çalışsa bile authentication geçerli olmadığı için başlatma işlemi başarısız olabilir.

Loglarda aşağıdaki mesajlardan biri veya birkaçı görülebilir:

```text
backend unreachable, skipping cycle: Not authenticated. Run `optimai-cli auth login` first.
Authentication lost. Stopping node...
heartbeat failed: Not authenticated. Run `optimai-cli auth login` first.
```

### 1. OptimAI Servisini Durdurun

Öncelikle systemd'nin authentication olmadan sürekli olarak node'u yeniden başlatmaya çalışmasını durdurun:

```bash
systemctl stop optimai
```

### 2. OptimAI Hesabına Yeniden Giriş Yapın

SSH veya uzak VPS ortamında aşağıdaki komutu kullanın:

```bash
optimai-cli auth login --paste
```

Terminal size bir OptimAI giriş bağlantısı verecektir.

Bağlantıyı kendi bilgisayarınızdaki tarayıcıda açın ve OptimAI hesabınıza giriş yapın.

Giriş tamamlandığında ekranda verilen kodu veya callback URL'yi kopyalayarak VPS terminalindeki:

```text
Paste the redirected URL (or just the `code` parameter):
```

satırına yapıştırın ve Enter'a basın.

Başarılı authentication işleminden sonra:

```text
Signed in successfully.
```

mesajını görmelisiniz.

### 3. OptimAI Servisini Yeniden Başlatın

Authentication tamamlandıktan sonra:

```bash
systemctl start optimai
```

### 4. Node Durumunu Kontrol Edin

```bash
optimai-cli node status
```

Sağlıklı çalışan bir node için aşağıdakine benzer bir çıktı görülmelidir:

```text
Node running
Docker: available
```

Systemd servisini de kontrol edin:

```bash
systemctl status optimai --no-pager -l
```

Servisin:

```text
Active: active (running)
```

durumunda olması gerekir.

### 5. OptimAI Loglarını Kontrol Edin

```bash
journalctl -u optimai -n 30 --no-pager -l
```

Sağlıklı bağlantıda aşağıdakine benzer mesajlar görülebilir:

```text
Node is running normally. Connected to server, ready for tasks.
Assignments fetched
Uptime reward earned
```

Görev başarıyla tamamlandığında ayrıca:

```text
assignment ... submitted successfully
```

mesajı görülebilir.

### Authentication Neden Kayboluyor?

OptimAI'nin mevcut resmi dokümantasyonunda CLI authentication oturumunun belirli bir süre sonunda zorunlu olarak sona erdiğine veya node operatörünün aktifliğini kontrol etmek amacıyla periyodik olarak yeniden login yapılmasının gerektiğine dair açık bir bilgi bulunmamaktadır.

Bu nedenle `Authentication lost` durumunun normal ve periyodik bir OptimAI davranışı olduğu varsayılmamalıdır.

Olası nedenler arasında şunlar bulunabilir:

- authentication veya refresh token süresinin dolması,
- mevcut oturumun sunucu tarafında geçersiz kılınması,
- OptimAI authentication/backend altyapısındaki geçici bir değişiklik veya sorun,
- CLI sürümündeki token yenileme mekanizmasıyla ilgili bir problem.

Kesin neden OptimAI tarafından belgelenmediği sürece bunlar olası açıklamalar olarak değerlendirilmelidir.

Önemli olan, `Not authenticated` veya `Authentication lost` hatası görüldüğünde yalnızca systemd servisini yeniden başlatmanın yeterli olmayabileceğidir.

Önce:

```bash
optimai-cli auth login --paste
```

ile authentication yenilenmeli, ardından OptimAI servisi yeniden başlatılmalıdır.

> **Not:** systemd servisi node'u otomatik olarak yeniden başlatabilir ancak geçersiz veya kaybolmuş bir OptimAI authentication oturumunu kendi başına yenileyemez.
