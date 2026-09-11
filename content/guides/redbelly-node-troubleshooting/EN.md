---
date: 2026-09-11
---

# Redbelly Node Troubleshooting

This guide covers solutions to some common issues that may occur while operating a Redbelly Mainnet node.

These procedures are intended for node maintenance and troubleshooting rather than the initial installation. Replace the example domain names in the commands with your own node information.

---

## 1. Changing the Redbelly Node Domain / Hostname

Changing the domain or hostname of a running Redbelly node requires more than simply updating the DNS record.

A DNS record and TLS certificate must be prepared for the new hostname, the certificate paths used by the Redbelly service must be updated, and the hostname change should be reported to Redbelly Support.

The following example will be used throughout this section:

```text
Old domain: old.example.com
New domain: redbelly.example.com
```

### 1.1. Notify Redbelly Support

Before changing the hostname, notify Redbelly Support and provide your node information together with the new hostname.

Have the following information ready:

```text
Node ID
Old hostname
New hostname
```

Do not skip this step because the old hostname may still be registered in Redbelly's node registration or monitoring systems.

### 1.2. Create the New DNS Record

Create an **A record** with your DNS provider that points the new hostname to the existing IP address of your node server.

Example:

```text
Type: A
Name: redbelly
Value: YOUR_SERVER_IP
```

Verify the DNS record:

```bash
nslookup redbelly.example.com
```

Make sure the returned IP address matches your node server.

### 1.3. Generate a New TLS Certificate

Generate a Let's Encrypt certificate for the new hostname:

```bash
sudo certbot certonly --standalone -d redbelly.example.com
```

After Certbot completes successfully, the certificates are normally available under:

```text
/etc/letsencrypt/live/redbelly.example.com/
```

Check the files:

```bash
sudo ls -l /etc/letsencrypt/live/redbelly.example.com/
```

### 1.4. Create the Redbelly Certificate Directory

Create a certificate directory for the new domain:

```bash
sudo mkdir -p /etc/redbelly/certs/redbelly.example.com
```

Copy the new certificates to the Redbelly certificate directory:

```bash
sudo cp /etc/letsencrypt/live/redbelly.example.com/fullchain.pem \
/etc/redbelly/certs/redbelly.example.com/fullchain.pem
```

```bash
sudo cp /etc/letsencrypt/live/redbelly.example.com/privkey.pem \
/etc/redbelly/certs/redbelly.example.com/privkey.pem
```

### 1.5. Set Certificate Ownership and Permissions

The Redbelly service runs as `rbnuser`, so the certificate files must be readable by this user.

Set the ownership:

```bash
sudo chown rbnuser:rbnuser /etc/redbelly/certs/redbelly.example.com/fullchain.pem
sudo chown rbnuser:rbnuser /etc/redbelly/certs/redbelly.example.com/privkey.pem
```

Set the permissions:

```bash
sudo chmod 644 /etc/redbelly/certs/redbelly.example.com/fullchain.pem
sudo chmod 600 /etc/redbelly/certs/redbelly.example.com/privkey.pem
```

Verify the result:

```bash
sudo ls -l /etc/redbelly/certs/redbelly.example.com/
```

Expected permissions:

```text
-rw-r--r-- rbnuser rbnuser ... fullchain.pem
-rw------- rbnuser rbnuser ... privkey.pem
```

> **Important:** If the certificate files remain owned by `root:root`, the Redbelly service may be unable to read the private key and may fail to start with a `permission denied` error.

### 1.6. Update the Redbelly Service Configuration

First inspect the current service configuration:

```bash
sudo systemctl cat redbelly.service
```

After identifying the service file location, open it with your preferred editor.

For example:

```bash
sudo nano /etc/systemd/system/redbelly.service
```

Replace the old domain in the TLS certificate and private key paths.

Old:

```text
--tls.cert=/etc/redbelly/certs/old.example.com/fullchain.pem
--tls.key=/etc/redbelly/certs/old.example.com/privkey.pem
```

New:

```text
--tls.cert=/etc/redbelly/certs/redbelly.example.com/fullchain.pem
--tls.key=/etc/redbelly/certs/redbelly.example.com/privkey.pem
```

If the old hostname appears elsewhere in the service configuration, replace it with the new hostname as required.

Save the file.

### 1.7. Reload systemd and Restart Redbelly

Reload the systemd configuration:

```bash
sudo systemctl daemon-reload
```

Restart the Redbelly service:

```bash
sudo systemctl restart redbelly.service
```

Check the service:

```bash
sudo systemctl status redbelly.service
```

The expected status is:

```text
Active: active (running)
```

### 1.8. Verify the New Certificate Externally

Verify the certificate being served through the Redbelly Recovery port:

```bash
echo | openssl s_client \
-servername redbelly.example.com \
-connect redbelly.example.com:1111 2>/dev/null \
| openssl x509 -noout -subject -issuer -dates
```

Check that the:

```text
subject=
```

field contains the new hostname and that the certificate validity dates are correct.

This verifies not only that the certificate exists on the server, but also that the Redbelly service is actually presenting the new certificate externally.

### 1.9. Confirm the Change with Redbelly Support

After completing the hostname migration, notify Redbelly Support with:

```text
Node ID
Old hostname
New hostname
```

Ask them to confirm that the node is correctly recognized under the new hostname by Redbelly's monitoring/network systems.

---

## 2. SSL Certificate Is Not Renewing Automatically

When a Redbelly node is configured with Let's Encrypt / Certbot, certificate renewals can be handled automatically.

However, if Certbot is configured to use the `standalone` authenticator, TCP port `80` must be available during certificate validation.

If another service is already using port `80`, automatic certificate renewal may fail.

### 2.1. Check the Certbot Configuration

List the existing certificates:

```bash
sudo certbot certificates
```

Check the renewal configuration:

```bash
sudo grep -R "authenticator" /etc/letsencrypt/renewal/
```

If you see:

```text
authenticator = standalone
```

Certbot needs to temporarily listen on port `80` during renewal.

### 2.2. Test Automatic Renewal

Test the renewal process without replacing the live certificate:

```bash
sudo certbot renew --dry-run
```

If the test succeeds, the renewal configuration is working correctly.

If it fails because port `80` is already in use, continue with the next step.

### 2.3. Check Which Service Is Using Port 80

Run:

```bash
sudo ss -ltnp | grep ':80 '
```

For example, if the output shows:

```text
nginx
```

then Nginx is currently using port `80`.

> Before stopping Nginx or another service using port `80`, make sure it is not required by another website, reverse proxy, or application running on the server.

### 2.4. If an Unnecessary Nginx Service Is Using Port 80

If Nginx is not required for another service on the server, temporarily stop it:

```bash
sudo systemctl stop nginx
```

Check port `80` again:

```bash
sudo ss -ltnp | grep ':80 '
```

If no output is returned, port `80` is now available.

Run the Certbot renewal test again:

```bash
sudo certbot renew --dry-run
```

The test should now complete successfully.

### 2.5. Renew the Certificate Manually

If required, run the actual renewal process:

```bash
sudo certbot renew
```

If you need to issue a certificate specifically for the node hostname:

```bash
sudo certbot certonly --standalone -d redbelly.example.com
```

### 2.6. Check the Redbelly Certificate Files

Let's Encrypt certificates are normally stored under:

```text
/etc/letsencrypt/live/redbelly.example.com/
```

The certificate files used by Redbelly may be stored under:

```text
/etc/redbelly/certs/redbelly.example.com/
```

Check them:

```bash
sudo ls -l /etc/redbelly/certs/redbelly.example.com/
```

Make sure the ownership and permissions are:

```text
fullchain.pem → rbnuser:rbnuser → 644
privkey.pem   → rbnuser:rbnuser → 600
```

If necessary:

```bash
sudo chown rbnuser:rbnuser /etc/redbelly/certs/redbelly.example.com/fullchain.pem
sudo chown rbnuser:rbnuser /etc/redbelly/certs/redbelly.example.com/privkey.pem

sudo chmod 644 /etc/redbelly/certs/redbelly.example.com/fullchain.pem
sudo chmod 600 /etc/redbelly/certs/redbelly.example.com/privkey.pem
```

### 2.7. Check the Renewal Hook

Recent Redbelly installers may configure a renewal hook that copies renewed Let's Encrypt certificates to the certificate directory used by Redbelly.

Check the post-renewal hooks:

```bash
sudo ls -l /etc/letsencrypt/renewal-hooks/post/
```

If the Redbelly hook exists, inspect it:

```bash
sudo cat /etc/letsencrypt/renewal-hooks/post/redbelly.sh
```

This mechanism runs after Certbot successfully renews the certificate.

> If `certbot renew` fails before renewal because of a port `80` conflict, the renewal hook cannot run. The Certbot renewal problem must therefore be resolved first.

### 2.8. Verify the Redbelly Service

After working on the certificates, restart the Redbelly service:

```bash
sudo systemctl restart redbelly.service
```

Check its status:

```bash
sudo systemctl status redbelly.service
```

The expected status is:

```text
Active: active (running)
```

Finally, verify the certificate that the node is presenting externally:

```bash
echo | openssl s_client \
-servername redbelly.example.com \
-connect redbelly.example.com:1111 2>/dev/null \
| openssl x509 -noout -subject -issuer -dates
```

If the hostname and validity dates correspond to the new certificate, the SSL configuration is working correctly.

---

## Quick Troubleshooting Commands

Check the Redbelly service:

```bash
sudo systemctl status redbelly.service
```

View detailed service logs:

```bash
journalctl -u redbelly.service
```

Follow Redbelly error logs:

```bash
sudo tail -f /var/log/redbelly/rbn_logs/rbbc_logs_error.log
```

Check certificate permissions:

```bash
sudo ls -l /etc/redbelly/certs/redbelly.example.com/
```

Check port `80`:

```bash
sudo ss -ltnp | grep ':80 '
```

Test Certbot renewal:

```bash
sudo certbot renew --dry-run
```

Verify the TLS certificate presented by the node:

```bash
echo | openssl s_client \
-servername redbelly.example.com \
-connect redbelly.example.com:1111 2>/dev/null \
| openssl x509 -noout -subject -issuer -dates
```

New issues and verified solutions encountered while operating a Redbelly node can be added to this troubleshooting guide over time.
