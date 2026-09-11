# Redbelly Mainnet Telegram Monitoring Bot Installation Guide

This guide explains how to install the KolTigin Redbelly Monitor to automatically monitor your Redbelly Mainnet node through Telegram.

The monitor checks your node at the interval you choose and automatically sends a status report to Telegram.

The report includes:

- Node synchronization status
- `redbelly.service` status
- Current role: Governor / Candidate
- Next-round role
- Node block height
- Redbelly Mainnet network block height
- Block difference
- Superblock
- Recovery status
- Redbelly node version
- SSL certificate status and remaining validity
- CPU load
- RAM usage
- Disk usage

The installation uses a systemd service and timer. No cron configuration is required.

---

## 1. Create a Telegram Bot

Open **@BotFather** on Telegram.

Send:

```text
/newbot
```

BotFather will ask for:

1. A bot name
2. A bot username

The username must end in `bot`.

Example:

```text
My Redbelly Monitor
my_redbelly_monitor_bot
```

After the bot is created, BotFather will provide a **Bot Token**.

Example format:

```text
1234567890:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Keep this token private. Do not share it.

---

## 2. Get Your Chat ID

Open your newly created Telegram bot and send:

```text
/start
```

Then run the following command on your server.

Replace `YOUR_BOT_TOKEN` with the token provided by BotFather:

```bash
curl -s "https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates" | jq
```

Find a section similar to:

```json
"chat": {
  "id": 123456789,
  "type": "private"
}
```

The value:

```text
123456789
```

is your **Chat ID**.

> If `result` is empty, send another message to your bot in Telegram and run the command again.

---

## 3. Download and Install Redbelly Monitor

Switch to the root user:

```bash
sudo -i
```

Run the following command as one block:

```bash
cd /root && \
curl -fsSL https://koltigin.xyz/downloads/redbelly/redbelly-monitor.sh -o redbelly-monitor.sh && \
chmod +x redbelly-monitor.sh && \
./redbelly-monitor.sh
```

The installer first displays the language selection:

```text
1) Türkçe
2) English

Dil / Language [1]:
```

For English select:

```text
2
```

The installer will then ask for:

```text
🤖 Telegram Bot Token:
💬 Telegram Chat ID:
🌐 Redbelly node domain (e.g. node.example.com):
⏱ How often should Telegram messages be sent, in minutes? [30]:
```

### Bot Token

Enter the token provided by BotFather.

### Chat ID

Enter the Chat ID obtained in the previous step.

### Node domain

Enter the registered domain name of your Redbelly node.

Example:

```text
node.example.com
```

### Message interval

Choose how often the node status report should be sent to Telegram.

The default is:

```text
30
```

minutes.

Press Enter to keep the default value.

---

## 4. Telegram Connection Test

The installer first verifies the Telegram Bot Token and Chat ID.

If the test succeeds, Telegram receives:

```text
✅ Redbelly Telegram Monitor connection test successful.
```

The installer then creates the monitor, configuration file and systemd timer.

After installation, the first full node status report is automatically sent.

---

## 5. Telegram Node Report

After a successful installation, Telegram will receive a report similar to:

```text
🧾 Redbelly Mainnet Node

📊 Status: ✅ Synchronized
⚙️ Service: ✅ Active
🏛 Role: ⚪ Candidate
🔄 Next Round: ⚪ Candidate
📦 Node Block: ...
🌐 Network Block: ...
📉 Difference: ...
🔷 Superblock: ...
♻️ Recovery: ✅ Complete
🧩 Version: ...
🔐 Certificate: ✅ Valid
🕒 Time: ...

💻 Server
🧠 CPU Load: ...
🗂 RAM: ...
💽 Disk: ...
```

### Governor / Candidate

`Role` shows the node's current role in the Redbelly reconfiguration round.

`Next Round` shows the role reported by the node logs for the next round.

---

## 6. Check the Timer

The monitor runs automatically through a systemd timer.

Check its status with:

```bash
systemctl status redbelly-telegram-monitor.timer
```

To see the next scheduled execution:

```bash
systemctl list-timers redbelly-telegram-monitor.timer
```

The timer should be `active`.

---

## 7. Send a Manual Report

To send a new Telegram report without waiting for the next scheduled run:

```bash
systemctl start redbelly-telegram-monitor.service
```

To inspect monitor logs:

```bash
journalctl -u redbelly-telegram-monitor.service -n 50 --no-pager
```

---

## 8. Monitor Files

The installer creates:

```text
/usr/local/bin/redbelly-telegram-monitor
/etc/redbelly-telegram-monitor.conf
/etc/systemd/system/redbelly-telegram-monitor.service
/etc/systemd/system/redbelly-telegram-monitor.timer
```

The Telegram Bot Token is stored in:

```text
/etc/redbelly-telegram-monitor.conf
```

Do not share this file.

---

## 9. Uninstall the Monitor

From the directory containing the installer, run:

```bash
sudo ./redbelly-monitor.sh --uninstall
```

The installer removes:

- the systemd timer
- the monitor service
- the monitor executable
- the configuration file

It does **not** remove your Redbelly node or blockchain data.

---

## 10. Update the Script

When a newer `redbelly-monitor.sh` version is published on KolTigin, download the latest installer with:

```bash
cd /root
curl -fsSL https://koltigin.xyz/downloads/redbelly/redbelly-monitor.sh -o redbelly-monitor.sh
chmod +x redbelly-monitor.sh
```

Then run it again:

```bash
sudo ./redbelly-monitor.sh
```

---

## Quick Commands

Timer status:

```bash
systemctl status redbelly-telegram-monitor.timer
```

Next scheduled run:

```bash
systemctl list-timers redbelly-telegram-monitor.timer
```

Manual report:

```bash
systemctl start redbelly-telegram-monitor.service
```

Monitor logs:

```bash
journalctl -u redbelly-telegram-monitor.service -n 50 --no-pager
```

Uninstall:

```bash
sudo ./redbelly-monitor.sh --uninstall
```

---

**Download**

```text
https://koltigin.xyz/downloads/redbelly/redbelly-monitor.sh
```
