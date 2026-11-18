---
slug: dante-proxy-setup-guide
date: 2026-11-18
coverLogos: ["/assets/images/cover-logos/dante-socks-proxy-logo-2.svg"]
---

# Dante Proxy Setup Guide

A guide to safely update Dante proxy access and the required UFW rule whenever your home internet IP changes.

## Purpose

`update-dante-ip.sh` applies your current public home IPv4 address to the Dante configuration on the 1–6 servers you choose. It changes UFW only on the target server defined in your private configuration file, only for TCP port `33534`; it never changes UFW on the other servers in the list.

## Supported environments

The same `update-dante-ip.sh` script is used on every platform; there is no separate Windows script.

- **macOS / Linux:** Open Terminal.
- **Windows:** Install [Git for Windows](https://git-scm.com/download/win), then open **Git Bash** from the Start menu. Run these commands in Git Bash, not PowerShell or Command Prompt.

## Installation

1. Download the script and make it executable:

   ```bash
   curl -fL https://koltigin.xyz/downloads/common/update-dante-ip.sh -o ~/update-dante-ip.sh
   chmod 700 ~/update-dante-ip.sh
   ```

2. Start the script's setup wizard:

   ```bash
   ~/update-dante-ip.sh --setup
   ```

3. The wizard first asks how many servers you want to add; choose from `1` to `6`. It then asks only for that number of server addresses and SSH usernames, the number of the server that receives the UFW update, and the Dante port. Answer the prompts; no configuration code is required. The file is stored locally at `~/.config/dante-update/servers.conf` with restricted permissions. Never upload it to your website or source repository.

## Safe first run

When a user runs only `~/update-dante-ip.sh`, the script first asks for Turkish or English, then displays a menu for setup/editing, safe preflight, IP update, or exit. First run the read-only preflight. It makes no changes:

```bash
~/update-dante-ip.sh --check
```

The preflight detects your public IPv4 address, checks SSH/Dante access on every selected server, and confirms that UFW is active on the target server. If it passes, run the update:

```bash
~/update-dante-ip.sh
```

When the script runs in Terminal or Git Bash, it first asks the user to choose Turkish or English. To skip the prompt, use `--lang tr` or `--lang en`; English remains the default for scheduled non-interactive runs.

## Verify the result

```bash
source ~/.config/dante-update/servers.conf
ssh "$TARGET_HOST" 'ufw status numbered; systemctl is-active danted; grep -A6 "# home-auto" /etc/danted.conf'
```

Expected results:

- UFW permits your current home IP to reach `33534/tcp`.
- The rule has the `dante-home-auto` comment.
- `danted` reports `active`.
- The `from:` line in the `# home-auto` block on every selected server contains your current `/32` address.

## Safety and rollback

- Every modified Dante file is backed up on its server; if Dante cannot restart, the script attempts to restore the backup automatically.
- The script removes only its old UFW rules labelled `dante-home-auto`; it does not delete manual or unlabelled rules.
- If UFW is inactive, the script refuses to enable or modify it.
- Your server addresses remain only in a permission-restricted local configuration file.
