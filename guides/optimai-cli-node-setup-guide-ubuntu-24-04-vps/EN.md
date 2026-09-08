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

# Troubleshooting

## Node Goes Offline / `Not authenticated` Error

If your OptimAI CLI Node stops running and the following errors appear, the authentication session may no longer be valid:

```text
Not authenticated. Run `optimai-cli auth login` first.
Authentication lost. Stopping node...
```

In this situation, repeatedly restarting the systemd service will not solve the problem. You need to authenticate with OptimAI again.

### 1. Stop the OptimAI Service

```bash
systemctl stop optimai
```

### 2. Start the Login Process Again

```bash
optimai-cli auth login --paste
```

### 3. Sign In Using Your Browser

Open the OptimAI login URL displayed in the terminal using a browser on your local computer.

After signing in to your OptimAI account, use **Copy code** to copy the authentication code.

### 4. Paste the Code Into the VPS Terminal

Paste the copied code at the following prompt:

```text
Paste the redirected URL (or just the `code` parameter):
```

Press Enter.

After successful authentication, you should see:

```text
Signed in successfully.
```

### 5. Start the OptimAI Service

```bash
systemctl start optimai
```

### 6. Verify the Service

```bash
systemctl status optimai --no-pager -l
```

A healthy service should show:

```text
Active: active (running)
```

> **Note:** During testing across multiple VPS servers, authentication loss was observed approximately 14 days after the initial node identity was created. However, the current official OptimAI documentation does not explicitly document a 14-day authentication lifetime. Until this behavior is officially confirmed, it should be treated as an observed pattern rather than a confirmed token expiration policy.
