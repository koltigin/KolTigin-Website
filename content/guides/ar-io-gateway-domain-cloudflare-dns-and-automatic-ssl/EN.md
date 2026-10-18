---
coverLogos: ["/assets/images/cover-logos/ario.svg","/assets/images/cover-logos/cloudflare-white.png"]
slug: ar-io-gateway-domain-cloudflare-dns-and-automatic-ssl
date: 2026-10-17
title: "AR.IO Gateway: Domain, Cloudflare DNS, and Automatic SSL"
description: "Point a domain at an existing AR.IO gateway on Ubuntu, manage DNS with Cloudflare, and renew a wildcard Let's Encrypt certificate automatically."
---

# AR.IO Gateway: Domain, Cloudflare DNS, and Automatic SSL

You do not need a separate shared-hosting package to publish an AR.IO gateway under your own domain. If the gateway already runs on a public Ubuntu or VPS server, that server is the origin. Your domain points to it; Cloudflare manages DNS and helps Certbot complete DNS validation.

A domain name alone does not host content. This guide assumes that your Ubuntu server is already running AR.IO Gateway and Nginx.

The workflow was tested with `ario.koltigin.xyz` and `*.ario.koltigin.xyz`. Replace the example domain with your own.

## 1. Before you start

You need:

* A domain registered with any registrar.
* A public IPv4 address for the Ubuntu server; IPv6 is optional.
* An AR.IO gateway and Nginx already running on that server.
* Access to the registrar and to a Cloudflare account.

Keep API tokens, passwords, private keys, and the contents of `cloudflare.ini` out of chat messages, screenshots, backups, and Git repositories.

## 2. Move DNS management to Cloudflare

In Cloudflare, select **Add a site** and enter your domain. Cloudflare may import existing records, but check the zone before changing nameservers.

Copy every record that your domain uses. Common examples are:

* A, AAAA, and CNAME records for websites and services.
* MX records for email.
* TXT records for SPF, DKIM, DMARC, and service verification.
* CAA, SRV, or other service-specific records.

Cloudflare will assign two nameservers to the zone. In your registrar's control panel, replace the existing nameservers with those two values.

This does not transfer the domain to Cloudflare. The registrar remains the same; only authoritative DNS moves to Cloudflare. Wait until the Cloudflare zone shows **Active** before changing application settings. DNS propagation can take from a few minutes up to 24 hours.

### DNSSEC

If DNSSEC is enabled at the current DNS provider, remove the old DS record at the registrar before switching nameservers. Once Cloudflare is active and the records resolve correctly, enable DNSSEC in Cloudflare and add the DS value that Cloudflare provides at the registrar.

Leaving an old DS record in place can make the domain fail to resolve.

## 3. Create the AR.IO gateway records

In Cloudflare → DNS → Records, add the following records. Replace `SERVER_IPV4` with your server's public IPv4 address.

| Type | Name | Target | Proxy status |
|---|---|---|---|
| A | `ario` | `SERVER_IPV4` | DNS only |
| A | `*.ario` | `SERVER_IPV4` | DNS only |
| AAAA | `ario` | `SERVER_IPV6` | DNS only, if IPv6 works on the server |
| AAAA | `*.ario` | `SERVER_IPV6` | DNS only, if IPv6 works on the server |

For `example.com`, these records serve `ario.example.com` and wildcard names such as `node.ario.example.com`.

Start with **DNS only** (the grey cloud). Clients then connect directly to Nginx on your server, which avoids adding a Cloudflare proxy layer while you validate the gateway. Turn on the orange cloud later only after testing HTTPS traffic, origin TLS mode, and the gateway's behavior through Cloudflare.

Do not proxy email records. MX records and their email-service targets must stay DNS only.

## 4. Install Certbot and the Cloudflare DNS plugin

On Ubuntu 24.04, run the following as `root` or with `sudo`:

```bash
apt update
apt install -y certbot python3-certbot-dns-cloudflare
```

Create a scoped Cloudflare API token at Cloudflare → My Profile → API Tokens:

* Permission: **Zone / DNS / Edit**
* Zone Resources: include only the relevant domain

Store it in a root-only file:

```bash
install -d -m 700 /root/.secrets/certbot
nano /root/.secrets/certbot/cloudflare.ini
```

The file contains one line:

```ini
dns_cloudflare_api_token = YOUR_TOKEN_HERE
```

Restrict its permissions:

```bash
chmod 600 /root/.secrets/certbot/cloudflare.ini
stat -c '%a %U:%G %n' /root/.secrets/certbot/cloudflare.ini
```

The expected mode and owner are `600 root:root`.

## 5. Request the wildcard certificate

Wildcard certificates require DNS-01 validation. Request both the main hostname and the wildcard name:

```bash
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/certbot/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 60 \
  -d ario.example.com \
  -d '*.ario.example.com'
```

If DNS changes take longer to appear, increase the propagation value.

Point Nginx at the resulting files:

```nginx
ssl_certificate     /etc/letsencrypt/live/ario.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/ario.example.com/privkey.pem;
```

Test the Nginx configuration before reloading it:

```bash
nginx -t && systemctl reload nginx
```

## 6. Change an existing manual certificate to Cloudflare DNS validation

A certificate issued with Certbot's `--manual` authenticator cannot renew unattended unless manual hooks were configured. Inspect the current setup first:

```bash
certbot certificates
sed -n '1,160p' /etc/letsencrypt/renewal/ario.example.com.conf
```

If your Certbot version supports it, update the existing certificate lineage with:

```bash
certbot reconfigure --cert-name ario.example.com \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/certbot/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 60
```

If `reconfigure` is unavailable or the existing renewal configuration needs to be replaced, request the same certificate once with the Cloudflare plugin:

```bash
certbot certonly \
  --cert-name ario.example.com \
  --force-renewal \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/certbot/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 60 \
  -d ario.example.com \
  -d '*.ario.example.com'
```

Use `--force-renewal` only for a migration or repair such as this one. It is not part of regular maintenance and repeated requests can reach Let's Encrypt rate limits.

## 7. Reload Nginx after a successful renewal

Create a Certbot deploy hook so Nginx reads the new certificate files after a real renewal:

```bash
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/bin/sh
set -e
nginx -t >/dev/null 2>&1
systemctl reload nginx
EOF

chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

The hook tests the Nginx configuration first. If that test fails, `set -e` prevents a reload.

Enable Certbot's systemd timer:

```bash
systemctl enable --now certbot.timer
systemctl status certbot.timer
systemctl list-timers certbot.timer
```

## 8. Verify the full renewal path

Check that the deploy hook runs:

```bash
/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
echo "Exit code: $?"
```

The expected result is `Exit code: 0`.

Then test the complete path without issuing a production certificate:

```bash
certbot renew --dry-run --run-deploy-hooks
```

Successful output includes a simulated renewal for both names and a line similar to:

```text
Congratulations, all simulated renewals succeeded:
  /etc/letsencrypt/live/ario.example.com/fullchain.pem (success)
```

`--run-deploy-hooks` also runs the Nginx hook during the dry run. The test therefore covers the Cloudflare token, DNS-01 validation, simulated certificate renewal, Nginx configuration test, and reload.

## 9. Checklist

* The Cloudflare zone is Active.
* `ario` and `*.ario` resolve to the correct server and are DNS only.
* The credentials file is root-owned with mode `600`.
* The renewal file uses `authenticator = dns-cloudflare`.
* `certbot.timer` is enabled and active.
* The Nginx deploy hook is executable.
* `certbot renew --dry-run --run-deploy-hooks` completes successfully.

After these checks pass, the AR.IO gateway uses your domain without a separate shared-hosting service, and its certificate renews without manual DNS changes.
