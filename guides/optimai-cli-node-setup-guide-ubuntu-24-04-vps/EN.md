# OptimAI CLI Node Setup Guide — Ubuntu 24.04 VPS

There are several ways to participate in the OptimAI Network. Depending on your technical experience and the device you want to use, you can run a Lite Node, Telegram Node, Core Node Desktop, Core Node CLI, or Edge Node.

- **Lite Node:** Available through supported Chromium-based browsers such as Chrome, Brave, and Opera.
- **Telegram Node:** Available through the Telegram Mini App.
- **Core Node Desktop:** Available for Windows, macOS, and Ubuntu Linux.
- **Core Node CLI:** Available for Windows, macOS, Ubuntu Linux, and servers.
- **Edge Node:** Available for iOS and Android devices.

OptimAI allows users to run nodes on multiple supported devices under the same account, provided they comply with the network's account, task, and reward rules.

This guide is specifically intended for users who want to run an **OptimAI Core CLI Node on an Ubuntu 24.04 VPS or server**.

> **Note:** OptimAI is under active development. Node software, commands, and network behavior may change over time. Check the latest OptimAI documentation before installation.

---

## System Requirements

Basic requirements for an OptimAI Core Node:

- Ubuntu 22.04 or later
- At least 4 GB RAM
- At least 2 CPU cores
- At least 15 GB of free disk space
- Active internet connection
- Docker Engine
- OptimAI account

This guide was prepared for Ubuntu 24.04.

---

## 1. Check Docker

First, confirm that Docker is installed:

```bash
docker --version
```

Check whether the Docker service is running:

```bash
systemctl status docker --no-pager
```

If Docker is installed and running, you can skip directly to **2. Install OptimAI CLI**.

### If Docker Is Not Installed

If Docker is not installed, follow the steps below to install Docker Engine on Ubuntu 24.04.

First, update the existing packages:

```bash
sudo apt update
sudo apt upgrade -y
```

Install the packages required to use Docker's official repository:

```bash
sudo apt install -y ca-certificates curl
```

Create the directory for Docker's GPG key:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
```

Download Docker's official GPG key:

```bash
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
```

Make sure the key is readable:

```bash
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

Add Docker's official APT repository:

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Update the package list again:

```bash
sudo apt update
```

Install Docker Engine, Docker CLI, containerd, Buildx, and the Docker Compose plugin:

```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Enable Docker and start it immediately:

```bash
sudo systemctl enable --now docker
```

Verify the installation:

```bash
docker --version
```

Check the Docker service:

```bash
systemctl status docker --no-pager
```

Finally, test that Docker can successfully run a container:

```bash
sudo docker run --rm hello-world
```

If you see the `Hello from Docker!` message, Docker has been installed successfully.

> **Note:** This guide runs the OptimAI systemd service as the `root` user, so adding another user to the `docker` group is not required for this setup.

---

## 2. Install OptimAI CLI

Download the current OptimAI CLI binary for Ubuntu:

```bash
curl -L https://cli-node.optimai.network/optimai_cli_ubuntu -o optimai-cli
```

Make it executable:

```bash
chmod +x optimai-cli
```

Move it to a system-wide executable location:

```bash
sudo mv optimai-cli /usr/local/bin/optimai-cli
```

Verify the installation:

```bash
optimai-cli --help
```

If supported by your CLI version, you can also check the version:

```bash
optimai-cli --version
```

---

## 3. Sign In to Your OptimAI Account

Start the authentication process:

```bash
optimai-cli auth login
```

The CLI may provide a URL that must be opened in your browser.

1. Open the URL displayed in the terminal.
2. Sign in to your OptimAI account.
3. Complete the authorization process.
4. Follow any additional instructions displayed by the CLI.

If the normal browser login does not work, you can try the supported legacy login method:

```bash
optimai-cli auth login --legacy
```

If supported by your CLI version, check your authentication status with:

```bash
optimai-cli auth status
```

---

## 4. Start the Node for the First Time

Start the node:

```bash
optimai-cli node start
```

Check its status from another terminal:

```bash
optimai-cli node status
```

Core Node requires Docker for its workloads, so Docker must remain running.

Periods without assigned tasks are not necessarily an error. Task availability and rewards depend on current network workload and network rules.

If the node is running in the foreground, stop it with:

```text
Ctrl+C
```

---

## 5. Check Reward Balance

Check your reward balance with:

```bash
optimai-cli rewards balance
```

Rewards are not necessarily based on activity or device count alone. Factors such as completed tasks, result quality, validation accuracy, uptime, resource contribution, campaign demand, and node reputation may be considered.

---

## 6. Update the CLI

Use the supported CLI update mechanism:

```bash
optimai-cli update
```

Keeping the CLI and node software updated is recommended for new task types, bug fixes, and security improvements.

---

## 7. Run the Node in the Background with systemd

On a VPS, you will usually want the node to continue running after your SSH session ends and automatically start again after a server reboot.

Create a systemd service:

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

> This example assumes the CLI is installed at `/usr/local/bin/optimai-cli` and the node is running under the `root` user.

---

## 8. Enable the systemd Service

Reload systemd:

```bash
sudo systemctl daemon-reload
```

Enable automatic startup:

```bash
sudo systemctl enable optimai.service
```

Start the service:

```bash
sudo systemctl start optimai.service
```

---

## 9. Check Node Status

Check the service:

```bash
systemctl status optimai.service --no-pager
```

View recent logs:

```bash
journalctl -u optimai.service -n 40 --no-pager -l
```

Check Docker containers:

```bash
docker ps
```

Verify that the service is enabled at boot:

```bash
systemctl is-enabled optimai.service
```

Expected output:

```text
enabled
```

---

## 10. Follow Live Logs

Monitor the node in real time:

```bash
journalctl -u optimai.service -f
```

Exit with:

```text
Ctrl+C
```

---

## 11. Restart the Node

If necessary:

```bash
sudo systemctl restart optimai.service
```

Then verify:

```bash
systemctl status optimai.service --no-pager
```

---

## 12. Rename the Node

If your installed CLI version supports the `device rename` command, give the node a recognizable name:

```bash
optimai-cli node device rename NODE_NAME
```

For example:

```bash
optimai-cli node device rename VPS-01
```

Giving each node a different name makes management easier when you operate several devices.

---

## 13. Running OptimAI on Multiple Devices

OptimAI allows nodes to be operated on multiple supported devices under the same account.

For example, one account can be used with:

- Core Node Desktop on macOS
- Core Node Desktop on Ubuntu
- Core Node Desktop on Windows
- Core Node CLI on a VPS
- Edge Node on a mobile device

If you operate different devices on the same network or public IP address, each device should still comply with OptimAI's current account, usage, and reward rules.

Running additional devices does not by itself guarantee higher rewards.

---

## 14. Alternative OptimAI Node Options

You do not need a VPS to participate in OptimAI.

### Core Node Desktop

The graphical Core Node application is available for:

- Windows
- macOS
- Ubuntu Linux

### Lite Node

For lightweight participation, Lite Node can run in supported Chromium-based browsers such as:

- Chrome
- Brave
- Opera

### Telegram Node

OptimAI can also be accessed through the Telegram Mini App:

```text
@OptimAI_Node_Bot
```

### Edge Node

For mobile participation, OptimAI Edge Node is available on:

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

Check rewards:

```bash
optimai-cli rewards balance
```

Update the CLI:

```bash
optimai-cli update
```

Restart the systemd service:

```bash
sudo systemctl restart optimai.service
```

Check service status:

```bash
systemctl status optimai.service --no-pager
```

Follow logs:

```bash
journalctl -u optimai.service -f
```

Check Docker:

```bash
docker ps
```

---

## Referral Link

If you want to create an OptimAI account, you can use the referral link below:

https://node.optimai.network/register?ref=18ADBAE8

**Referral code:** `18ADBAE8`

---

## Final Notes

- Docker must remain running while the Core CLI Node is operating.
- If Docker is not installed, you can use the Docker Engine installation steps included in this guide.
- Periods without assigned tasks are not necessarily an error.
- Check node health with `optimai-cli node status`.
- Keep the CLI and node software updated.
- Using systemd on a VPS allows the node to restart automatically after a server reboot.
- Multiple devices can be used with the same account, but the number of devices alone does not guarantee higher rewards.
- OptimAI is evolving, so commands and node behavior may change over time.
