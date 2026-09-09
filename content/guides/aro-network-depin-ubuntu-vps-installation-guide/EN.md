# ARO Network DePIN — Ubuntu / VPS Installation Guide

> Community installation guide for Ubuntu-based computers and VPS servers.

ARO Network is a DePIN project designed around contributing available network and computing resources to decentralized infrastructure.

This guide covers installing an ARO Server Node on an Ubuntu-based computer or VPS, enabling the required services, obtaining the Device SN from the Web Console, and adding the node to the ARO Dashboard.

## Registration and Community

You can register for ARO Network using the referral link below:

- Sign up: https://dashboard.aro.network/signup?referral=9KAG
- Referral Code: `9KAG`
- Discord: https://discord.gg/aronetwork

## Platform Notes

- ARO can be installed on Android devices.
- It is not recommended for Solana Seeker.
- The macOS version is still in testing, so I do not currently recommend running it on a Mac.
- It can be run on Ubuntu-based physical computers.
- It can also be run as a Server Node on an Ubuntu-based VPS.

> **Important:** Run the installation commands one by one. Each line is a separate command.

---

## 1. Download the ARO Installation Package

First, switch to the `/root` directory:

```bash
cd /root
```

Download the ARO Network Debian installation package from the official download URL:

```bash
wget https://download.aro.network/files/packages/linux/ARO_Desktop_latest_debian.deb
```

Verify that the package was downloaded:

```bash
ls -lh /root/ARO_Desktop_latest_debian.deb
```

Set the appropriate read permissions on the file:

```bash
chmod 644 /root/ARO_Desktop_latest_debian.deb
```

---

## 2. Install the ARO Package

Install the ARO package:

```bash
dpkg -i /root/ARO_Desktop_latest_debian.deb
```

If the installation reports missing dependencies, install them with:

```bash
apt -f install -y
```

---

## 3. Verify the Installation

Verify that the ARO package was successfully installed:

```bash
dpkg -l | grep -i '^ii  aro'
```

A successful installation should show output similar to:

```text
ii  aro  1.0.0  all  ARO Agent
```

> The package version may change over time, so the version number may be different from the example above.

---

## 4. Set Executable Permissions

Set the required executable permissions for the ARO binaries and scripts.

Run the commands one by one:

```bash
chmod +x /opt/src/agent/agent
```

```bash
chmod +x /opt/src/agent/updater
```

```bash
chmod +x /opt/src/agent/agent_before.sh
```

```bash
chmod +x /opt/src/rpc/frpc
```

```bash
chmod +x /opt/src/rpc/rpc_start.sh
```

```bash
chmod +x /opt/src/wx-data/.lotso/start.sh
```

```bash
chmod +x /opt/src/wx-data/.lotso/lotso
```

---

## 5. Copy the Service Files to the systemd Directory

Copy the ARO service files to the systemd service directory.

Run the commands one by one:

```bash
cp /opt/src/agent/agent.service /etc/systemd/system/
```

```bash
cp /opt/src/agent/updater.service /etc/systemd/system/
```

```bash
cp /opt/src/rpc/rpc.service /etc/systemd/system/
```

```bash
cp /opt/src/wx-data/lotso.service /etc/systemd/system/
```

---

## 6. Reload the systemd Configuration

Reload systemd so that it detects the newly copied service files:

```bash
systemctl daemon-reload
```

---

## 7. Enable the Services at Boot

Enable the ARO services so that they start automatically after the server or computer reboots.

```bash
systemctl enable lotso.service
```

```bash
systemctl enable updater.service
```

```bash
systemctl enable rpc.service
```

```bash
systemctl enable agent.service
```

---

## 8. Start the ARO Services

Start each service:

```bash
systemctl start lotso.service
```

```bash
systemctl start updater.service
```

```bash
systemctl start rpc.service
```

```bash
systemctl start agent.service
```

---

## 9. Check the Service Status

Verify that all four ARO services are running:

```bash
systemctl status lotso.service --no-pager
```

```bash
systemctl status rpc.service --no-pager
```

```bash
systemctl status updater.service --no-pager
```

```bash
systemctl status agent.service --no-pager
```

A running service should show a status similar to:

```text
Active: active (running)
```

---

## 10. Check the RPC Connection

View the latest RPC service logs:

```bash
journalctl -u rpc.service -n 30 --no-pager -l
```

A healthy connection may show entries similar to:

```text
login to server success
proxy added
start proxy success
```

These messages indicate that the RPC connection and proxy have been successfully started.

---

## 11. Open the Web Console Port

The ARO Web Console is accessible through TCP port `40001`.

If UFW is enabled and this port is not already open:

```bash
ufw allow 40001/tcp
```

Check the firewall status:

```bash
ufw status
```

Verify that access to `40001/tcp` is allowed.

> If your VPS provider also uses an external firewall or security group, you may also need to allow `40001/tcp` from the provider's control panel.

---

## 12. Open the ARO Web Console

From a web browser on your computer, open:

```text
http://VPS_IP:40001
```

Replace `VPS_IP` with the actual public IP address of the server running the ARO node.

Example format:

```text
http://203.0.113.10:40001
```

The Web Console should display information about the device and node.

---

## 13. Obtain the Device SN

On the Web Console home page, locate:

```text
Device SN
```

Copy this value.

Example Device SN:

```text
OLKN4Y76W578V19W
```

This value will be used in the next step to add the server to the ARO Dashboard.

---

## 14. Make Sure You Use the Correct Serial Number

This step is important.

The serial number that must be entered in the ARO Dashboard is the **`Device SN` displayed in the Web Console**.

The system may also contain the following file:

```text
/etc/enreach/x86_sn
```

The value stored in this file may begin with:

```text
STWL...
```

This value must **not** be used for ARO Dashboard node registration.

Always use the:

```text
Device SN
```

displayed in the Web Console.

---

## 15. Add the Node to the ARO Dashboard

Sign in to the ARO Dashboard.

Then:

1. Click `Add New Node`.
2. Select `Server` as the node type.
3. Enter the `Device SN` copied from the Web Console.
4. Click `Continue`.
5. If `Location` is automatically detected correctly on the final screen, leave it unchanged.
6. Click `Add` to add the node to your account.

After the node has been successfully added, it should appear in your ARO Dashboard.

---

## 16. Check the General Logs

You can inspect the latest logs for each ARO service separately.

Agent:

```bash
journalctl -u agent.service -n 50 --no-pager -l
```

RPC:

```bash
journalctl -u rpc.service -n 50 --no-pager -l
```

Updater:

```bash
journalctl -u updater.service -n 50 --no-pager -l
```

Lotso:

```bash
journalctl -u lotso.service -n 50 --no-pager -l
```

If you experience a problem with one of the services, its journal is one of the first places to check.

---

## 17. Follow the Live Logs

To follow the Agent service logs in real time:

```bash
journalctl -u agent.service -f
```

Exit the live log view with:

```text
Ctrl+C
```

`Ctrl+C` only stops the live log display. It does not stop the ARO service.

---

## 18. Perform a Quick Health Check

Check whether all ARO services are active:

```bash
systemctl is-active lotso.service
```

```bash
systemctl is-active rpc.service
```

```bash
systemctl is-active updater.service
```

```bash
systemctl is-active agent.service
```

The expected result from all four commands is:

```text
active
```

---

## 19. Check the Auto-Sleep Warning

ARO may display the following warning:

```text
Warning: Host machine OS has inappropriate auto-sleep settings.
```

This warning is particularly relevant when running the node on a physical computer using Windows, macOS, or Ubuntu Desktop.

If the computer enters sleep mode, the ARO node may stop running. Therefore, automatic sleep should be disabled when running the node on a physical computer.

VPS servers normally do not use system sleep.

If you see this warning on a VPS, first verify that all ARO services are running:

```bash
systemctl is-active lotso.service
```

```bash
systemctl is-active rpc.service
```

```bash
systemctl is-active updater.service
```

```bash
systemctl is-active agent.service
```

If all four commands return:

```text
active
```

the ARO services are running.

---

## 20. Restart the ARO Services

If you experience a problem with the node or one of its services, restart the ARO services:

```bash
systemctl restart lotso.service
```

```bash
systemctl restart updater.service
```

```bash
systemctl restart rpc.service
```

```bash
systemctl restart agent.service
```

Then check their status again:

```bash
systemctl is-active lotso.service
```

```bash
systemctl is-active rpc.service
```

```bash
systemctl is-active updater.service
```

```bash
systemctl is-active agent.service
```

---

## 21. Troubleshooting and Final Verification

Check the latest detailed Agent logs:

```bash
journalctl -u agent.service -n 100 --no-pager -l
```

RPC logs:

```bash
journalctl -u rpc.service -n 100 --no-pager -l
```

Updater logs:

```bash
journalctl -u updater.service -n 100 --no-pager -l
```

Lotso logs:

```bash
journalctl -u lotso.service -n 100 --no-pager -l
```

At the end of the installation, verify all four services:

```bash
systemctl is-active lotso.service
systemctl is-active rpc.service
systemctl is-active updater.service
systemctl is-active agent.service
```

Expected result:

```text
active
active
active
active
```

Perform a final RPC check:

```bash
journalctl -u rpc.service -n 30 --no-pager -l
```

Verify that the Web Console is accessible:

```text
http://VPS_IP:40001
```

Finally, confirm that the node is registered and online in the ARO Dashboard.

---

## Installation Summary

After the installation is complete, the following four services should be running:

```text
lotso.service
rpc.service
updater.service
agent.service
```

Web Console:

```text
http://VPS_IP:40001
```

Serial number to use for Dashboard registration:

```text
Web Console → Device SN
```

Value that must **not** be used for Dashboard registration:

```text
/etc/enreach/x86_sn → STWL...
```

---

## Community Guide Notice

This is a community-maintained guide and is not official ARO Network documentation.

If ARO Network changes the package version, file paths, service names, or installation method, some commands in this guide may need to be updated.
