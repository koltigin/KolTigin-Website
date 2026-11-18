---
slug: optimai-cli-node-telegram-monitoring-bot-installation-guide
date: 2026-11-18
coverLogos: ["/assets/images/cover-logos/optimai.svg"]
---

# OptimAI CLI Node Telegram Monitoring Bot Installation Guide

This guide installs Telegram monitoring for an OptimAI Clean Node running through systemd on an Ubuntu VPS. The monitor does not operate your node or sign on your behalf; it tracks node health and the 14-day signature countdown.

## What the monitor reports

- Automatically detected node name and node ID
- Node start time and uptime from systemd
- Docker and `optimai.service` health
- 14-day signature countdown
- Alerts at 7 days, 3 days, 24 hours, 6 hours, and expiry
- A critical alert when the node or Docker stops running

The signature baseline comes from the `ActiveEnterTimestamp` of `optimai.service`. When the node is restarted, the monitor detects the new start time and automatically synchronizes the countdown.

## Requirements

- An active OptimAI CLI node on an Ubuntu VPS using systemd
- Docker running
- The `optimai-cli` command available in PATH
- A Telegram account
- The [OptimAI Telegram Monitor Universal ZIP package](https://koltigin.xyz/downloads/common/optimai-telegram-monitor-universal.zip)

## 1. Create a Telegram bot

1. Open `@BotFather` in Telegram.
2. Send `/newbot`.
3. Choose a display name for the bot.
4. Choose a username ending in `bot`.
5. Save the **HTTP API token** BotFather returns. Treat it like a password and do not share it.

## 2. Find your chat ID

1. Open the new bot and send `/start`.
2. Run the command below in your VPS terminal. The token is requested without echoing it into your terminal history.

```bash
read -rsp 'Telegram bot token: ' TG_TOKEN; echo
curl -s "https://api.telegram.org/bot${TG_TOKEN}/getUpdates"
unset TG_TOKEN
```

3. In the output, copy the number in `"chat":{"id": ... }`. This is your **chat ID**.

To receive notifications in a group, add the bot to the group, send a message in the group, then use that group’s `chat.id` value.

## 3. Verify that the node is ready

```bash
optimai-cli node device
optimai-cli node status
systemctl status optimai.service --no-pager
```

The node should be online, Docker should be available, and `optimai.service` should show `active (running)`.

## 4. Download and install the monitor

### Ubuntu/Linux

This block downloads the ZIP into a temporary directory, extracts it, opens the menu, then deletes both the ZIP and temporary directory when the process ends:

```bash
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
curl -fL -o "$TEMP_DIR/optimai-monitor.zip" "https://koltigin.xyz/downloads/common/optimai-telegram-monitor-universal.zip"
unzip -q "$TEMP_DIR/optimai-monitor.zip" -d "$TEMP_DIR"
sudo bash "$TEMP_DIR/optimai-telegram-monitor-universal/menu.sh"
```

Choose **Türkçe** or **English** in the menu, then choose **Ubuntu/Linux**. The installer automatically validates and reads:

- Device name and node ID through `optimai-cli node device`
- Node start time through `systemctl show optimai.service -p ActiveEnterTimestamp --value`
- Node and Docker health

It asks only for the bot token and chat ID. The installation sends an initial status message to Telegram. If it does not arrive, check the token, chat ID, and VPS internet access.

### macOS

```bash
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
curl -fL -o "$TEMP_DIR/optimai-monitor.zip" "https://koltigin.xyz/downloads/common/optimai-telegram-monitor-universal.zip"
unzip -q "$TEMP_DIR/optimai-monitor.zip" -d "$TEMP_DIR"
bash "$TEMP_DIR/optimai-telegram-monitor-universal/menu.sh"
```

Choose **macOS** from the menu. Do not use `sudo`: the monitor is installed for the current macOS user.

### Windows (PowerShell)

Open PowerShell as a normal user and run:

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

Choose **Windows** from the menu. The last line deletes the downloaded ZIP and temporary folder after the installation finishes.

## 5. Understand the alerts

The daily status message includes the node name, node ID, start time, uptime, and remaining signature time. A critical alert is sent if the node is down or Docker is unavailable.

When the signature deadline approaches, the bot sends reminders. At expiry, manually complete the OptimAI login/signature renewal and restart the node. The monitor detects the new systemd start time during its next check.

## Useful commands

Show the monitor’s current status:

```bash
sudo /usr/local/lib/optimai-telegram-monitor/optimai-telegram-monitor.sh --status
```

Show the node service:

```bash
systemctl status optimai.service --no-pager
```

Show recent node logs:

```bash
journalctl -u optimai.service -n 80 --no-pager -l
```

## Remove the monitor

This removes the 15-minute scheduler and the locally stored token/chat ID configuration from the VPS:

```bash
sudo /usr/local/lib/optimai-telegram-monitor/install-optimai-cli-telegram-monitor.sh --uninstall
```

This does not delete your Telegram bot. To delete the bot entirely, use `/deletebot` in BotFather. If you believe the token was exposed, use `/revoke` in BotFather to rotate it.

macOS removal command:

```bash
~/.local/lib/optimai-telegram-monitor/install-macos-cli-node.sh --uninstall
```

Windows removal command:

```powershell
& "$env:LOCALAPPDATA\OptimAI-Telegram-Monitor\install-windows-cli-node.ps1" -Action Uninstall
```

## Security note

The monitor never requests your seed phrase, private key, or OptimAI account password. Never share those details in Telegram messages, screenshots, or support requests.
