#!/bin/bash
set -euo pipefail

# ============================================================
# Redbelly Mainnet Telegram Monitor - Bilingual Installer
# Languages: Turkish / English
# ============================================================

APP_NAME="redbelly-telegram-monitor"
MONITOR_BIN="/usr/local/bin/${APP_NAME}"
CONFIG_FILE="/etc/${APP_NAME}.conf"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
TIMER_FILE="/etc/systemd/system/${APP_NAME}.timer"

DEFAULT_LOG_FILE="/var/log/redbelly/rbn_logs/rbbc_logs.log"
DEFAULT_RPC_ENDPOINT="https://governors.mainnet.redbelly.network"
DEFAULT_REDBELLY_SERVICE="redbelly.service"
DEFAULT_INTERVAL="30"
DEFAULT_SYNC_THRESHOLD="3"

LANG_CODE="tr"

t() {
  local key="$1"
  case "${LANG_CODE}:${key}" in
    tr:need_root) echo "❌ Bu installer root yetkisiyle çalıştırılmalıdır." ;;
    en:need_root) echo "❌ This installer must be run as root." ;;

    tr:installing_deps) echo "📦 Eksik paketler kuruluyor:" ;;
    en:installing_deps) echo "📦 Installing missing packages:" ;;

    tr:title) echo " Redbelly Mainnet Telegram Monitor - Kurulum" ;;
    en:title) echo " Redbelly Mainnet Telegram Monitor - Installation" ;;

    tr:bot_token) echo -n "🤖 Telegram Bot Token: " ;;
    en:bot_token) echo -n "🤖 Telegram Bot Token: " ;;

    tr:chat_id) echo -n "💬 Telegram Chat ID: " ;;
    en:chat_id) echo -n "💬 Telegram Chat ID: " ;;

    tr:domain) echo -n "🌐 Redbelly node alan adı (örn. node.example.com): " ;;
    en:domain) echo -n "🌐 Redbelly node domain (e.g. node.example.com): " ;;

    tr:interval) echo -n "⏱ Kaç dakikada bir Telegram mesajı gönderilsin? [${DEFAULT_INTERVAL}]: " ;;
    en:interval) echo -n "⏱ How often should Telegram messages be sent, in minutes? [${DEFAULT_INTERVAL}]: " ;;

    tr:bad_interval) echo "❌ Lütfen 1 veya daha büyük bir tam sayı girin." ;;
    en:bad_interval) echo "❌ Please enter an integer greater than or equal to 1." ;;

    tr:settings) echo "Ayarlar:" ;;
    en:settings) echo "Settings:" ;;

    tr:continue) echo -n "Kuruluma devam edilsin mi? [Y/n]: " ;;
    en:continue) echo -n "Continue with installation? [Y/n]: " ;;

    tr:cancelled) echo "İptal edildi." ;;
    en:cancelled) echo "Cancelled." ;;

    tr:test_creds) echo "🔎 Telegram bilgileri test ediliyor..." ;;
    en:test_creds) echo "🔎 Testing Telegram credentials..." ;;

    tr:test_ok) echo "✅ Telegram testi başarılı." ;;
    en:test_ok) echo "✅ Telegram test successful." ;;

    tr:test_fail) echo "❌ Telegram testi başarısız." ;;
    en:test_fail) echo "❌ Telegram test failed." ;;

    tr:first_report) echo "🚀 İlk Redbelly durum mesajı gönderiliyor..." ;;
    en:first_report) echo "🚀 Sending the first Redbelly status report..." ;;

    tr:first_ok) echo "✅ İlk durum mesajı gönderildi." ;;
    en:first_ok) echo "✅ First status report sent." ;;

    tr:first_fail) echo "⚠️ İlk durum kontrolünde hata oluştu." ;;
    en:first_fail) echo "⚠️ The first status check failed." ;;

    tr:installed) echo "✅ Redbelly Telegram Monitor kuruldu" ;;
    en:installed) echo "✅ Redbelly Telegram Monitor installed" ;;

    tr:commands) echo "Komutlar:" ;;
    en:commands) echo "Commands:" ;;

    tr:uninstalling) echo "🧹 Redbelly Telegram Monitor kaldırılıyor..." ;;
    en:uninstalling) echo "🧹 Uninstalling Redbelly Telegram Monitor..." ;;

    tr:uninstalled) echo "✅ Kaldırma tamamlandı." ;;
    en:uninstalled) echo "✅ Uninstall completed." ;;
  esac
}

choose_language() {
  clear 2>/dev/null || true
  echo "============================================================"
  echo " Redbelly Mainnet Telegram Monitor"
  echo "============================================================"
  echo
  echo "1) Türkçe"
  echo "2) English"
  echo

  local choice
  while true; do
    read -r -p "Dil / Language [1]: " choice
    choice="${choice:-1}"
    case "$choice" in
      1) LANG_CODE="tr"; break ;;
      2) LANG_CODE="en"; break ;;
      *) echo "Please select 1 or 2 / Lütfen 1 veya 2 seçin." ;;
    esac
  done
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    t need_root
    echo "   sudo bash $0"
    exit 1
  fi
}

install_dependencies() {
  local missing=()
  for cmd in curl jq openssl grep awk sed systemctl; do
    command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "$(t installing_deps) ${missing[*]}"
    apt-get update
    apt-get install -y curl jq openssl grep gawk sed
  fi
}

prompt_required() {
  local prompt_key="$1"
  local value=""
  while [[ -z "$value" ]]; do
    t "$prompt_key" >&2
    read -r value
  done
  printf '%s' "$value"
}

prompt_interval() {
  local value
  while true; do
    t interval >&2
    read -r value
    value="${value:-$DEFAULT_INTERVAL}"
    if [[ "$value" =~ ^[1-9][0-9]*$ ]]; then
      printf '%s' "$value"
      return
    fi
    t bad_interval >&2
  done
}

write_config() {
  local bot_token="$1"
  local chat_id="$2"
  local domain="$3"
  local interval="$4"

  umask 077
  {
    printf 'BOT_TOKEN=%q\n' "$bot_token"
    printf 'CHAT_ID=%q\n' "$chat_id"
    printf 'DOMAIN=%q\n' "$domain"
    printf 'INTERVAL_MINUTES=%q\n' "$interval"
    printf 'LANG_CODE=%q\n' "$LANG_CODE"
    printf 'LOG_FILE=%q\n' "$DEFAULT_LOG_FILE"
    printf 'RPC_ENDPOINT=%q\n' "$DEFAULT_RPC_ENDPOINT"
    printf 'REDBELLY_SERVICE=%q\n' "$DEFAULT_REDBELLY_SERVICE"
    printf 'SYNC_THRESHOLD=%q\n' "$DEFAULT_SYNC_THRESHOLD"
  } > "$CONFIG_FILE"

  chmod 600 "$CONFIG_FILE"
  chown root:root "$CONFIG_FILE"
}

write_monitor() {
  cat > "$MONITOR_BIN" <<'MONITOR_EOF'
#!/bin/bash
set -u

CONFIG_FILE="/etc/redbelly-telegram-monitor.conf"

if [[ ! -r "$CONFIG_FILE" ]]; then
  echo "Config not found: $CONFIG_FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"

CERT_FILE="/etc/redbelly/certs/${DOMAIN}/fullchain.pem"

send_telegram() {
  local message="$1"
  curl -fsS --max-time 20 \
    -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${CHAT_ID}" \
    --data-urlencode "text=${message}" \
    --data-urlencode "parse_mode=HTML"
}

cert_check() {
  if [[ ! -r "$CERT_FILE" ]]; then
    [[ "$LANG_CODE" == "tr" ]] && echo "❌ Sertifika okunamadı" || echo "❌ Certificate cannot be read"
    return
  fi

  local enddate expiry_epoch now_epoch days_left expiry_date
  enddate=$(openssl x509 -in "$CERT_FILE" -noout -enddate 2>/dev/null | cut -d= -f2)
  if [[ -z "$enddate" ]]; then
    [[ "$LANG_CODE" == "tr" ]] && echo "❌ Sertifika süresi okunamadı" || echo "❌ Certificate expiry cannot be read"
    return
  fi

  expiry_epoch=$(date -d "$enddate" +%s 2>/dev/null || true)
  now_epoch=$(date +%s)
  if [[ -z "$expiry_epoch" ]]; then
    [[ "$LANG_CODE" == "tr" ]] && echo "❌ Sertifika tarihi çözümlenemedi" || echo "❌ Certificate date cannot be parsed"
    return
  fi

  days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
  expiry_date=$(date -d "$enddate" '+%Y-%m-%d' 2>/dev/null || true)

  if (( days_left < 0 )); then
    [[ "$LANG_CODE" == "tr" ]] && echo "❌ Süresi dolmuş! (${expiry_date})" || echo "❌ Expired! (${expiry_date})"
  elif (( days_left <= 15 )); then
    [[ "$LANG_CODE" == "tr" ]] && echo "⚠️ ${days_left} gün kaldı! (${expiry_date})" || echo "⚠️ ${days_left} days left! (${expiry_date})"
  else
    [[ "$LANG_CODE" == "tr" ]] && echo "✅ Geçerli. (${days_left} gün kaldı)" || echo "✅ Valid. (${days_left} days left)"
  fi
}

governor_check() {
  local governor_line is_governor is_governor_next

  governor_line=$(grep -a 'Node governor status at latest round' "$LOG_FILE" 2>/dev/null | tail -1)

  if [[ -z "$governor_line" ]]; then
    GOV_STATUS="⚠️ Unknown"
    GOV_NEXT_STATUS="⚠️ Unknown"
    return
  fi

  is_governor=$(echo "$governor_line" | grep -oP 'isGovernor=\K(true|false)' | head -1 || true)
  is_governor_next=$(echo "$governor_line" | grep -oP 'isGovernorNext=\K(true|false)' | head -1 || true)

  case "$is_governor" in
    true)  GOV_STATUS="🟢 Governor" ;;
    false) GOV_STATUS="⚪ Candidate" ;;
    *)     GOV_STATUS="⚠️ Unknown" ;;
  esac

  case "$is_governor_next" in
    true)  GOV_NEXT_STATUS="🟢 Governor" ;;
    false) GOV_NEXT_STATUS="⚪ Candidate" ;;
    *)     GOV_NEXT_STATUS="⚠️ Unknown" ;;
  esac
}

node_status_from_log() {
  local status_line recovery

  status_line=$(grep -a 'msg="Node status"' "$LOG_FILE" 2>/dev/null | tail -1)

  if [[ -z "$status_line" ]]; then
    NODE_BLOCK=""
    SUPERBLOCK="-"
    RECOVERY_STATUS="⚠️ Unknown"
    NODE_VERSION="-"
    return
  fi

  NODE_BLOCK=$(echo "$status_line" | grep -oP 'CurrentBlock:\K[0-9]+' | head -1 || true)
  SUPERBLOCK=$(echo "$status_line" | grep -oP 'CurrentSuperblock:\K[0-9]+' | head -1 || true)
  recovery=$(echo "$status_line" | grep -oP 'status\.isRecoveryComplete=\K(true|false)' | head -1 || true)
  NODE_VERSION=$(echo "$status_line" | grep -oP 'status\.version="\K[^"]+' | head -1 || true)

  case "$recovery" in
    true)  RECOVERY_STATUS="✅ Complete" ;;
    false) RECOVERY_STATUS="⚠️ Incomplete" ;;
    *)     RECOVERY_STATUS="⚠️ Unknown" ;;
  esac

  SUPERBLOCK="${SUPERBLOCK:--}"
  NODE_VERSION="${NODE_VERSION:--}"
}

network_block_height() {
  local response latest_hex
  response=$(curl -fsS --max-time 15 \
    -X POST "$RPC_ENDPOINT" \
    -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    2>/dev/null) || { echo ""; return; }

  latest_hex=$(echo "$response" | jq -r '.result // empty' 2>/dev/null)

  if [[ "$latest_hex" =~ ^0x[0-9a-fA-F]+$ ]]; then
    printf '%d\n' "$latest_hex"
  else
    echo ""
  fi
}

if [[ ! -r "$LOG_FILE" ]]; then
  if [[ "$LANG_CODE" == "tr" ]]; then
    msg="❌ Redbelly log dosyası okunamıyor: ${LOG_FILE}"
  else
    msg="❌ Redbelly log file cannot be read: ${LOG_FILE}"
  fi
  echo "$msg"
  send_telegram "$msg" >/dev/null 2>&1 || true
  exit 1
fi

SERVICE_STATE=$(systemctl is-active "$REDBELLY_SERVICE" 2>/dev/null || true)
if [[ "$SERVICE_STATE" == "active" ]]; then
  SERVICE_STATUS="✅ Active"
else
  SERVICE_STATUS="❌ ${SERVICE_STATE:-Unknown}"
fi

node_status_from_log
governor_check
LATEST_BLOCK=$(network_block_height)

if [[ -z "$NODE_BLOCK" ]]; then
  if [[ "$LANG_CODE" == "tr" ]]; then
    msg="❌ HATA: Redbelly logundan CurrentBlock okunamadı."
  else
    msg="❌ ERROR: CurrentBlock could not be read from the Redbelly log."
  fi
  echo "$msg"
  send_telegram "$msg" >/dev/null 2>&1 || true
  exit 1
fi

if [[ -z "$LATEST_BLOCK" ]]; then
  NETWORK_STATUS="⚠️ RPC unavailable"
  DIFFERENCE="-"
  [[ "$LANG_CODE" == "tr" ]] && SYNC_STATUS="⚠️ Network RPC okunamadı" || SYNC_STATUS="⚠️ Network RPC unavailable"
else
  if (( NODE_BLOCK >= LATEST_BLOCK )); then
    DIFFERENCE=$((NODE_BLOCK - LATEST_BLOCK))
  else
    DIFFERENCE=$((LATEST_BLOCK - NODE_BLOCK))
  fi

  NETWORK_STATUS="$LATEST_BLOCK"

  if [[ "$SERVICE_STATE" == "active" ]] && (( DIFFERENCE <= SYNC_THRESHOLD )); then
    [[ "$LANG_CODE" == "tr" ]] && SYNC_STATUS="✅ Senkronize" || SYNC_STATUS="✅ Synchronized"
  else
    [[ "$LANG_CODE" == "tr" ]] && SYNC_STATUS="❌ Senkronize Değil" || SYNC_STATUS="❌ Not Synchronized"
  fi
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')
CPU_LOAD=$(awk '{printf "%.2f, %.2f, %.2f", $1, $2, $3}' /proc/loadavg)
RAM_USED=$(free -m | awk '/Mem:/ {print $3}')
RAM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
DISK_USAGE=$(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')
CERT_STATUS=$(cert_check)

if [[ "$LANG_CODE" == "tr" ]]; then
  HTML_MESSAGE="🧾 <b>Redbelly Mainnet Node</b>

📊 <b>Durum:</b> ${SYNC_STATUS}
⚙️ <b>Servis:</b> ${SERVICE_STATUS}
🏛 <b>Rol:</b> ${GOV_STATUS}
🔄 <b>Sonraki Tur:</b> ${GOV_NEXT_STATUS}
📦 <b>Node Bloğu:</b> ${NODE_BLOCK}
🌐 <b>Network Bloğu:</b> ${NETWORK_STATUS}
📉 <b>Fark:</b> ${DIFFERENCE}
🔷 <b>Superblock:</b> ${SUPERBLOCK}
♻️ <b>Recovery:</b> ${RECOVERY_STATUS}
🧩 <b>Version:</b> ${NODE_VERSION}
🔐 <b>Sertifika:</b> ${CERT_STATUS}
🕒 <b>Zaman:</b> ${TIMESTAMP}

💻 <b>Sunucu</b>
🧠 <b>CPU Load:</b> ${CPU_LOAD}
🗂 <b>RAM:</b> ${RAM_USED}MB / ${RAM_TOTAL}MB
💽 <b>Disk:</b> ${DISK_USAGE}"
else
  HTML_MESSAGE="🧾 <b>Redbelly Mainnet Node</b>

📊 <b>Status:</b> ${SYNC_STATUS}
⚙️ <b>Service:</b> ${SERVICE_STATUS}
🏛 <b>Role:</b> ${GOV_STATUS}
🔄 <b>Next Round:</b> ${GOV_NEXT_STATUS}
📦 <b>Node Block:</b> ${NODE_BLOCK}
🌐 <b>Network Block:</b> ${NETWORK_STATUS}
📉 <b>Difference:</b> ${DIFFERENCE}
🔷 <b>Superblock:</b> ${SUPERBLOCK}
♻️ <b>Recovery:</b> ${RECOVERY_STATUS}
🧩 <b>Version:</b> ${NODE_VERSION}
🔐 <b>Certificate:</b> ${CERT_STATUS}
🕒 <b>Time:</b> ${TIMESTAMP}

💻 <b>Server</b>
🧠 <b>CPU Load:</b> ${CPU_LOAD}
🗂 <b>RAM:</b> ${RAM_USED}MB / ${RAM_TOTAL}MB
💽 <b>Disk:</b> ${DISK_USAGE}"
fi

echo "$HTML_MESSAGE"
echo

if send_telegram "$HTML_MESSAGE"; then
  echo
  [[ "$LANG_CODE" == "tr" ]] && echo "✅ Telegram mesajı gönderildi." || echo "✅ Telegram message sent."
else
  echo
  [[ "$LANG_CODE" == "tr" ]] && echo "❌ Telegram mesajı gönderilemedi." || echo "❌ Telegram message could not be sent."
  exit 1
fi
MONITOR_EOF

  chmod 755 "$MONITOR_BIN"
  chown root:root "$MONITOR_BIN"
}

write_systemd_units() {
  local interval="$1"

  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Redbelly Telegram Node Monitor
After=network-online.target redbelly.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=${MONITOR_BIN}
User=root
EOF

  cat > "$TIMER_FILE" <<EOF
[Unit]
Description=Run Redbelly Telegram Monitor every ${interval} minute(s)

[Timer]
OnBootSec=2min
OnUnitActiveSec=${interval}min
AccuracySec=30s
Persistent=true
Unit=${APP_NAME}.service

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${APP_NAME}.timer"
}

test_telegram_credentials() {
  local bot_token="$1"
  local chat_id="$2"
  local test_text

  [[ "$LANG_CODE" == "tr" ]] \
    && test_text="✅ Redbelly Telegram Monitor bağlantı testi başarılı." \
    || test_text="✅ Redbelly Telegram Monitor connection test successful."

  t test_creds

  local response ok
  response=$(curl -sS --max-time 20 \
    -X POST "https://api.telegram.org/bot${bot_token}/sendMessage" \
    --data-urlencode "chat_id=${chat_id}" \
    --data-urlencode "text=${test_text}" \
    --data-urlencode "parse_mode=HTML" || true)

  ok=$(echo "$response" | jq -r '.ok // false' 2>/dev/null || echo false)

  if [[ "$ok" != "true" ]]; then
    t test_fail
    echo "$response" | jq . 2>/dev/null || echo "$response"
    exit 1
  fi

  t test_ok
}

uninstall_app() {
  t uninstalling
  systemctl disable --now "${APP_NAME}.timer" 2>/dev/null || true
  systemctl stop "${APP_NAME}.service" 2>/dev/null || true
  rm -f "$TIMER_FILE" "$SERVICE_FILE" "$MONITOR_BIN" "$CONFIG_FILE"
  systemctl daemon-reload
  systemctl reset-failed 2>/dev/null || true
  t uninstalled
}

show_status() {
  echo
  echo "============================================================"
  t installed
  echo "============================================================"
  echo "Config  : $CONFIG_FILE"
  echo "Monitor : $MONITOR_BIN"
  echo "Service : ${APP_NAME}.service"
  echo "Timer   : ${APP_NAME}.timer"
  echo
  t commands
  echo "  systemctl status ${APP_NAME}.timer"
  echo "  systemctl list-timers ${APP_NAME}.timer"
  echo "  systemctl start ${APP_NAME}.service"
  echo "  journalctl -u ${APP_NAME}.service -n 50 --no-pager"
  echo
}

main() {
  require_root

  # For uninstall, detect saved language if possible.
  if [[ "${1:-}" == "--uninstall" ]]; then
    if [[ -r "$CONFIG_FILE" ]]; then
      # shellcheck disable=SC1090
      source "$CONFIG_FILE"
      LANG_CODE="${LANG_CODE:-tr}"
    else
      choose_language
    fi
    uninstall_app
    exit 0
  fi

  choose_language
  install_dependencies

  echo
  echo "============================================================"
  t title
  echo "============================================================"
  echo

  BOT_TOKEN=$(prompt_required bot_token)
  CHAT_ID=$(prompt_required chat_id)
  DOMAIN=$(prompt_required domain)
  INTERVAL=$(prompt_interval)

  echo
  t settings
  echo "  Domain   : $DOMAIN"
  echo "  Chat ID  : $CHAT_ID"
  if [[ "$LANG_CODE" == "tr" ]]; then
    echo "  Aralık   : ${INTERVAL} dakika"
    echo "  Dil      : Türkçe"
  else
    echo "  Interval : ${INTERVAL} minutes"
    echo "  Language : English"
  fi
  echo "  Token    : [hidden]"
  echo

  t continue
  read -r CONFIRM
  CONFIRM="${CONFIRM:-Y}"
  if [[ ! "$CONFIRM" =~ ^[YyEe]$ ]]; then
    t cancelled
    exit 0
  fi

  test_telegram_credentials "$BOT_TOKEN" "$CHAT_ID"
  write_config "$BOT_TOKEN" "$CHAT_ID" "$DOMAIN" "$INTERVAL"
  write_monitor
  write_systemd_units "$INTERVAL"

  echo
  t first_report
  if systemctl start "${APP_NAME}.service"; then
    t first_ok
  else
    t first_fail
    echo "journalctl -u ${APP_NAME}.service -n 50 --no-pager"
  fi

  show_status
}

main "$@"
