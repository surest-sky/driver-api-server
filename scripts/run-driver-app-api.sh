#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVICE_NAME="driver-app-api"
SERVICE_TEMPLATE="$PROJECT_ROOT/scripts/${SERVICE_NAME}.service"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
LOG_LINES=${LOG_LINES:-50}

usage() {
  cat <<USAGE
用法: $0 [命令]

命令:
  install [user] [group]  安装/更新 systemd 服务，可选指定运行用户/用户组
  restart                 重启服务并输出状态
  status                  查看服务状态与最近日志
  stop                    停止服务
  disable                 停止并禁用服务
  remove                  停止并移除服务文件
  help                    显示此帮助

默认(无参数)行为等同于: install 然后 restart
USAGE
}

require_root() {
  if [[ "$EUID" -ne 0 ]]; then
    echo "[ERROR] 此操作必须以 root 权限运行" >&2
    exit 1
  fi
}

render_service_file() {
  local service_user="$1" service_group="$2"

  if [[ ! -f "$SERVICE_TEMPLATE" ]]; then
    echo "[ERROR] 未找到服务模板: $SERVICE_TEMPLATE" >&2
    exit 1
  fi

  local tmpfile
  tmpfile="$(mktemp)"
  trap 'rm -f "$tmpfile"' RETURN

  sed \
    -e "s|{{PROJECT_ROOT}}|$PROJECT_ROOT|g" \
    -e "s|{{SERVICE_USER}}|$service_user|g" \
    -e "s|{{SERVICE_GROUP}}|$service_group|g" \
    "$SERVICE_TEMPLATE" >"$tmpfile"

  install -m 0644 "$tmpfile" "$SERVICE_PATH"
}

install_service() {
  require_root
  local service_user="${1:-${SERVICE_USER:-root}}"
  local service_group="${2:-${SERVICE_GROUP:-$service_user}}"

  echo "[INFO] 安装/更新 $SERVICE_NAME.service (user=$service_user group=$service_group)"
  render_service_file "$service_user" "$service_group"

  echo "[INFO] 重新加载 systemd 配置"
  systemctl daemon-reload

  echo "[INFO] 启用自启动"
  systemctl enable "$SERVICE_NAME.service"
}

restart_service() {
  require_root
  echo "[INFO] 重启 $SERVICE_NAME.service"
  systemctl restart "$SERVICE_NAME.service"
  status_service
}

status_service() {
  require_root
  echo "[INFO] 当前服务状态"
  systemctl status "$SERVICE_NAME.service" --no-pager
  echo "[INFO] 最近 $LOG_LINES 条日志"
  journalctl -u "$SERVICE_NAME.service" -n "$LOG_LINES" --no-pager || true
}

stop_service() {
  require_root
  echo "[INFO] 停止 $SERVICE_NAME.service"
  systemctl stop "$SERVICE_NAME.service"
  status_service
}

disable_service() {
  require_root
  echo "[INFO] 停用 $SERVICE_NAME.service"
  systemctl disable "$SERVICE_NAME.service"
  stop_service
}

remove_service() {
  require_root
  echo "[INFO] 移除 $SERVICE_NAME.service"
  stop_service || true
  disable_service || true
  if [[ -f "$SERVICE_PATH" ]]; then
    rm -f "$SERVICE_PATH"
    systemctl daemon-reload
  fi
  echo "[INFO] 服务文件已移除"
}

main() {
  local cmd="${1:-default}"; shift || true
  case "$cmd" in
    install)
      install_service "$@"
      ;;
    restart)
      restart_service
      ;;
    status)
      status_service
      ;;
    stop)
      stop_service
      ;;
    disable)
      disable_service
      ;;
    remove)
      remove_service
      ;;
    help|-h|--help)
      usage
      ;;
    default)
      install_service "$@"
      restart_service
      ;;
    *)
      echo "[ERROR] 未知命令: $cmd" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
