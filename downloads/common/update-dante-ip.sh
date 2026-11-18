#!/usr/bin/env bash
# Updates the Dante "home-auto" source address on one to six servers.
# Server names and the UFW target are loaded from a private local config file.

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly DANTE_CONFIG='/etc/danted.conf'
readonly HOME_MARKER='home-auto'
readonly UFW_TAG='dante-home-auto'
LANGUAGE='en'
LANGUAGE_EXPLICIT=0
ACTION=''
readonly CONFIG_FILE="${DANTE_UPDATE_CONFIG:-$HOME/.config/dante-update/servers.conf}"

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
    tr:ufw) log "Hedef sunucuda UFW eşitleniyor (yalnızca $1/tcp)" ;;
    en:ufw) log "Synchronizing UFW on the target server ($1/tcp only)" ;;
    tr:dante) log "Dante güncelleniyor: $1" ;;
    en:dante) log "Updating Dante on $1" ;;
    tr:done) log 'Başarıyla tamamlandı.' ;;
    en:done) log 'Completed successfully.' ;;
  esac
}

usage() {
  cat >&2 <<'USAGE'
Usage / Kullanım:
  update-dante-ip.sh [--setup] [--check] [--lang tr|en]

  --setup          Start the interactive server setup wizard
                   Etkileşimli sunucu kurulum sihirbazını başlat
  --check          Read-only SSH and UFW preflight / Salt-okunur SSH ve UFW ön denetimi
  --lang tr|en     Progress-message language (default: en) / İlerleme iletisi dili (varsayılan: en)
USAGE
}

choose_action() {
  local choice
  [[ -t 0 && -t 1 ]] || { printf 'ERROR: Use --setup, --check, or --lang in non-interactive mode.\n' >&2; exit 1; }
  if [[ $LANGUAGE == tr ]]; then
    printf '\nDante Proxy Yönetimi\n  1) İlk kurulum / sunucu bilgilerini düzenle\n  2) Güvenli ön denetim\n  3) IP güncellemesini başlat\n  4) Çıkış\nSeçim [1-4]: ' >&2
  else
    printf '\nDante Proxy Manager\n  1) First setup / edit server details\n  2) Safe preflight check\n  3) Start IP update\n  4) Exit\nSelection [1-4]: ' >&2
  fi
  read -r choice || true
  case "$choice" in
    1) ACTION='setup' ;;
    2) ACTION='check' ;;
    3) ACTION='update' ;;
    4) ACTION='exit' ;;
    *) die 'Invalid menu selection.' ;;
  esac
}

choose_language() {
  local choice
  (( LANGUAGE_EXPLICIT )) && return 0
  # Do not prompt in scheduled/non-interactive runs; retain English by default.
  [[ -t 0 && -t 1 ]] || return 0
  printf '\nDil / Language\n  1) Türkçe\n  2) English\nSeçim / Selection [2]: ' >&2
  read -r choice || true
  case "$choice" in
    1|tr|TR) LANGUAGE='tr' ;;
    ''|2|en|EN) LANGUAGE='en' ;;
    *) log 'Invalid selection; English was selected.' ;;
  esac
}

setup_config() {
  local config_dir host username destination server_count target_number port overwrite
  local -a configured_servers=()
  [[ -t 0 && -t 1 ]] || die '--setup must be run interactively in Terminal or Git Bash.'
  config_dir=$(dirname "$CONFIG_FILE")
  mkdir -p "$config_dir"
  chmod 700 "$config_dir"

  if [[ -e $CONFIG_FILE ]]; then
    if [[ $LANGUAGE == tr ]]; then
      read -r -p 'Mevcut sunucu bilgileri değiştirilecek. Devam edilsin mi? [e/H]: ' overwrite
    else
      read -r -p 'Existing server details will be replaced. Continue? [y/N]: ' overwrite
    fi
    [[ $overwrite =~ ^([eEyY])$ ]] || return 0
  fi

  if [[ $LANGUAGE == tr ]]; then
    printf '\nKaç sunucu yapılandırmak istediğinizi seçin; ardından SSH bilgileri sorulacaktır.\n' >&2
  else
    printf '\nChoose how many servers to configure; SSH details will then be requested.\n' >&2
  fi
  while :; do
    if [[ $LANGUAGE == tr ]]; then
      read -r -p 'Sunucu sayısı [1-6]: ' server_count
    else
      read -r -p 'Number of servers [1-6]: ' server_count
    fi
    [[ $server_count =~ ^[1-6]$ ]] && break
  done
  for ((target_number = 1; target_number <= server_count; target_number++)); do
    while :; do
      if [[ $LANGUAGE == tr ]]; then
        read -r -p "Sunucu ${target_number} adresi: " host
        read -r -p "Sunucu ${target_number} SSH kullanıcısı [root]: " username
      else
        read -r -p "Server ${target_number} address: " host
        read -r -p "Server ${target_number} SSH username [root]: " username
      fi
      username=${username:-root}
      [[ $host =~ ^[A-Za-z0-9][A-Za-z0-9._:-]*$ && $username =~ ^[A-Za-z_][A-Za-z0-9_-]*$ ]] && break
      if [[ $LANGUAGE == tr ]]; then
        printf 'Geçersiz adres veya kullanıcı adı. Tekrar deneyin.\n' >&2
      else
        printf 'Invalid address or username. Please try again.\n' >&2
      fi
    done
    configured_servers+=("${username}@${host}")
  done

  while :; do
    if [[ $LANGUAGE == tr ]]; then
      read -r -p "UFW güncellemesi yapılacak sunucu numarası [1-${server_count}]: " target_number
    else
      read -r -p "Server number to receive the UFW update [1-${server_count}]: " target_number
    fi
    [[ $target_number =~ ^[1-6]$ && $target_number -le $server_count ]] && break
  done
  while :; do
    if [[ $LANGUAGE == tr ]]; then
      read -r -p 'Dante/proxy TCP portu [33534]: ' port
    else
      read -r -p 'Dante/proxy TCP port [33534]: ' port
    fi
    port=${port:-33534}
    [[ $port =~ ^[0-9]{1,5}$ && $port -ge 1 && $port -le 65535 ]] && break
  done

  {
    printf '# Private Dante update configuration. Do not publish this file.\nSERVERS=(\n'
    for destination in "${configured_servers[@]}"; do
      printf '  %q\n' "$destination"
    done
    printf ')\nTARGET_HOST=%q\nTARGET_PROXY_PORT=%q\n' "${configured_servers[$((target_number - 1))]}" "$port"
  } >"$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE"
  load_config
  [[ $LANGUAGE == tr ]] && log "Özel yapılandırma hazır: $CONFIG_FILE" || log "Private configuration is ready: $CONFIG_FILE"
}

load_config() {
  local host target_found=0
  [[ -r $CONFIG_FILE ]] || die "Private config not found: $CONFIG_FILE"
  # shellcheck source=/dev/null
  source "$CONFIG_FILE"
  declare -p SERVERS >/dev/null 2>&1 || die 'SERVERS is required in the private config.'
  [[ ${#SERVERS[@]} -ge 1 && ${#SERVERS[@]} -le 6 ]] || die 'SERVERS must contain between one and six SSH destinations.'
  [[ -n ${TARGET_HOST:-} && -n ${TARGET_PROXY_PORT:-} ]] || die 'TARGET_HOST and TARGET_PROXY_PORT are required.'
  [[ $TARGET_PROXY_PORT =~ ^[0-9]{1,5}$ && $TARGET_PROXY_PORT -ge 1 && $TARGET_PROXY_PORT -le 65535 ]] || die 'TARGET_PROXY_PORT must be between 1 and 65535.'
  for host in "${SERVERS[@]}"; do
    [[ $host == "$TARGET_HOST" ]] && target_found=1
  done
  (( target_found )) || die 'TARGET_HOST must also appear in SERVERS.'
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

sync_target_ufw() {
  local ip=$1
  ssh_run "$TARGET_HOST" "bash -s -- $(printf '%q ' "$ip" "$TARGET_PROXY_PORT" "$UFW_TAG")" <<'REMOTE'
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

check_target_ufw() {
  ssh_run "$TARGET_HOST" "bash -s -- $(printf '%q ' "$TARGET_PROXY_PORT")" <<'REMOTE'
set -Eeuo pipefail
port=$1
command -v ufw >/dev/null
ufw status | grep -qx 'Status: active'
echo "Current UFW rules on the target server for TCP ${port}:"
ufw status numbered | grep "${port}/tcp" || true
REMOTE
}

main() {
  local current_ip host check_only=0 setup_only=0
  while (( $# > 0 )); do
    case "$1" in
      --setup) setup_only=1 ;;
      --check) check_only=1 ;;
      --lang)
        shift
        (( $# > 0 )) || { usage; die '--lang requires tr or en.'; }
        LANGUAGE=$1
        LANGUAGE_EXPLICIT=1
        ;;
      --lang=tr) LANGUAGE='tr'; LANGUAGE_EXPLICIT=1 ;;
      --lang=en) LANGUAGE='en'; LANGUAGE_EXPLICIT=1 ;;
      -h|--help) usage; return 0 ;;
      *) usage; die "Unknown option: $1" ;;
    esac
    shift
  done
  [[ $LANGUAGE == tr || $LANGUAGE == en ]] || { usage; die 'Language must be tr or en.'; }
  choose_language

  if (( setup_only )); then
    (( check_only == 0 )) || die '--setup and --check cannot be used together.'
    ACTION='setup'
  elif (( check_only )); then
    ACTION='check'
  elif [[ -t 0 && -t 1 ]]; then
    choose_action
  else
    ACTION='update'
  fi

  case "$ACTION" in
    exit) return 0 ;;
    setup) setup_config; return 0 ;;
    check|update) ;;
    *) die 'No action selected.' ;;
  esac

  load_config

  current_ip=$(get_public_ipv4) || die 'Could not determine a valid public IPv4 address.'
  say detected "$current_ip"

  # Fail before mutations if any server is not reachable or lacks its marker.
  for host in "${SERVERS[@]}"; do
    say preflight "$host"
    preflight_server "$host"
  done

  if [[ $ACTION == check ]]; then
    check_target_ufw
    say check
    return 0
  fi

  # Target-server UFW is deliberately independent of Dante's previous/current IP.
  say ufw "$TARGET_PROXY_PORT"
  sync_target_ufw "$current_ip"

  for host in "${SERVERS[@]}"; do
    say dante "$host"
    update_dante "$host" "$current_ip"
  done
  say done
}

main "$@"
