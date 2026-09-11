---
date: 2026-09-11
---

# Redbelly Mainnet Node Update Guide

This guide explains how to update an existing Redbelly Mainnet node using the latest installer when a new node version is released.

During a normal update, it is important to preserve the existing blockchain database. Pay particular attention to the database-related question displayed by the installer.

## 1. Download the Latest Installer

Log in to the Redbelly Node Operator Support Portal:

https://redbelly.atlassian.net/servicedesk/customer/portal/13/article/1960869898

Download the latest Mainnet installer.

For example:

```text
rbn-installer-mainnet-v1.3.16.run
```

Throughout this guide, the version-independent filename:

```text
rbn-installer-mainnet-vX.X.X.run
```

will be used.

Replace `X.X.X` with the current Mainnet version you downloaded.

## 2. Upload the New Installer to Your Server

Connect to your server using SCP, SFTP, or another preferred method.

If you no longer need the old installer file, you can remove it.

For example:

```bash
rm rbn-installer.run
```

or, if the old installer includes a version number:

```bash
rm rbn-installer-mainnet-vOLD.VERSION.run
```

> This removes only the old installer file. Do not delete the Redbelly node database or blockchain data.

Upload the new installer file to your server.

For example:

```text
rbn-installer-mainnet-vX.X.X.run
```

## 3. Start the Update

Make the new installer executable:

```bash
chmod +x rbn-installer-mainnet-vX.X.X.run
```

Then run the installer:

```bash
sudo ./rbn-installer-mainnet-vX.X.X.run
```

The installer will detect the existing Redbelly installation and begin the update process.

## 4. Important Questions During the Update

Pay particular attention to the following two questions during the update.

### UDP Status Server

The installer may ask whether you want to enable the UDP Status Server:

```text
Do you want to enable the UDP status server? (y/n)
```

Answer:

```text
y
```

The UDP Status Server provides node status information and can be used by monitoring systems, Telegram bots, and similar tools.

### Database — Important

When the installer detects the existing database, it will ask:

```text
Database detected, do you want to clear the locally stored data and re-download the chain
```

For a normal node update, answer:

```text
n
```

The options mean:

```text
y → Deletes the existing database and downloads the blockchain data again.
n → Preserves the existing database.
```

> **IMPORTANT:** For a normal node update, select `n` to preserve your existing synchronized database.

Selecting `y` will clear the existing database and cause the blockchain data to be downloaded again. Do not select `y` unless you intentionally want to rebuild the database.

## 5. Check the Version After the Update

After the installer completes, check the installer version:

```bash
sudo ./rbn-installer-mainnet-vX.X.X.run -- --version
```

## 6. Verify That the Node Is Running

After the update is complete, check the Redbelly process:

```bash
pgrep rbbc
```

Then check the Redbelly service:

```bash
sudo systemctl status redbelly.service
```

The expected status is:

```text
Active: active (running)
```

If the service is running, the node is active again after the update.

## 7. Check the Logs

Follow the Redbelly logs in real time:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs.log
```

Check the error logs:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs_error.log
```

View the systemd service logs:

```bash
journalctl -u redbelly.service
```

To exit the live log view, press:

```text
Ctrl + C
```

## Quick Update Summary

```text
1. Download the latest Mainnet installer.
2. Upload the installer to your server.
3. chmod +x rbn-installer-mainnet-vX.X.X.run
4. sudo ./rbn-installer-mainnet-vX.X.X.run
5. UDP Status Server → y
6. Database clear / re-download → n
7. Check the installer version.
8. Check the redbelly.service status.
9. Check the node logs.
```

> **Reminder:** The most important choice during an update is the database question. For a normal update, select **`n`** to preserve the existing blockchain data.
