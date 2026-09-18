#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dev}"
DEV_PORT=3000

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$SERVER_DIR"

if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
else
  echo "Error: NVM is not available. Install nvm, then run 'nvm install 22' for backend development." >&2
  exit 1
fi

if ! nvm use 22 >/dev/null; then
  echo "Error: Node 22 is not installed. Run: nvm install 22" >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" != "22" ]]; then
  echo "Error: backend requires Node 22, but active version is Node ${NODE_MAJOR}." >&2
  exit 1
fi

if [[ -d node_modules/better-sqlite3 ]]; then
  if ! node -e "require('better-sqlite3')" >/dev/null 2>&1; then
    echo "Rebuilding better-sqlite3 for Node 22..."
    npm rebuild better-sqlite3
  fi
fi

get_process_command() {
  local pid="$1"
  ps -p "$pid" -o args= 2>/dev/null | sed 's/^[[:space:]]*//'
}

get_port_listener_pids() {
  local port="$1"
  local -a pids=()

  if command -v ss >/dev/null 2>&1; then
    while IFS= read -r pid; do
      [[ -n "$pid" ]] && pids+=("$pid")
    done < <(ss -ltnpH "sport = :${port}" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
  fi

  if [[ ${#pids[@]} -eq 0 ]] && command -v lsof >/dev/null 2>&1; then
    while IFS= read -r pid; do
      [[ -n "$pid" ]] && pids+=("$pid")
    done < <(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null | sort -u)
  fi

  if [[ ${#pids[@]} -eq 0 ]] && command -v fuser >/dev/null 2>&1; then
    while IFS= read -r pid; do
      [[ -n "$pid" ]] && pids+=("$pid")
    done < <(fuser "${port}/tcp" 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u)
  fi

  if [[ ${#pids[@]} -eq 0 ]]; then
    return 0
  fi

  printf '%s\n' "${pids[@]}" | sort -u
}

is_wardrobe_server_process() {
  local pid="$1"
  local cmd cwd

  cmd="$(get_process_command "$pid")"
  if [[ -z "$cmd" ]]; then
    return 1
  fi

  if [[ "$cmd" != *"src/index.ts"* ]]; then
    return 1
  fi

  if [[ "$cmd" != *"tsx"* && "$cmd" != *"node"* ]]; then
    return 1
  fi

  if [[ "$cmd" == *"${SERVER_DIR}/src/index.ts"* || "$cmd" == *"${SERVER_DIR}"* ]]; then
    return 0
  fi

  cwd="$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)"
  if [[ "$cwd" == "$SERVER_DIR" ]]; then
    return 0
  fi

  return 1
}

is_wardrobe_dev_supervisor_process() {
  local pid="$1"
  local cmd="$2"
  local cwd

  if [[ "$cmd" == *"tsx"* && "$cmd" == *"watch"* && "$cmd" == *"src/index.ts"* ]]; then
    return 0
  fi

  if [[ "$cmd" == *"npx"* && "$cmd" == *"tsx"* && "$cmd" == *"watch"* ]]; then
    return 0
  fi

  if [[ "$cmd" == *"npm run dev"* ]]; then
    cwd="$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)"
    if [[ "$cwd" == "$SERVER_DIR" ]]; then
      return 0
    fi
  fi

  if [[ "$cmd" == sh\ -c\ tsx\ watch\ src/index.ts* ]]; then
    return 0
  fi

  return 1
}

find_stale_dev_root_pid() {
  local listener_pid="$1"
  local current="$listener_pid"
  local root_pid="$listener_pid"

  while [[ -n "$current" && "$current" -gt 1 ]]; do
    local cmd
    cmd="$(get_process_command "$current")"

    if is_wardrobe_dev_supervisor_process "$current" "$cmd"; then
      root_pid="$current"
    fi

    current="$(ps -o ppid= -p "$current" 2>/dev/null | tr -d ' ')"
  done

  echo "$root_pid"
}

collect_process_tree_pids() {
  local root_pid="$1"
  local -a pids=("$root_pid")
  local -a queue=("$root_pid")

  while [[ ${#queue[@]} -gt 0 ]]; do
    local parent="${queue[0]}"
    queue=("${queue[@]:1}")

    while IFS= read -r child_pid; do
      if [[ -n "$child_pid" ]]; then
        pids+=("$child_pid")
        queue+=("$child_pid")
      fi
    done < <(pgrep -P "$parent" 2>/dev/null || true)
  done

  printf '%s\n' "${pids[@]}" | sort -u
}

terminate_process_tree() {
  local root_pid="$1"
  local cmd="$2"
  local -a tree_pids=()

  while IFS= read -r tree_pid; do
    [[ -n "$tree_pid" ]] && tree_pids+=("$tree_pid")
  done < <(collect_process_tree_pids "$root_pid")

  echo "Port ${DEV_PORT} is in use by stale wardrobe-ai dev server (PID ${root_pid}): ${cmd}"
  echo "Stopping stale dev server process tree (${#tree_pids[@]} process(es)) with SIGTERM..."

  for tree_pid in "${tree_pids[@]}"; do
    kill -TERM "$tree_pid" 2>/dev/null || true
  done

  local waited=0
  while [[ "$waited" -lt 20 ]]; do
    local any_alive=0
    for tree_pid in "${tree_pids[@]}"; do
      if kill -0 "$tree_pid" 2>/dev/null; then
        any_alive=1
        break
      fi
    done

    if [[ "$any_alive" -eq 0 ]]; then
      break
    fi

    sleep 0.25
    waited=$((waited + 1))
  done

  for tree_pid in "${tree_pids[@]}"; do
    if kill -0 "$tree_pid" 2>/dev/null; then
      echo "Process still running; sending SIGKILL to PID ${tree_pid}..."
      kill -KILL "$tree_pid" 2>/dev/null || true
    fi
  done

  sleep 0.5

  for tree_pid in "${tree_pids[@]}"; do
    if kill -0 "$tree_pid" 2>/dev/null; then
      echo "Error: could not stop wardrobe-ai dev server on port ${DEV_PORT} (PID ${tree_pid})." >&2
      exit 1
    fi
  done
}

ensure_dev_port_available() {
  local -a listener_pids=()
  local pid cmd root_pid

  while IFS= read -r pid; do
    [[ -n "$pid" ]] && listener_pids+=("$pid")
  done < <(get_port_listener_pids "$DEV_PORT")

  if [[ ${#listener_pids[@]} -eq 0 ]]; then
    return 0
  fi

  for pid in "${listener_pids[@]}"; do
    if ! is_wardrobe_server_process "$pid"; then
      cmd="$(get_process_command "$pid")"
      if [[ -z "$cmd" ]]; then
        cmd="unknown command"
      fi
      echo "Port ${DEV_PORT} is already used by another process: PID ${pid} (${cmd})" >&2
      exit 1
    fi
  done

  for pid in "${listener_pids[@]}"; do
    root_pid="$(find_stale_dev_root_pid "$pid")"
    cmd="$(get_process_command "$root_pid")"
    if [[ -z "$cmd" ]]; then
      cmd="unknown command"
    fi
    terminate_process_tree "$root_pid" "$cmd"
  done

  local -a remaining_pids=()
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && remaining_pids+=("$pid")
  done < <(get_port_listener_pids "$DEV_PORT")

  if [[ ${#remaining_pids[@]} -gt 0 ]]; then
    pid="${remaining_pids[0]}"
    cmd="$(get_process_command "$pid")"
    echo "Port ${DEV_PORT} is still in use after cleanup: PID ${pid} (${cmd})" >&2
    exit 1
  fi
}

case "$MODE" in
  dev)
    ensure_dev_port_available
    exec npx tsx watch src/index.ts
    ;;
  start)
    exec npx tsx src/index.ts
    ;;
  *)
    echo "Error: unknown mode '$MODE'. Expected 'dev' or 'start'." >&2
    exit 1
    ;;
esac
