---
date: 2026-09-13
slug: ar-io-gateway-installation
---

# AR.IO Gateway Installation

This guide explains how to install and run an AR.IO Gateway on an Ubuntu server using Docker, a custom domain, SSL and Nginx.

AR.IO has migrated its protocol layer to Solana. The gateway still serves and indexes Arweave data, but operator and observer identities now use Solana addresses.

This guide focuses on getting the gateway infrastructure online. Registering the gateway on the AR.IO network and staking ARIO are separate steps.

## System Requirements

### Minimum

- 4 CPU cores
- 4 GB RAM
- 500 GB storage
- SSD recommended
- Stable 50 Mbps internet connection

### Recommended

- 12 CPU cores
- 32 GB RAM
- 2 TB SSD
- Stable 1 Gbps internet connection

For a long-running production gateway, SSD storage and sufficient free disk space are strongly recommended.

## Update the Server

```bash
sudo apt update -y && sudo apt upgrade -y
```

## Install Required Packages

```bash
sudo apt install -y curl openssh-server git certbot nginx sqlite3 build-essential
```

Enable SSH:

```bash
sudo systemctl enable ssh
```

## Configure the Firewall

Allow SSH, HTTP and HTTPS:

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

Check the firewall:

```bash
sudo ufw status
```

Make sure you do not lock yourself out of the server when enabling UFW.

## Install Docker

Add Docker's official repository:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl

sudo install -m 0755 -d /etc/apt/keyrings

sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc

sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
```

Install Docker Engine and Docker Compose:

```bash
sudo apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin
```

Verify the installation:

```bash
docker --version
docker compose version
```

## Install Node.js

Install NVM:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Reload the shell:

```bash
source ~/.bashrc
```

Install the Node.js version currently used by the official AR.IO setup documentation:

```bash
nvm install 20.11.1
nvm use 20.11.1
npm install -g yarn@1.22.22
```

Check the versions:

```bash
node -v
npm -v
yarn -v
```

## Clone the AR.IO Node Repository

Move to the directory where you want to keep the gateway:

```bash
cd ~
```

Clone the official repository:

```bash
git clone -b main https://github.com/ar-io/ar-io-node
```

Enter the directory:

```bash
cd ar-io-node
```

The gateway databases are stored with the node data. If you intend to use a separate SSD or storage volume, plan the storage location before allowing the gateway to build a large index.

## Prepare the Solana Wallets

The current AR.IO protocol uses Solana identities.

You need an operator address and an observer address.

The operator is identified by:

```text
AR_IO_WALLET
```

The observer is identified by:

```text
OBSERVER_WALLET
```

The observer address must be unique to the gateway.

A simple deployment may use the same Solana keypair for multiple gateway roles, while operators who want stronger key separation can use a dedicated observer keypair.

Never publish private keys or keypair JSON files.

## Create the Environment File

From the AR.IO node directory:

```bash
nano .env
```

A basic configuration looks like this:

```env
GRAPHQL_HOST=turbo-gateway.com
GRAPHQL_PORT=443
START_HEIGHT=1000000

RUN_OBSERVER=true

ARNS_ROOT_HOST=YOUR_DOMAIN

AR_IO_WALLET=YOUR_SOLANA_OPERATOR_PUBLIC_KEY
OBSERVER_WALLET=YOUR_SOLANA_OBSERVER_PUBLIC_KEY

OBSERVER_PRIVATE_KEY=YOUR_OBSERVER_BASE58_PRIVATE_KEY
SOLANA_UPLOAD_PRIVATE_KEY=YOUR_OBSERVER_BASE58_PRIVATE_KEY
```

Replace:

```text
YOUR_DOMAIN
YOUR_SOLANA_OPERATOR_PUBLIC_KEY
YOUR_SOLANA_OBSERVER_PUBLIC_KEY
YOUR_OBSERVER_BASE58_PRIVATE_KEY
```

with your own values.

Do not include angle brackets around the final values.

### Using Keypair Files Instead

If you prefer JSON keypair files instead of inline private keys, place the required keypair in the gateway's `wallets` directory.

Then remove:

```env
OBSERVER_PRIVATE_KEY=
SOLANA_UPLOAD_PRIVATE_KEY=
```

and configure:

```env
OBSERVER_KEYPAIR_PATH=/app/wallets/YOUR_OBSERVER_KEYPAIR.json
SOLANA_UPLOAD_KEYPAIR_PATH=/app/wallets/YOUR_OBSERVER_KEYPAIR.json
```

Do not configure both the inline private key and keypair path for the same role.

## Protect Wallet Files

Private key material should never be publicly accessible.

For example:

```bash
chmod 600 wallets/*.json
```

Do not commit:

```text
.env
wallets/
private keys
seed phrases
```

to a public Git repository.

## Configure DNS

Your gateway needs a domain.

Assume the gateway domain is:

```text
gateway.example.com
```

Create an A record pointing the gateway domain to your server:

```text
gateway.example.com -> SERVER_IP
```

AR.IO also requires wildcard subdomain resolution for ArNS names.

Create:

```text
*.gateway.example.com -> SERVER_IP
```

You should therefore have both:

```text
gateway.example.com
*.gateway.example.com
```

pointing to the gateway server.

Wait for DNS propagation before continuing.

Check the main record:

```bash
dig +short gateway.example.com
```

Check a wildcard subdomain:

```bash
dig +short test.gateway.example.com
```

Both should resolve to your server.

## Start the Gateway

From the AR.IO node directory:

```bash
sudo docker compose up -d
```

Check the containers:

```bash
sudo docker compose ps
```

Follow the core logs:

```bash
sudo docker compose logs core -f -n 100
```

Follow the core and observer logs together:

```bash
sudo docker compose logs core observer -f -n 100
```

Use:

```text
Ctrl+C
```

to leave the log view. This does not stop the containers.

## Check the Local Gateway

Check whether the gateway is listening:

```bash
sudo docker compose ps
```

You can also inspect the logs:

```bash
sudo docker compose logs core -n 100
```

When `ARNS_ROOT_HOST` is configured, some localhost-based tests may not behave the same way as requests made through the configured public hostname. The final validation should therefore be performed through your domain.

## Obtain an SSL Certificate

AR.IO gateways need HTTPS for both the main gateway domain and wildcard ArNS subdomains.

For:

```text
gateway.example.com
*.gateway.example.com
```

request a wildcard certificate using a DNS challenge:

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d gateway.example.com \
  -d '*.gateway.example.com'
```

Certbot will ask you to create a DNS TXT record.

Create the requested TXT record at your DNS provider and wait until it becomes publicly visible before continuing.

You can verify it with:

```bash
dig TXT _acme-challenge.gateway.example.com
```

Continue Certbot only after the expected TXT value appears.

### Wildcard Certificate Renewal

Manual DNS wildcard certificates cannot normally renew unattended.

For a production gateway, using a DNS provider with a supported Certbot DNS plugin or API-based ACME automation is preferable.

Monitor certificate expiration:

```bash
sudo certbot certificates
```

Do not allow the gateway certificate to expire.

## Configure Nginx

Open the default Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/default
```

Use a configuration similar to:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name gateway.example.com *.gateway.example.com;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;

    server_name gateway.example.com *.gateway.example.com;

    ssl_certificate /etc/letsencrypt/live/gateway.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gateway.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_http_version 1.1;

        proxy_set_header X-AR-IO-Origin $http_x_ar_io_origin;
        proxy_set_header X-AR-IO-Origin-Node-Release $http_x_ar_io_origin_node_release;
        proxy_set_header X-AR-IO-Hops $http_x_ar_io_hops;
    }
}
```

Replace:

```text
gateway.example.com
```

with your actual gateway domain.

The `X-AR-IO-*` headers are important for AR.IO gateway communication and should not be removed from the proxy configuration.

## Test Nginx

Always test the configuration before reloading:

```bash
sudo nginx -t
```

If the result is successful:

```bash
sudo systemctl reload nginx
```

Check the service:

```bash
sudo systemctl status nginx
```

## Test HTTPS

Check the gateway:

```bash
curl -I https://gateway.example.com
```

Then test the official AR.IO gateway test transaction:

```bash
curl https://gateway.example.com/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

The expected response is:

```text
1984
```

If you receive `1984`, the gateway is successfully serving Arweave data through your domain.

## Check Gateway Information

Check the AR.IO information endpoint:

```bash
curl -s https://gateway.example.com/ar-io/info | jq
```

Pay particular attention to the configured wallet and network information.

After the Solana migration, the gateway should report the Solana configuration expected for the network you are targeting.

## Test Wildcard / ArNS Resolution

Test a known ArNS-style subdomain:

```bash
curl -I https://ardrive.gateway.example.com
```

The request should reach your gateway using the wildcard DNS record and wildcard SSL certificate.

If the main domain works but subdomains fail, check:

- wildcard DNS
- wildcard SSL certificate
- Nginx `server_name`
- `ARNS_ROOT_HOST`
- gateway logs

## Check the Observer

Follow observer-related logs:

```bash
sudo docker compose logs observer -f -n 100
```

Or monitor both services:

```bash
sudo docker compose logs core observer -f -n 100
```

Observer-related problems are often caused by:

- incorrect Solana wallet configuration
- missing private key/keypair
- insufficient SOL for transactions
- upload signer configuration
- Solana RPC connectivity
- incorrect network configuration

## Useful Commands

Check running containers:

```bash
sudo docker compose ps
```

Start the gateway:

```bash
sudo docker compose up -d
```

Stop the gateway:

```bash
sudo docker compose down
```

Restart the gateway:

```bash
sudo docker compose restart
```

Follow core logs:

```bash
sudo docker compose logs core -f -n 100
```

Follow observer logs:

```bash
sudo docker compose logs observer -f -n 100
```

Check Nginx:

```bash
sudo nginx -t
sudo systemctl status nginx
```

Check certificates:

```bash
sudo certbot certificates
```

Check disk space:

```bash
df -h
```

Check Docker disk usage:

```bash
sudo docker system df
```

## Final Checklist

Before considering the gateway installation complete, verify:

- Docker containers are running
- Core service is healthy
- Observer is running
- Domain resolves to the correct server
- Wildcard DNS resolves correctly
- HTTPS works
- Wildcard HTTPS works
- Nginx configuration passes
- AR.IO headers are forwarded
- Gateway test returns `1984`
- `/ar-io/info` responds
- Solana wallet configuration is correct
- Observer has the required signing configuration
- Wallets have sufficient SOL for required protocol transactions

## Joining the AR.IO Network

Running a gateway and registering it in the AR.IO Gateway Address Registry are separate steps.

A production gateway should first be fully functional with:

- custom domain
- HTTPS
- wildcard ArNS resolution
- working gateway requests
- correct Solana wallet configuration

Network registration currently requires ARIO operator stake and SOL for Solana transaction fees.

Complete and verify the gateway installation before registering it on the network.

