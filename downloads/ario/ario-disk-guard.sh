#!/usr/bin/env bash
# AR.IO Disk Guard
# Automatic, cache-only disk protection for AR.IO Core.
# It never deletes SQLite, Redis, Docker volumes, or files outside the verified cache path.
set -Eeuo pipefail

VERSION=3.0.0
SELF=$(readlink -f -- "$0")
DIR=${ARIO_DIR:-/root/ar-io-node}
LANGUAGE=${GUARD_LANG:-}
MODE=${1:---setup}
STATE_DIR=/run/ario-disk-guard
LOCK=/run/lock/ario-disk-guard.lock
MIN_AGE_MINUTES=60
MAX_DELETE=200000
MAX_SECONDS=900
RECOVERY_COOLDOWN=21600
AUTO_RECOVER=0

say() {
  if [[ "$LANGUAGE" == "tr" ]]; then printf '%s\n' "$1"; else printf '%s\n' "$2"; fi
}
log() { printf '[%s] %s\n' "$(date -Is)" "$*"; logger -t ario-disk-guard -- "$*" 2>/dev/null || true; }
fail() { log "ERROR: $*"; exit 1; }
need_root() { (( EUID == 0 )) || fail 'Run this tool as root or with sudo.'; }

choose_language() {
  [[ -n "$LANGUAGE" ]] && return
  if [[ "${LANG:-}" == tr_* || "${LANG:-}" == tr.* ]]; then LANGUAGE=tr; else LANGUAGE=en; fi
  if [[ -t 0 ]]; then
    printf '\nDil / Language\n  1) Türkçe\n  2) English\nSeçim / Choice [%s]: ' "$( [[ "$LANGUAGE" == tr ]] && printf 1 || printf 2 )"
    read -r answer || true
    case "$answer" in 1|tr|TR) LANGUAGE=tr ;; 2|en|EN) LANGUAGE=en ;; esac
  fi
}

need_project() {
  [[ "$DIR" == /* ]] || fail 'Project directory must be an absolute path.'
  [[ -d "$DIR" && -f "$DIR/docker-compose.yaml" ]] || fail "Missing $DIR/docker-compose.yaml"
  command -v docker >/dev/null || fail 'Docker is not installed.'
  docker compose version >/dev/null || fail 'Docker Compose is not available.'
}
compose() { docker compose -f "$DIR/docker-compose.yaml" --project-directory "$DIR" "$@"; }
core_id() { compose ps -q core 2>/dev/null || true; }
health() { docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1" 2>/dev/null || printf 'missing'; }
disk_used() { df -P "$DIR" | awk 'NR==2 {gsub(/%/,"",$5); print $5}'; }
disk_available_gib() { df -Pk "$DIR" | awk 'NR==2 {print int($4/1024/1024)}'; }
half_disk_gib() { df -Pk "$DIR" | awk 'NR==2 {print int(($2/1024/1024 + 1)/2)}'; }

cache_path() {
  local root expected path
  root=$(realpath -e -- "$DIR") || fail 'Project directory cannot be resolved.'
  expected="$root/data/contiguous/data"
  [[ -d "$expected" ]] || fail "Cache directory missing: $expected"
  path=$(realpath -e -- "$expected") || fail 'Cache directory cannot be resolved.'
  [[ "$path" == "$expected" ]] || fail 'Cache path is symlinked; refusing to proceed.'
  [[ ! -L "$root/data" && ! -L "$root/data/contiguous" && ! -L "$expected" ]] || fail 'Cache path contains a symlink; refusing to proceed.'
  printf '%s\n' "$path"
}

validate_cache_safety() {
  local id=$1 envs
  [[ -n "$id" ]] || fail 'AR.IO Core container was not found.'
  envs=$(docker inspect "$id" --format '{{range .Config.Env}}{{println .}}{{end}}') || fail 'Cannot inspect AR.IO Core.'
  grep -Fxq 'ENABLE_CONTIGUOUS_DATA_CACHE_INDEX=false' <<< "$envs" || fail 'Cache index is enabled or cannot be verified; refusing direct cache pruning.'
  [[ "$(docker inspect -f '{{.State.Running}}' "$id")" == true ]] || fail 'AR.IO Core is not running; refusing to change its state.'
}

acquire_lock() {
  mkdir -p /run/lock "$STATE_DIR"
  exec 9>"$LOCK"
  flock -n 9 || fail 'Another AR.IO Disk Guard operation is already running.'
}

prune_cache() {
  local path=$1 target=$2
  GUARD_CACHE_PATH="$path" GUARD_TARGET_BYTES="$(( target * 1024 * 1024 * 1024 ))" \
  GUARD_MIN_AGE_SECONDS="$(( MIN_AGE_MINUTES * 60 ))" GUARD_MAX_DELETE="$MAX_DELETE" \
  GUARD_MAX_SECONDS="$MAX_SECONDS" python3 - <<'PY'
import os, stat, sys, time
root = os.environ['GUARD_CACHE_PATH']
target = int(os.environ['GUARD_TARGET_BYTES'])
cutoff = time.time() - int(os.environ['GUARD_MIN_AGE_SECONDS'])
max_delete = int(os.environ['GUARD_MAX_DELETE'])
max_seconds = int(os.environ['GUARD_MAX_SECONDS'])
started = time.monotonic()
removed = freed = errors = seen = 0

def available():
    value = os.statvfs(root)
    return value.f_bavail * value.f_frsize

initial = available()
print(f'Cache-only recovery: available={initial // 2**30} GiB, target={target // 2**30} GiB', flush=True)
if initial >= target:
    print('Free-space target already reached. Nothing deleted.', flush=True)
    sys.exit(0)

stack = [root]
while stack and time.monotonic() - started < max_seconds and removed < max_delete and available() < target:
    directory = stack.pop()
    try:
        with os.scandir(directory) as entries:
            for entry in entries:
                if time.monotonic() - started >= max_seconds or removed >= max_delete or available() >= target:
                    break
                try:
                    if entry.is_dir(follow_symlinks=False):
                        stack.append(entry.path)
                        continue
                    if not entry.is_file(follow_symlinks=False):
                        continue
                    seen += 1
                    info = entry.stat(follow_symlinks=False)
                    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_mtime > cutoff:
                        continue
                    os.unlink(entry.path)
                    removed += 1
                    freed += info.st_size
                    if removed % 500 == 0:
                        print(f'deleted={removed} estimated_bytes={freed}', flush=True)
                except OSError as exc:
                    errors += 1
                    if errors <= 5:
                        print(f'Skipped entry: {exc}', file=sys.stderr, flush=True)
    except OSError as exc:
        errors += 1
        if errors <= 5:
            print(f'Skipped directory: {exc}', file=sys.stderr, flush=True)

final = available()
print(f'Completed: scanned_files={seen}, deleted={removed}, estimated_bytes={freed}, errors={errors}, available_before={initial // 2**30} GiB, available_after={final // 2**30} GiB', flush=True)
sys.exit(3 if errors else 0)
PY
}

recover() {
  need_root; need_project
  command -v python3 >/dev/null || fail 'Python 3 is required.'
  command -v flock >/dev/null || fail 'flock is required.'
  acquire_lock
  local target id path stopped=0 rc=0
  target=$(half_disk_gib)
  (( target >= 1 )) || fail 'Could not calculate the free-space target.'
  id=$(core_id)
  validate_cache_safety "$id"
  path=$(cache_path)
  say "Yalnızca eski AR.IO cache dosyaları temizlenir. Hedef: en az ${target} GiB boş alan." "Only old AR.IO cache files are cleaned. Target: at least ${target} GiB free space."
  log "Auto recovery started: target=${target} GiB, cache=$path"
  log 'Stopping AR.IO Core temporarily for cache-only recovery'
  docker stop --time 45 "$id" >/dev/null || fail 'Could not stop AR.IO Core; no files were deleted.'
  stopped=1
  restore_core() {
    if (( stopped )); then
      log 'Starting the same AR.IO Core container'
      docker start "$id" >/dev/null || log 'ERROR: AR.IO Core could not be restarted automatically.'
      stopped=0
    fi
  }
  trap 'restore_core' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  prune_cache "$path" "$target" || rc=$?
  restore_core
  trap - EXIT INT TERM
  if (( rc != 0 )); then log "Recovery completed with warnings (exit=$rc)."; return "$rc"; fi
  log 'Cache-only recovery finished.'
}

watch() {
  need_root; need_project
  local target available used now last=0 id status
  target=$(half_disk_gib)
  available=$(disk_available_gib)
  used=$(disk_used)
  [[ "$target" =~ ^[0-9]+$ && "$available" =~ ^[0-9]+$ && "$used" =~ ^[0-9]+$ ]] || fail 'Could not read disk capacity.'
  log "Disk usage=${used}%, free=${available} GiB, automatic target=${target} GiB"
  if (( available < target && AUTO_RECOVER )); then
    mkdir -p "$STATE_DIR"
    [[ -f "$STATE_DIR/last-recovery" ]] && read -r last < "$STATE_DIR/last-recovery" || true
    [[ "$last" =~ ^[0-9]+$ ]] || last=0
    now=$(date +%s)
    if (( now - last >= RECOVERY_COOLDOWN )); then
      printf '%s\n' "$now" > "$STATE_DIR/last-recovery"
      log 'Free-space threshold reached; starting automatic cache recovery.'
      recover || log 'Automatic cache recovery failed; inspect service logs.'
    else
      log 'Automatic recovery cooldown is active.'
    fi
    return
  fi
  id=$(core_id)
  [[ -n "$id" ]] || { log 'AR.IO Core container not found.'; return; }
  status=$(health "$id")
  log "Core health=$status"
}

install_timer() {
  need_root; need_project
  local dest=/usr/local/sbin/ario-disk-guard
  install -m 0755 "$SELF" "$dest"
  cat > /etc/systemd/system/ario-disk-guard.service <<UNIT
[Unit]
Description=AR.IO Disk Guard automatic cache protection
Wants=docker.service
After=docker.service

[Service]
Type=oneshot
ExecStart=$dest --watch --dir $DIR --lang $LANGUAGE --auto-recover
TimeoutStartSec=1200
UNIT
  cat > /etc/systemd/system/ario-disk-guard.timer <<'UNIT'
[Unit]
Description=Run AR.IO Disk Guard every 15 minutes

[Timer]
OnBootSec=3min
OnUnitInactiveSec=15min
Persistent=true
Unit=ario-disk-guard.service

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable --now ario-disk-guard.timer
  systemctl start ario-disk-guard.service
  say 'Kurulum tamamlandı. İlk kontrol yapıldı; araç bundan sonra her 15 dakikada bir otomatik çalışacak.' 'Setup complete. The first check has run; the tool will now run automatically every 15 minutes.'
}

setup() {
  need_root; need_project
  choose_language
  local target
  target=$(half_disk_gib)
  say "Bu araç diskin en az yarısını boş tutar: bu sunucuda hedef ${target} GiB." "This tool keeps at least half of the disk free: the target on this server is ${target} GiB."
  say 'Yalnızca eski AR.IO cache dosyaları otomatik temizlenir. SQLite, Redis ve diğer projeler korunur.' 'Only old AR.IO cache files are cleaned automatically. SQLite, Redis, and other projects are protected.'
  if [[ -t 0 ]]; then
    if [[ "$LANGUAGE" == tr ]]; then printf 'Otomatik korumayı kurmak için KUR yazın: '; else printf 'Type INSTALL to enable automatic protection: '; fi
    read -r answer
    if [[ "$LANGUAGE" == tr ]]; then [[ "$answer" == KUR ]] || { say 'Kurulum iptal edildi.' 'Setup cancelled.'; return; }
    else [[ "$answer" == INSTALL ]] || { say 'Kurulum iptal edildi.' 'Setup cancelled.'; return; }; fi
  fi
  install_timer
}

status() {
  need_project
  choose_language
  say 'AR.IO Disk Guard durumu' 'AR.IO Disk Guard status'
  df -h "$DIR"
  systemctl status ario-disk-guard.timer --no-pager || true
  journalctl -u ario-disk-guard.service -n 30 --no-pager || true
}

shift || true
while (($#)); do
  case "$1" in
    --dir) DIR=${2:?}; shift 2 ;;
    --lang) LANGUAGE=${2:?}; shift 2 ;;
    --auto-recover) AUTO_RECOVER=1; shift ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

case "$MODE" in
  --setup) setup ;;
  --watch) watch ;;
  --status) status ;;
  --help|-h)
    printf 'AR.IO Disk Guard v%s\n\nRun without arguments for automatic setup.\n' "$VERSION"
    ;;
  *) fail "Unknown mode: $MODE" ;;
esac
