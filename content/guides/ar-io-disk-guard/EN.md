---
slug: ar-io-disk-guard
date: 2026-11-17
---

# AR.IO Disk Guard

AR.IO Disk Guard automatically protects free disk space on AR.IO Core servers.

## Quick installation

Connect to your AR.IO server over SSH, then run the following command in the server terminal. The script is downloaded directly from KolTigin.xyz, asks you to choose a language, performs the first check, and installs automatic protection.

```bash
curl -fsSL https://koltigin.xyz/downloads/ario/ario-disk-guard.sh -o /root/ario-disk-guard.sh && chmod 700 /root/ario-disk-guard.sh && bash /root/ario-disk-guard.sh
```

At the language prompt, select `2` for English. Then enter the confirmation word shown on screen to enable automatic protection.

## What it does

The tool automatically detects disk capacity and keeps at least half of the disk free. After its first check, it runs every 15 minutes in the background.

When free space drops below the target, it removes only old AR.IO cache files. It stops when the target is reached. No routine manual cleanup or additional configuration is required after setup.

## Protected data

AR.IO Disk Guard works only inside the verified AR.IO cache directory.

It never deletes or changes:

- SQLite databases
- Redis data
- Docker volumes
- Other nodes or projects
- Files outside the AR.IO cache directory

If cleanup is needed, AR.IO Core is temporarily stopped and automatically restarted when the work is complete.

## Status and logs

To view free disk space, timer status, and recent logs:

```bash
bash /root/ario-disk-guard.sh --status
```

It is normal for the service to appear inactive after a check completes. The timer starts it every 15 minutes and it exits when its work is complete.

## Uninstall

To remove the AR.IO Disk Guard timer and script files:

```bash
bash /root/ario-disk-guard.sh --uninstall
```

Uninstalling does not delete AR.IO data, cache files, or Docker containers.
