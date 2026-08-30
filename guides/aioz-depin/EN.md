# AIOZ DePIN CLI v1.2.6 Installation Guide

> English installation guide for Ubuntu-based x86_64 (amd64) computers
> and VPS servers.

This guide covers installing AIOZ DePIN CLI v1.2.6, creating a node key,
testing the node, and running it automatically in the background with
`systemd`.

> **Security:** Never share your `privkey.json` file or recovery phrase
> (mnemonic). Do not use your main wallet’s private key on a node
> server.

## 1. Install required packages

``` bash
sudo apt update
sudo apt install -y curl tar
```

For a VPS installation as `root`:

``` bash
mkdir -p /root/aioz
cd /root/aioz
```

## 2. Download AIOZ DePIN CLI v1.2.6

``` bash
cd /root/aioz
curl -LO https://github.com/AIOZNetwork/aioz-depin-cli/releases/download/v1.2.6/aioz-depin-linux-amd64-1.2.6.tar.gz
tar -xzf aioz-depin-linux-amd64-1.2.6.tar.gz
mv aioz-depin-cli-linux-amd64 aioz-depin-cli
chmod +x aioz-depin-cli
./aioz-depin-cli version
```

Expected version:

``` text
1.2.6
```

## 3. Create a new node key

Only perform this step when creating a new node:

``` bash
cd /root/aioz
./aioz-depin-cli keytool new --save-priv-key privkey.json
chmod 600 /root/aioz/privkey.json
```

Back up `privkey.json` and the recovery phrase in a secure location,
preferably encrypted and offline.

### Using an existing key

Do not generate a new key. Place your existing `privkey.json` at:

``` text
/root/aioz/privkey.json
```

Then restrict its permissions:

``` bash
chmod 600 /root/aioz/privkey.json
```

## 4. Run the node for the first time

``` bash
cd /root/aioz

./aioz-depin-cli start \
  --home /root/aioz/depin-data \
  --priv-key-file /root/aioz/privkey.json
```

Once you confirm that the node starts correctly, stop this manual test
with `Ctrl+C`.

## 5. Create a systemd service

``` bash
sudo nano /etc/systemd/system/aioz-depin.service
```

Add:

``` ini
[Unit]
Description=AIOZ DePIN Node
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/aioz
ExecStart=/root/aioz/aioz-depin-cli start --home /root/aioz/depin-data --priv-key-file /root/aioz/privkey.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

In Nano, save with `Ctrl+O`, press `Enter`, then exit with `Ctrl+X`.

## 6. Enable and start the service

``` bash
sudo systemctl daemon-reload
sudo systemctl enable --now aioz-depin.service
```

Check the service:

``` bash
systemctl status aioz-depin.service --no-pager -l
systemctl is-enabled aioz-depin.service
systemctl is-active aioz-depin.service
```

Expected state:

``` text
enabled
active
```

## 7. View logs

Follow live logs:

``` bash
journalctl -u aioz-depin.service -f
```

View the latest 100 entries:

``` bash
journalctl -u aioz-depin.service -n 100 --no-pager
```

Exiting `journalctl -f` with `Ctrl+C` does not stop the node.

## 8. Check node operation

``` bash
pgrep -af 'aioz-depin|aioz'
```

Node statistics:

``` bash
cd /root/aioz
./aioz-depin-cli stats
```

## 9. Manage the service

``` bash
sudo systemctl start aioz-depin.service
sudo systemctl stop aioz-depin.service
sudo systemctl restart aioz-depin.service
systemctl status aioz-depin.service --no-pager -l
```

## 10. Check automatic startup

``` bash
systemctl is-enabled aioz-depin.service
```

If the result is `enabled`, the service is configured to start
automatically when the system boots.

## 11. Set the storage limit

Example for a 1000 GB limit:

``` bash
cd /root/aioz

./aioz-depin-cli storage limit 1000 \
  --priv-key-file /root/aioz/privkey.json
```

Choose a value appropriate for your server’s disk capacity and available
space.

## 12. Check reward balance

``` bash
cd /root/aioz

./aioz-depin-cli reward balance \
  --priv-key-file /root/aioz/privkey.json
```

## 13. Quick operational check

``` bash
echo "=== HOST ==="
hostname

echo "=== AIOZ SERVICE STATUS ==="
systemctl status aioz-depin.service --no-pager -l

echo "=== AIOZ PROCESSES ==="
pgrep -af 'aioz-depin|aioz'

echo "=== AIOZ CLI VERSION ==="
/root/aioz/aioz-depin-cli version
```

## 14. Troubleshooting

``` bash
journalctl -u aioz-depin.service -n 100 --no-pager
ls -lah /root/aioz
ls -l /root/aioz/aioz-depin-cli
ls -l /root/aioz/privkey.json
```

If executable permission is missing:

``` bash
chmod +x /root/aioz/aioz-depin-cli
```

After changing the service file:

``` bash
sudo systemctl daemon-reload
sudo systemctl restart aioz-depin.service
```

## 15. Standard installation layout

``` text
/root/aioz
/root/aioz/aioz-depin-cli
/root/aioz/privkey.json
/root/aioz/depin-data
/etc/systemd/system/aioz-depin.service
```

## Security recommendations

- Never share `privkey.json` or your recovery phrase.
- Use a separate key for each node whenever possible.
- Do not store your main wallet’s private key on the node server.
- Keep an encrypted offline backup of your node credentials.
- If you suspect the server has been compromised, do not consider
  private keys stored on that server trustworthy.
- Do not run unknown scripts or binaries as `root`.
- Download AIOZ software only from official sources.

## Official resources

- AIOZ DePIN CLI: https://github.com/AIOZNetwork/aioz-depin-cli
- AIOZ Network: https://aioz.network/

------------------------------------------------------------------------

**Guide date:** August 29, 2026  
**AIOZ DePIN CLI:** v1.2.6

> This is a community-maintained guide and is not official AIOZ Network
> documentation.
