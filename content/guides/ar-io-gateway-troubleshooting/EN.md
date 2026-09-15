---
date: 2026-09-13
slug: ar-io-gateway-troubleshooting
---

# AR.IO Gateway Troubleshooting

This guide covers common AR.IO Gateway problems and practical steps for diagnosing them.

Before changing configuration, first identify whether the problem is related to:

- Docker
- the AR.IO core service
- the Observer
- DNS
- SSL
- Nginx
- ArNS resolution
- Solana wallet configuration
- disk space
- the currently running release

## First Checks

Start with the basic service status:

```bash
cd ~/ar-io-node
sudo docker compose ps
```

Check core logs:

```bash
sudo docker compose logs core -n 100
```

Check Observer logs:

```bash
sudo docker compose logs observer -n 100
```

Check both continuously:

```bash
sudo docker compose logs core observer -f -n 100
```

Check the public gateway:

```bash
curl -I https://YOUR_DOMAIN
```

Check AR.IO information:

```bash
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

Test Arweave data retrieval:

```bash
curl https://YOUR_DOMAIN/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

Expected response:

```text
1984
```

## Release Number Is Wrong or Contains `-pre`

Check the current release:

```bash
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

Then check your Git branch:

```bash
cd ~/ar-io-node
git branch --show-current
```

For a normal production gateway, you should generally be on:

```text
main
```

Update repository information:

```bash
git fetch
git status
```

If necessary:

```bash
git pull
```

Then restart the gateway according to the current AR.IO update procedure.

A release containing:

```text
-pre
```

can indicate that the gateway is running a pre-release/development version rather than the intended stable release.

## Gateway Appears Offline on Network Tools

A gateway may sometimes appear offline on a network dashboard even while the server itself is running.

Verify independently.

Check containers:

```bash
sudo docker compose ps
```

Test the public gateway:

```bash
curl -I https://YOUR_DOMAIN
```

Test data retrieval:

```bash
curl https://YOUR_DOMAIN/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

Check DNS:

```bash
dig +short YOUR_DOMAIN
```

Check logs:

```bash
sudo docker compose logs core observer -n 200
```

If these tests succeed, the gateway itself may still be healthy even if an external dashboard temporarily reports otherwise.

## Observer Report Says `report pending`

Check:

```text
https://YOUR_DOMAIN/ar-io/observer/reports/current
```

If the response indicates:

```text
report pending
```

this can be normal while the Observer is still generating its report.

Do not restart or rebuild the gateway only because a report is temporarily pending.

Wait for the observation cycle to complete and check again.

## Observer Shows `Cannot read properties of undefined`

Some Observer checks may produce errors such as:

```text
Cannot read properties of undefined
```

According to the current AR.IO troubleshooting documentation, this can occur when the Observer checks data or functionality that is not yet available.

Do not immediately assume the gateway is broken because of this message alone.

Check whether:

- the gateway serves data
- `/ar-io/info` responds
- Docker services are running
- normal Observer reports are being produced

## Gateway Fails Observation

If other observers report failures for your gateway, first verify that the gateway is publicly reachable.

Test:

```bash
curl -I https://YOUR_DOMAIN
```

Then:

```bash
curl https://YOUR_DOMAIN/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

Check these `.env` values carefully:

```env
AR_IO_WALLET=
ARNS_ROOT_HOST=
```

`AR_IO_WALLET` must identify the correct gateway operator.

`ARNS_ROOT_HOST` must match the public root hostname used by your gateway.

Also verify:

- DNS
- SSL certificate
- wildcard DNS
- wildcard SSL
- Nginx
- current AR.IO release
- Observer configuration

## Failed Epochs

If your gateway fails an epoch, use the Observer report to identify why.

Start by checking whether the gateway is reachable:

```bash
curl -I https://YOUR_DOMAIN
```

Check the test transaction:

```bash
curl https://YOUR_DOMAIN/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

Check Observer reports:

```text
https://YOUR_DOMAIN/ar-io/observer/reports/current
```

You can also use the AR.IO Network Portal to run manual observations when available.

Common reasons for failed observations include:

- gateway unavailable
- expired SSL certificate
- DNS problems
- incorrect ArNS configuration
- slow ArNS resolution
- incorrect gateway configuration
- outdated node release

If the gateway fails checks from enough prescribed observers, it can fail the epoch and lose rewards for that epoch.

## `.env` Changes Are Not Reflected

If you edit:

```text
.env
```

but the gateway still uses the old values, recreate the services so the updated environment is loaded.

First confirm your changes:

```bash
nano .env
```

Then restart using the appropriate Docker Compose procedure for the current release.

For example:

```bash
sudo docker compose down
sudo docker compose up -d
```

If the current AR.IO release documentation specifically requires recreating or rebuilding services, follow that release's instructions.

Afterward verify:

```bash
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

Do not assume that editing `.env` automatically changes environment variables inside already running containers.

## Gateway Does Not Start

Check:

```bash
sudo docker compose ps
```

Then:

```bash
sudo docker compose logs core -n 200
```

Look for:

- missing environment variables
- invalid wallet configuration
- port conflicts
- database errors
- permission errors
- insufficient disk space
- Docker image problems

Try starting the services again:

```bash
sudo docker compose up -d
```

Then immediately inspect the logs:

```bash
sudo docker compose logs core observer -f -n 100
```

## Nginx Returns 502 Bad Gateway

A `502 Bad Gateway` usually means Nginx is running but cannot successfully reach the AR.IO service behind it.

Check Nginx:

```bash
sudo systemctl status nginx
```

Check AR.IO containers:

```bash
cd ~/ar-io-node
sudo docker compose ps
```

Check core logs:

```bash
sudo docker compose logs core -n 200
```

Check whether the gateway service is listening locally:

```bash
sudo ss -lntp | grep 3000
```

Check your Nginx proxy:

```nginx
proxy_pass http://localhost:3000;
```

Then test the Nginx configuration:

```bash
sudo nginx -t
```

If valid:

```bash
sudo systemctl reload nginx
```

Do not repeatedly restart Nginx if the actual problem is that the AR.IO core container is not running.

## 404 or Nginx Error on the Domain

First test Nginx:

```bash
sudo nginx -t
```

Check:

```bash
sudo systemctl status nginx
```

Review the active configuration:

```bash
sudo nginx -T
```

Confirm that:

```nginx
server_name YOUR_DOMAIN *.YOUR_DOMAIN;
```

matches the gateway domain.

Also verify:

```env
ARNS_ROOT_HOST=YOUR_DOMAIN
```

Check DNS:

```bash
dig +short YOUR_DOMAIN
```

and wildcard DNS:

```bash
dig +short test.YOUR_DOMAIN
```

## Domain Does Not Resolve

Check the root gateway hostname:

```bash
dig +short YOUR_DOMAIN
```

It should return your server IP.

Then check the wildcard:

```bash
dig +short test.YOUR_DOMAIN
```

Both should resolve to the gateway server.

Typical DNS configuration:

```text
YOUR_DOMAIN        -> SERVER_IP
*.YOUR_DOMAIN      -> SERVER_IP
```

If you recently changed DNS, allow time for propagation.

Also check for conflicting A, AAAA or CNAME records.

## Main Domain Works but ArNS Subdomains Fail

This usually points to wildcard routing rather than the gateway itself.

Check wildcard DNS:

```bash
dig +short test.YOUR_DOMAIN
```

Check a known ArNS-style hostname:

```bash
curl -I https://ardrive.YOUR_DOMAIN
```

Verify Nginx:

```nginx
server_name YOUR_DOMAIN *.YOUR_DOMAIN;
```

Verify:

```env
ARNS_ROOT_HOST=YOUR_DOMAIN
```

Also make sure the SSL certificate covers both:

```text
YOUR_DOMAIN
*.YOUR_DOMAIN
```

If the root gateway works but wildcard hosts do not, focus on:

- wildcard DNS
- wildcard certificate
- Nginx `server_name`
- `ARNS_ROOT_HOST`

## Browser Shows `Your Connection Is Not Private`

Check installed certificates:

```bash
sudo certbot certificates
```

Check the expiration date and the domain names included in the certificate.

The certificate must cover both the gateway root host and wildcard host if you serve ArNS subdomains.

For example:

```text
gateway.example.com
*.gateway.example.com
```

If the certificate expired, renew or obtain a new certificate and make sure Nginx points to the correct certificate files.

Then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Wildcard SSL Certificate Fails

Wildcard certificates normally require a DNS challenge.

Example:

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d YOUR_DOMAIN \
  -d '*.YOUR_DOMAIN'
```

Certbot will request a TXT record such as:

```text
_acme-challenge.YOUR_DOMAIN
```

Check whether it has propagated:

```bash
dig TXT _acme-challenge.YOUR_DOMAIN
```

Do not continue the Certbot challenge until the expected TXT value is publicly visible.

Common causes of failure:

- TXT record created at the wrong DNS zone
- old TXT record still present
- DNS propagation delay
- wrong domain
- wildcard hostname not included in the request

## Certificate Renewed but Nginx Still Uses the Old One

Check:

```bash
sudo certbot certificates
```

Then inspect the certificate paths used by Nginx:

```bash
sudo nginx -T | grep -E 'ssl_certificate|ssl_certificate_key'
```

After confirming the paths:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Then verify externally:

```bash
curl -Iv https://YOUR_DOMAIN
```

A successful certificate renewal is not enough if Nginx has not reloaded the certificate.

## Nginx Configuration Changed but Nothing Happened

Always validate first:

```bash
sudo nginx -t
```

Then reload:

```bash
sudo systemctl reload nginx
```

Check:

```bash
sudo systemctl status nginx
```

Reload is generally sufficient for configuration and certificate changes.

A full server reboot should not normally be required.

## AR.IO Header Problems

The AR.IO reverse proxy configuration should forward AR.IO-specific headers.

Inside the Nginx `location /` block, verify:

```nginx
proxy_set_header X-AR-IO-Origin $http_x_ar_io_origin;
proxy_set_header X-AR-IO-Origin-Node-Release $http_x_ar_io_origin_node_release;
proxy_set_header X-AR-IO-Hops $http_x_ar_io_hops;
```

Also keep standard proxy headers such as:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

After editing:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Observer Does Not Start

Check:

```bash
sudo docker compose ps
```

Then:

```bash
sudo docker compose logs observer -n 200
```

Verify your `.env` configuration.

Pay particular attention to:

```env
RUN_OBSERVER=true
OBSERVER_WALLET=
```

and the configured private key or keypair path.

Depending on your configuration, verify either:

```env
OBSERVER_PRIVATE_KEY=
```

or:

```env
OBSERVER_KEYPAIR_PATH=
```

Also check the upload signer configuration if used.

Never paste private keys into public support channels or screenshots.

## Solana Wallet or Signing Errors

Check the Observer and core logs:

```bash
sudo docker compose logs core observer -n 200
```

Verify:

- operator public key
- observer public key
- observer private key/keypair
- upload signing key/keypair
- Solana RPC connectivity
- sufficient SOL for required transactions

Do not expose private keys while debugging.

## ArNS Names Are Slow

If normal gateway requests work but ArNS names resolve very slowly, verify:

- gateway is on the current release
- `ARNS_ROOT_HOST` is correct
- wildcard DNS works
- DNS resolver is healthy
- gateway resources are not exhausted
- disk is not saturated

Check load:

```bash
uptime
```

Memory:

```bash
free -h
```

Disk:

```bash
df -h
```

Container usage:

```bash
sudo docker stats
```

AR.IO's troubleshooting guidance notes that consistently high ArNS resolution times can indicate gateway configuration problems.

## Out of Disk Space

Check:

```bash
df -h
```

Also check inode usage:

```bash
df -i
```

A filesystem may have free storage space but still fail to create new files if all inodes are exhausted.

Check Docker usage:

```bash
sudo docker system df
```

Find large directories:

```bash
sudo du -xh /var/lib/docker 2>/dev/null | sort -h | tail -30
```

And:

```bash
sudo du -xh ~/ar-io-node 2>/dev/null | sort -h | tail -30
```

Do not delete gateway databases or indexed data blindly.

Before removing anything, determine exactly what is consuming the disk.

## Docker Uses Too Much Space

Check:

```bash
sudo docker system df
```

You may remove unused Docker resources with:

```bash
sudo docker system prune
```

Read the list and warning before confirming.

If the server hosts other Docker applications, make sure their unused resources are not needed.

Do not use aggressive cleanup options blindly on a production gateway.

## Check Server Resources

CPU/load:

```bash
uptime
```

Memory:

```bash
free -h
```

Disk:

```bash
df -h
```

Inodes:

```bash
df -i
```

Docker:

```bash
sudo docker stats
```

These checks can quickly distinguish a configuration problem from a resource exhaustion problem.

## Check Firewall

Check UFW:

```bash
sudo ufw status
```

Typical public ports:

```text
22/tcp
80/tcp
443/tcp
```

The AR.IO service behind Nginx does not normally need to expose its internal port directly to the public internet.

## Check Whether Port 80 or 443 Is Already in Use

Run:

```bash
sudo ss -lntp | grep -E ':80|:443'
```

Normally Nginx should own the public HTTP/HTTPS ports.

A port conflict can also affect Certbot when using standalone mode.

If Certbot reports that port 80 is already in use, either:

- use the appropriate webroot/Nginx/DNS challenge method
- or intentionally stop the conflicting service for the challenge and restart it afterward

Do not kill processes blindly.

## Useful Recovery Sequence

When the gateway suddenly stops responding, a practical diagnostic order is:

```bash
cd ~/ar-io-node

sudo docker compose ps
sudo docker compose logs core -n 100
sudo docker compose logs observer -n 100

df -h
df -i

sudo nginx -t
sudo systemctl status nginx

dig +short YOUR_DOMAIN
dig +short test.YOUR_DOMAIN

curl -I https://YOUR_DOMAIN
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

This sequence checks the application, storage, reverse proxy, DNS and public endpoint before you start changing configuration.

## Troubleshooting Checklist

When diagnosing an AR.IO Gateway, check:

- correct release is running
- `main` branch is active when appropriate
- Docker containers are healthy
- core service is responding
- Observer is running
- domain resolves correctly
- wildcard DNS resolves correctly
- SSL certificate is valid
- wildcard certificate is valid
- Nginx configuration passes
- Nginx points to the correct backend
- AR.IO headers are forwarded
- `ARNS_ROOT_HOST` is correct
- `AR_IO_WALLET` is correct
- Solana signing configuration is correct
- server has sufficient SOL where required
- disk space is available
- inodes are available
- server resources are healthy
- gateway returns the `1984` test transaction
- Observer reports do not show persistent failures

Change one thing at a time while troubleshooting. If you make several configuration changes simultaneously, it becomes much harder to determine which change actually fixed or caused the problem.
