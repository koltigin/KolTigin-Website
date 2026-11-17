#!/usr/bin/env bash
# Updates the Dante "home-auto" source address on four servers.
# It changes UFW only on Alper (38.242.251.142), for TCP port 33534.

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly DANTE_CONFIG='/etc/danted.conf'
readonly HOME_MARKER='home-auto'
readonly UFW_TAG='dante-home-auto'
readonly ALPER_HOST='root@38.242.251.142'
readonly ALPER_PROXY_PORT='33534'
LANGUAGE='en'

# The first three servers deliberately have no UFW action in this script.
SERVERS=(
  'root@194.163.172.118'
  'root@194.163.159.100'
  'root@176.57.189.36'
  "$ALPER_HOST"
)

SSH_OPTIONS=(
  -o BatchMode=yes
  -o ConnectTimeout=10
  -o ConnectionAttempts=1
  -o ServerAliveInterval=5
  -o ServerAliveCountMax=2
  -o StrictHostKeyChecking=accept-new
)

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

say() {
  local key=$1
  shift
  case "${LANGUAGE}:${key}" in
    tr:detected) log "Algılanan ev genel IPv4 adresi: $1" ;;
    en:detected) log "Detected home public IPv4: $1" ;;
    tr:preflight) log "Ön denetim: $1" ;;
    en:preflight) log "Preflight: $1" ;;
    tr:check) log 'Ön denetim başarılı; hiçbir değişiklik yapılmadı.' ;;
    en:check) log 'Preflight passed; no changes were made.' ;;
    tr:ufw) log "Alper UFW eşitleniyor (yalnızca $1/tcp)" ;;
    en:ufw) log "Synchronizing UFW on Alper ($1/tcp only)" ;;
    tr:dante) log "Dante güncelleniyor: $1" ;;
    en:dante) log "Updating Dante on $1" ;;
    tr:done) log 'Başarıyla tamamlandı.' ;;
    en:done) log 'Completed successfully.' ;;
  esac
}

usage() {
  cat >&2 <<'USAGE'
Usage / Kullanım:
  update-dante-ip.sh [--check] [--lang tr|en]

  --check          Read-only SSH and UFW preflight / Salt-okunur SSH ve UFW ön denetimi
  --lang tr|en     Progress-message language (default: en) / İlerleme iletisi dili (varsayılan: en)
USAGE
}

cleanup() { rmdir "$LOCK_DIR" 2>/dev/null || true; }
trap cleanup EXIT
trap 'die "Line $LINENO failed."' ERR

readonly LOCK_DIR="${TMPDIR:-/tmp}/update-dante-ip.lock"
mkdir "$LOCK_DIR" 2>/dev/null || die 'Another update-dante-ip.sh run is already active.'

is_ipv4() {
  local ip=$1 octet
  [[ $ip =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || return 1
  IFS=. read -r -a octets <<<"$ip"
  for octet in "${octets[@]}"; do
    (( 10#$octet <= 255 )) || return 1
  done
}

get_public_ipv4() {
  local url ip
  for url in 'https://api.ipify.org' 'https://ifconfig.me/ip'; do
    ip=$(curl -4 --fail --silent --show-error --max-time 10 "$url" | tr -d '[:space:]') || continue
    if is_ipv4 "$ip"; then
      printf '%s\n' "$ip"
      return 0
    fi
  done
  return 1
}

ssh_run() {
  local host=$1
  shift
  ssh "${SSH_OPTIONS[@]}" "$host" "$@"
}

preflight_server() {
  local host=$1
  ssh_run "$host" 'bash -s' <<'REMOTE'
set -Eeuo pipefail
test -f /etc/danted.conf
command -v systemctl >/dev/null
grep -q '# home-auto' /etc/danted.conf
REMOTE
}

update_dante() {
  local host=$1 ip=$2
  ssh_run "$host" "bash -s -- $(printf '%q ' "$ip" "$DANTE_CONFIG" "$HOME_MARKER")" <<'REMOTE'
set -Eeuo pipefail
ip=$1 config=$2 marker=$3
backup="${config}.bak.$(date +%Y%m%d%H%M%S).$$"
tmp="${config}.tmp.$$"

# Exactly one `from:` line must occur in the six lines after # home-auto.
# This avoids silently editing an unrelated client rule.
awk -v ip="$ip" -v marker="$marker" '
  BEGIN { pending=0; changed=0; bad=0 }
  $0 ~ "# " marker { pending=6; print; next }
  pending > 0 {
    if ($1 == "from:") {
      if (changed) { bad=1; print; next }
      sub(/^[[:space:]]*from:[[:space:]]*[0-9.]+\/32/, "        from: " ip "/32")
      changed=1
      pending=0
    } else {
      pending--
    }
  }
  { print }
  END { if (changed != 1 || bad) exit 42 }
' "$config" >"$tmp" || { rm -f "$tmp"; echo 'home-auto block is ambiguous or missing' >&2; exit 42; }

if cmp -s "$config" "$tmp"; then
  rm -f "$tmp"
  echo 'Dante already has the current home IPv4.'
  exit 0
fi

cp -a "$config" "$backup"
mv "$tmp" "$config"
if systemctl restart danted && systemctl is-active --quiet danted; then
  echo "Dante updated; backup: $backup"
else
  cp -a "$backup" "$config"
  systemctl restart danted || true
  echo "Dante restart failed; restored $backup" >&2
  exit 1
fi
REMOTE
}

sync_alper_ufw() {
  local ip=$1
  ssh_run "$ALPER_HOST" "bash -s -- $(printf '%q ' "$ip" "$ALPER_PROXY_PORT" "$UFW_TAG")" <<'REMOTE'
set -Eeuo pipefail
ip=$1 port=$2 tag=$3
command -v ufw >/dev/null
ufw status | grep -qx 'Status: active' || { echo 'UFW is inactive; refusing to enable or modify it.' >&2; exit 1; }

# Delete only numbered rules carrying our unique tag, in descending order.
# Untagged rules are never deleted by this script.
mapfile -t rule_numbers < <(
  ufw status numbered | awk -v port="$port" -v tag="$tag" '
    $0 ~ (port "/tcp") && index($0, tag) {
      number=$0
      sub(/^[[:space:]]*\[[[:space:]]*/, "", number)
      sub(/\].*$/, "", number)
      gsub(/[[:space:]]/, "", number)
      if (number ~ /^[0-9]+$/) print number
    }' | sort -rn
)
for number in "${rule_numbers[@]:-}"; do
  [[ -n $number ]] && ufw --force delete "$number"
done

# Always add/check the present /32, even if Dante already had this address.
ufw --force allow from "$ip/32" to any port "$port" proto tcp comment "$tag"

# Confirm an effective current-IP rule exists. An older untagged current rule
# is accepted, but is left untouched rather than guessing that it is ours.
ufw status | awk -v ip="$ip" -v port="$port" '
  $1 == port "/tcp" && $2 == "ALLOW" && $3 == "IN" && $4 == ip { found=1 }
  END { exit(found ? 0 : 1) }
' || { echo 'UFW verification failed.' >&2; exit 1; }

echo "UFW permits ${ip}/32 to TCP ${port}; managed old rules were removed."
REMOTE
}

check_alper_ufw() {
  ssh_run "$ALPER_HOST" "bash -s -- $(printf '%q ' "$ALPER_PROXY_PORT")" <<'REMOTE'
set -Eeuo pipefail
port=$1
command -v ufw >/dev/null
ufw status | grep -qx 'Status: active'
echo "Current Alper UFW rules for TCP ${port}:"
ufw status numbered | grep "${port}/tcp" || true
REMOTE
}

main() {
  local current_ip host check_only=0
  while (( $# > 0 )); do
    case "$1" in
      --check) check_only=1 ;;
      --lang)
        shift
        (( $# > 0 )) || { usage; die '--lang requires tr or en.'; }
        LANGUAGE=$1
        ;;
      --lang=tr) LANGUAGE='tr' ;;
      --lang=en) LANGUAGE='en' ;;
      -h|--help) usage; return 0 ;;
      *) usage; die "Unknown option: $1" ;;
    esac
    shift
  done
  [[ $LANGUAGE == tr || $LANGUAGE == en ]] || { usage; die 'Language must be tr or en.'; }

  current_ip=$(get_public_ipv4) || die 'Could not determine a valid public IPv4 address.'
  say detected "$current_ip"

  # Fail before mutations if any server is not reachable or lacks its marker.
  for host in "${SERVERS[@]}"; do
    say preflight "$host"
    preflight_server "$host"
  done

  if (( check_only )); then
    check_alper_ufw
    say check
    return 0
  fi

  # Alper UFW is deliberately independent of Dante's previous/current IP.
  say ufw "$ALPER_PROXY_PORT"
  sync_alper_ufw "$current_ip"

  for host in "${SERVERS[@]}"; do
    say dante "$host"
    update_dante "$host" "$current_ip"
  done
  say done
}

main "$@"
