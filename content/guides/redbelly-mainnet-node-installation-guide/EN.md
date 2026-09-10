# Redbelly Mainnet Node Installation Guide

This guide explains how to install a Redbelly Mainnet node using the official `rbn-installer` and how to verify that the node is running correctly after installation.

The installer automatically handles most of the required setup, including the Redbelly binary, TLS certificate, systemd service, and related system configuration.

## 1. Before Installation

Before starting the installation, point the domain or subdomain you will use for your node to your server's IP address.

Example:

```text
redbelly.example.com
```

Create an **A record** with your DNS provider pointing to your server's IP address.

Example:

```text
Type: A
Name: redbelly
Value: YOUR_SERVER_IP
```

You can verify that the DNS record resolves to the correct IP address with:

```bash
nslookup redbelly.example.com
```

### Required Ports

Make sure the following ports are open in your firewall:

| Port | Protocol | Purpose |
|---|---|---|
| 22 | TCP | SSH |
| 80 | TCP | Let's Encrypt / Certbot |
| 1888 | TCP | Consensus |
| 1111 | TCP | Recovery |
| 6540 | UDP | Status Server |

If you are using UFW:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 1888/tcp
sudo ufw allow 1111/tcp
sudo ufw allow 6540/udp
```

Check the firewall status:

```bash
sudo ufw status
```

> The Consensus and Recovery ports must match the ports you provided during Redbelly node registration.

## 2. Node Registration

Before installation, your node must be registered with Redbelly.

During registration, you will be asked to provide:

- Node Hostname
- Reward Address
- Vote Address
- Consensus Port
- Recovery Port
- Discord username

After your registration has been approved by Redbelly, you will receive a unique **Node ID**.

Keep this Node ID available because you will need it during installation.

You will also need the private key of your Vote/Signing address.

> **Important:** Never share your private key with anyone. The private key should only be entered directly into the appropriate prompt in the installer.

## 3. Download the Mainnet Installer

Download the latest Redbelly Mainnet installer provided through the Node Operator Support Portal.

Depending on the current version, the installer filename may look like:

```text
rbn-installer-mainnet-v1.3.16.run
```

Throughout this guide, the version-independent filename:

```text
rbn-installer-mainnet-vX.X.X.run
```

will be used.

Replace `X.X.X` with the current Mainnet version you downloaded.

Upload the installer file to your server using SCP, SFTP, or another preferred method.

## 4. Run the Installer

Make the installer executable:

```bash
chmod +x rbn-installer-mainnet-vX.X.X.run
```

Update the package list:

```bash
sudo apt update
```

Then run the installer:

```bash
sudo ./rbn-installer-mainnet-vX.X.X.run
```

The installer will interactively ask for the information required to configure the node.

## 5. Installer Questions and Recommended Answers

### Domain / DNS

Enter the hostname for which you previously created the DNS record.

Example:

```text
redbelly.example.com
```

Do not include `https://`.

### SSL / Certbot

When the installer asks whether you want to generate the SSL/TLS certificate using Certbot, select:

```text
y
```

Enter your email address when requested for certificate registration.

The installer will generate the Let's Encrypt certificate and configure the required certificate files for Redbelly.

### Consensus Port

The default Consensus port is:

```text
1888
```

Unless you registered your node with a different port, use the default value.

If the installer shows `1888` as the default, simply press **Enter**.

### Recovery Port

The default Recovery port is:

```text
1111
```

Unless you registered your node with a different port, use the default value.

If the installer shows `1111` as the default, simply press **Enter**.

### UDP Status Server

The installer will ask whether you want to enable the UDP Status Server:

```text
Enable UDP status server which allows tracking basic node statistics (y/n) (default: y):
```

Answer:

```text
y
```

If `y` is already the default, you can simply press **Enter**.

The UDP Status Server provides node status information and can also be used by monitoring systems and tools such as a Telegram monitoring bot.

### UDP Status Port

The default UDP Status Server port is:

```text
6540
```

If this is shown as the default value, simply press **Enter**.

### Debug Logging

For normal node operation, select:

```text
n
```

If `n` is the default value, simply press **Enter**.

### Logrotate

To enable automatic management of log files, select:

```text
y
```

If `y` is the default value, simply press **Enter**.

### State Scheme

The installer's default value is:

```text
path
```

For a standard installation, press **Enter** to use the default value.

### GC Mode

The installer's default value is:

```text
full
```

For a standard installation, press **Enter** to use the default value.

### Database Snapshot

The installer will ask whether you want to download a recent database snapshot.

For a new node installation, select:

```text
y
```

If `y` is the default value, simply press **Enter**.

The installer will download the current Mainnet database snapshot and use it for the node's initial synchronization.

### Node ID

Enter the Node ID provided to you after your Redbelly registration was approved.

Example:

```text
114
```

This is only an example. **Use the Node ID assigned to your own node.**

### Vote / Signing Private Key

The installer will ask for the private key of your Vote/Signing address.

Enter the private key without the `0x` prefix.

When you paste the private key into the terminal, the characters may not appear on the screen. This is normal because the input is hidden for security purposes.

> **Security:** Never share your private key with anyone or expose it in screenshots, guides, logs, or any publicly accessible location.

## 6. Verify the Node After Installation

After the installer finishes, check whether the Redbelly process is running:

```bash
pgrep rbbc
```

If the command returns a PID, the `rbbc` process is running.

Then check the Redbelly service:

```bash
sudo systemctl status redbelly.service
```

A successful installation should show:

```text
Active: active (running)
```

To view the service logs:

```bash
journalctl -u redbelly.service
```

To follow the Redbelly logs in real time:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs.log
```

To follow the error logs:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs_error.log
```

To exit the live log view, press:

```text
Ctrl + C
```

## Useful Commands

Check the node service:

```bash
sudo systemctl status redbelly.service
```

Restart the node:

```bash
sudo systemctl restart redbelly.service
```

Stop the node:

```bash
sudo systemctl stop redbelly.service
```

Start the node:

```bash
sudo systemctl start redbelly.service
```

Follow the live logs:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs.log
```

Follow the error logs:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs_error.log
```

---

Once the installation is complete and `redbelly.service` is shown as `active (running)`, you can begin monitoring your node.

When a new Redbelly Mainnet version is released, use the **Redbelly Mainnet Node Update Guide** to upgrade your existing node.
