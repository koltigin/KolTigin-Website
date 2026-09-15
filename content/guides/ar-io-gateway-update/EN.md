---
date: 2026-09-13
slug: ar-io-gateway-update
---

# AR.IO Gateway Update 

Keeping your AR.IO Gateway up to date is important for compatibility, security and reliable participation in the network.

This guide explains how to safely update an existing AR.IO Gateway installed from the official `ar-io-node` Git repository.

## Check the Current Release

Before updating, check the release currently running on your gateway:

```bash
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

You can also open:

```text
https://YOUR_DOMAIN/ar-io/info
```

in a browser.

Replace:

```text
YOUR_DOMAIN
```

with your gateway domain.

Review the returned information and note the current release before continuing.

If the release number contains:

```text
-pre
```

your gateway may be running the `develop` branch instead of the stable `main` branch.

For a production gateway, verify that you are using the intended stable branch before continuing.

## Go to the AR.IO Node Directory

If the repository was installed in your home directory:

```bash
cd ~/ar-io-node
```

Check the current Git branch:

```bash
git branch --show-current
```

For the normal production setup, this should generally return:

```text
main
```

Check the repository status:

```bash
git status
```

If you have manually modified tracked files, review those changes before pulling an update.

Do not blindly overwrite custom configuration.

## Check for New Releases

Fetch the latest repository information:

```bash
git fetch
```

Check the latest commits:

```bash
git log --oneline --decorate -10
```

You can compare your local branch with the remote branch:

```bash
git status
```

Before updating, also review the official AR.IO release notes and announcements.

New releases may introduce:

- new environment variables
- changed default values
- Docker Compose changes
- observer changes
- Solana-related configuration changes
- new services or dependencies

## Back Up Your Configuration

Before an update, create a backup of your environment configuration.

For example:

```bash
cp .env ~/.ar-io-env-backup-$(date +%Y%m%d-%H%M%S)
```

If you use wallet/keypair files, make sure you already have secure backups stored separately from the server.

Do not expose or commit private keys, seed phrases or keypair files.

## Pull the Latest Changes

Update the repository:

```bash
git pull
```

Confirm that the pull completed successfully.

Then check:

```bash
git status
```

## Check for New Environment Variables

This is one of the most important steps during an AR.IO Gateway update.

Compare the current example environment file with your existing `.env`.

You can inspect:

```bash
nano .env.example
```

and your configuration:

```bash
nano .env
```

Do not simply replace your `.env` with `.env.example`.

Your `.env` contains your gateway-specific configuration.

Instead, identify newly introduced variables and add only the required changes to your existing `.env`.

Pay particular attention to variables related to:

- Solana wallets
- observer
- upload signing
- ArNS
- network configuration
- new gateway services

## Stop the Gateway

Stop the existing containers:

```bash
sudo docker compose down -v
```

The current official AR.IO upgrade procedure uses `down -v`.

AR.IO's indexed gateway data is stored separately from Docker's disposable container volumes, so the normal gateway upgrade process does not erase the gateway's indexing progress.

However, always make sure you understand your own Docker/storage configuration before deleting volumes, especially if you have customized the standard installation.

## Pull Updated Docker Images

Pull the images referenced by the current Docker Compose configuration:

```bash
sudo docker compose pull
```

This ensures that updated images are available before the gateway is started again.

## Start the Updated Gateway

Start the gateway:

```bash
sudo docker compose up -d
```

Recent AR.IO releases do not normally require:

```text
--build
```

when starting the standard gateway configuration.

Check the services:

```bash
sudo docker compose ps
```

## Watch the Logs

Immediately inspect the core logs:

```bash
sudo docker compose logs core -f -n 100
```

Check the observer as well:

```bash
sudo docker compose logs observer -f -n 100
```

Or monitor both:

```bash
sudo docker compose logs core observer -f -n 100
```

Press:

```text
Ctrl+C
```

to leave the log view.

This does not stop the gateway.

## Verify the Gateway

After the update, check the gateway endpoint again:

```bash
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

Confirm that the expected release is now running.

## Test Arweave Data Retrieval

Run the standard gateway test:

```bash
curl https://YOUR_DOMAIN/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

Expected response:

```text
1984
```

If you receive `1984`, the gateway is successfully serving the test transaction.

## Test HTTPS

Check the public endpoint:

```bash
curl -I https://YOUR_DOMAIN
```

Make sure HTTPS is still working correctly after the update.

## Test ArNS / Wildcard Resolution

If your gateway uses wildcard ArNS routing, test a subdomain:

```bash
curl -I https://ardrive.YOUR_DOMAIN
```

This helps verify that the update has not affected:

- wildcard DNS
- wildcard SSL
- Nginx
- `ARNS_ROOT_HOST`
- gateway routing

## Check the Observer

Monitor the observer after the update:

```bash
sudo docker compose logs observer -f -n 100
```

Look for repeated errors related to:

- Solana RPC
- observer wallet
- signing
- insufficient SOL
- network configuration
- upload configuration

## Check Disk Usage

Check available disk space:

```bash
df -h
```

Check Docker usage:

```bash
sudo docker system df
```

A gateway can accumulate significant amounts of data over time, so disk usage should be monitored regularly.

## Optional Docker Cleanup

Unused Docker resources can accumulate after multiple upgrades.

Check usage first:

```bash
sudo docker system df
```

If you decide to clean unused Docker resources:

```bash
sudo docker system prune
```

Read Docker's warning carefully before confirming.

This command can remove unused containers, networks and images.

If the server runs services other than AR.IO, verify what will be removed before continuing.

Do not use aggressive Docker cleanup commands blindly on a production server.

## Quick Update Procedure

For an already healthy gateway where you have reviewed the release notes and confirmed that no manual configuration migration is required:

```bash
cd ~/ar-io-node

git status
git pull

sudo docker compose down -v
sudo docker compose pull
sudo docker compose up -d

sudo docker compose ps
sudo docker compose logs core observer -f -n 100
```

Afterward:

```bash
curl -s https://YOUR_DOMAIN/ar-io/info | jq
```

and:

```bash
curl https://YOUR_DOMAIN/3lyxgbgEvqNSvJrTX2J7CfRychUD5KClFhhVLyTPNCQ
```

Expected gateway test response:

```text
1984
```

## Update Checklist

After every update, verify:

- repository update completed successfully
- correct Git branch is active
- new environment variables were reviewed
- `.env` still contains the correct configuration
- Docker containers are running
- core logs do not show repeating errors
- observer is running correctly
- `/ar-io/info` responds
- expected release is running
- gateway test returns `1984`
- HTTPS works
- wildcard ArNS subdomains work
- Nginx is healthy
- SSL certificate is valid
- sufficient disk space remains
- Solana wallet and observer configuration remain correct

A successful `git pull` alone does not mean the gateway update is complete. Always verify the running services and public gateway after restarting.
