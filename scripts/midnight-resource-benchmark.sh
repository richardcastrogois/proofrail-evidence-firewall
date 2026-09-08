#!/usr/bin/env bash
set -Eeuo pipefail

# Node is installed through NVM in the supported WSL setup.
[[ -s "$HOME/.nvm/nvm.sh" ]] && source "$HOME/.nvm/nvm.sh"

SCENARIO="inventory"
PROFILE="unrestricted"
DURATION_SECONDS=60
TIMEOUT_SECONDS=1200
WITH_PROOF_SERVER=0
OUTPUT_ROOT=".tmp/midnight-benchmark"
PROOF_IMAGE="midnightntwrk/proof-server:8.1.0"
CONTAINER_NAME="proofrail-benchmark-proof-server"
PROOF_PORT=16300
COMMAND=()

usage() {
  cat <<'EOF'
Usage: scripts/midnight-resource-benchmark.sh [options] [-- command ...]

Options:
  --scenario inventory|proof-idle|command
  --profile unrestricted|micro|small|medium|a1
  --duration-seconds N
  --timeout-seconds N
  --with-proof-server
  --output-root PATH
EOF
}

while (($#)); do
  case "$1" in
    --scenario) SCENARIO="${2:?missing scenario}"; shift 2 ;;
    --profile) PROFILE="${2:?missing profile}"; shift 2 ;;
    --duration-seconds) DURATION_SECONDS="${2:?missing duration}"; shift 2 ;;
    --timeout-seconds) TIMEOUT_SECONDS="${2:?missing timeout}"; shift 2 ;;
    --with-proof-server) WITH_PROOF_SERVER=1; shift ;;
    --output-root) OUTPUT_ROOT="${2:?missing output root}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    --) shift; COMMAND=("$@"); break ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$SCENARIO" in inventory|proof-idle|command) ;; *) echo "Invalid scenario: $SCENARIO" >&2; exit 2 ;; esac
case "$PROFILE" in unrestricted|micro|small|medium|a1) ;; *) echo "Invalid profile: $PROFILE" >&2; exit 2 ;; esac
[[ "$DURATION_SECONDS" =~ ^[1-9][0-9]*$ ]] || { echo "Duration must be a positive integer" >&2; exit 2; }
[[ "$TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]] || { echo "Timeout must be a positive integer" >&2; exit 2; }
if [[ "$SCENARIO" == "command" && ${#COMMAND[@]} -eq 0 ]]; then
  echo "The command scenario requires arguments after --" >&2
  exit 2
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$OUTPUT_ROOT/${timestamp}-${SCENARIO}-${PROFILE}"
mkdir -p "$RUN_DIR"
METRICS="$RUN_DIR/metrics.tsv"
SUMMARY="$RUN_DIR/summary.txt"
CONTAINER_STARTED=0
SAMPLER_PID=""
MEMORY_LIMIT=""
CPU_LIMIT=""
FINAL_EXIT=0

cleanup() {
  if [[ -n "$SAMPLER_PID" ]]; then
    kill "$SAMPLER_PID" 2>/dev/null || true
    wait "$SAMPLER_PID" 2>/dev/null || true
  fi
  if ((CONTAINER_STARTED)); then
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

stop_sampler() {
  if [[ -n "$SAMPLER_PID" ]]; then
    kill "$SAMPLER_PID" 2>/dev/null || true
    wait "$SAMPLER_PID" 2>/dev/null || true
    SAMPLER_PID=""
  fi
}

bytes_of_path() {
  local target="$1"
  if [[ -e "$target" ]]; then
    local result
    if result="$(timeout 5s du -sb -- "$target" 2>/dev/null)"; then
      awk '{print $1}' <<<"$result"
    else
      printf 'unavailable\n'
    fi
  else
    printf '0\n'
  fi
}

write_inventory() {
  {
    echo "timestamp_utc=$timestamp"
    echo "scenario=$SCENARIO"
    echo "profile=$PROFILE"
    echo "kernel=$(uname -srmo)"
    echo "node=$(node --version 2>/dev/null || echo unavailable)"
    echo "npm=$(npm --version 2>/dev/null || echo unavailable)"
    echo "docker=$(docker --version 2>/dev/null || echo unavailable)"
    echo "compose=$(docker compose version 2>/dev/null || echo unavailable)"
    echo "host_memory_bytes=$(awk '/MemTotal:/ {print $2 * 1024}' /proc/meminfo)"
    echo "root_free_bytes=$(df -B1 / | awk 'NR==2 {print $4}')"
    echo "root_node_modules_bytes=$(bytes_of_path node_modules)"
    echo "apps_bytes=$(bytes_of_path apps)"
    echo "packages_bytes=$(bytes_of_path packages)"
    echo "midnight_chain_node_modules_bytes=$(bytes_of_path midnight-chain/node_modules)"
    echo "midnight_chain_source_bytes=$(bytes_of_path midnight-chain/src)"
    echo "midnight_chain_contract_bytes=$(bytes_of_path midnight-chain/contracts)"
    echo "wallet_state_bytes=$(bytes_of_path midnight-chain/.midnight-wallet-state)"
    echo "midnight_state_bytes=$(bytes_of_path midnight-chain/.midnight-state.json)"
    echo "proof_image_bytes=$(docker image inspect "$PROOF_IMAGE" --format '{{.Size}}' 2>/dev/null || echo not-local)"
  } >"$RUN_DIR/inventory.txt"
}

profile_limits() {
  MEMORY_LIMIT=""
  CPU_LIMIT=""
  case "$PROFILE" in
    micro) MEMORY_LIMIT="512m"; CPU_LIMIT="0.125" ;;
    small) MEMORY_LIMIT="1g"; CPU_LIMIT="0.5" ;;
    medium) MEMORY_LIMIT="2g"; CPU_LIMIT="1.0" ;;
    a1) MEMORY_LIMIT="4g"; CPU_LIMIT="1.0" ;;
    unrestricted) ;;
  esac
}

start_proof_server() {
  command -v docker >/dev/null || { echo "Docker is required" >&2; exit 1; }
  docker info >/dev/null
  if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    echo "Container $CONTAINER_NAME already exists; refusing to replace it" >&2
    exit 1
  fi
  profile_limits
  local args=(run -d --rm --name "$CONTAINER_NAME" --pids-limit 256 --log-opt max-size=10m --log-opt max-file=2)
  [[ -n "$MEMORY_LIMIT" ]] && args+=(--memory "$MEMORY_LIMIT")
  [[ -n "$CPU_LIMIT" ]] && args+=(--cpus "$CPU_LIMIT")
  args+=(-p "127.0.0.1:${PROOF_PORT}:6300" -e RUST_BACKTRACE=1 -e RUST_LOG=warn "$PROOF_IMAGE" midnight-proof-server)
  docker "${args[@]}" >/dev/null
  CONTAINER_STARTED=1

  for _ in $(seq 1 60); do
    if curl --silent --show-error --max-time 2 "http://127.0.0.1:${PROOF_PORT}" >/dev/null 2>&1; then
      return 0
    fi
    if ! docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
      echo "Proof server exited before becoming ready" >&2
      return 1
    fi
    sleep 1
  done
  echo "Proof server did not respond within 60 seconds" >&2
  return 1
}

record_proof_server_state() {
  ((CONTAINER_STARTED)) || return 0
  {
    echo "proof_memory_limit=$MEMORY_LIMIT"
    echo "proof_cpu_limit=$CPU_LIMIT"
    echo "proof_oom_killed=$(docker inspect --format '{{.State.OOMKilled}}' "$CONTAINER_NAME" 2>/dev/null || echo unavailable)"
    echo "proof_running=$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || echo unavailable)"
    echo "proof_exit_code=$(docker inspect --format '{{.State.ExitCode}}' "$CONTAINER_NAME" 2>/dev/null || echo unavailable)"
  } >>"$SUMMARY"
}

sample_metrics() {
  local process_group="${1:-}"
  printf 'timestamp_utc\thost_available_bytes\tprocess_rss_bytes\tprocess_cpu_percent\tcontainer_memory\tcontainer_cpu\tcontainer_block_io\tcontainer_net_io\tcontainer_pids\n' >"$METRICS"
  while true; do
    local now host_available process_rss=0 process_cpu=0 container_stats=$'\t\t\t\t'
    now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    host_available="$(awk '/MemAvailable:/ {print $2 * 1024}' /proc/meminfo)"
    if [[ -n "$process_group" ]]; then
      read -r process_rss process_cpu < <(
        ps -o rss=,%cpu= -g "$process_group" 2>/dev/null |
          awk '{rss += $1; cpu += $2} END {printf "%.0f %.2f\n", rss * 1024, cpu}'
      ) || true
    fi
    if ((CONTAINER_STARTED)); then
      container_stats="$(docker stats --no-stream --format '{{.MemUsage}}\t{{.CPUPerc}}\t{{.BlockIO}}\t{{.NetIO}}\t{{.PIDs}}' "$CONTAINER_NAME" 2>/dev/null || printf '\t\t\t\t')"
    fi
    printf '%s\t%s\t%s\t%s\t%s\n' "$now" "$host_available" "$process_rss" "$process_cpu" "$container_stats" >>"$METRICS"
    sleep 1
  done
}

write_inventory

case "$SCENARIO" in
  inventory)
    cp "$RUN_DIR/inventory.txt" "$SUMMARY"
    ;;
  proof-idle)
    start_proof_server
    sample_metrics "" & SAMPLER_PID=$!
    sleep "$DURATION_SECONDS"
    stop_sampler
    ;;
  command)
    if ((WITH_PROOF_SERVER)); then
      start_proof_server
      export MIDNIGHT_PROOF_SERVER_URL="http://127.0.0.1:${PROOF_PORT}"
    fi
    start_epoch="$(date +%s)"
    set +e
    setsid timeout --signal=TERM --kill-after=30s "$TIMEOUT_SECONDS" \
      "${COMMAND[@]}" >"$RUN_DIR/command.stdout.log" 2>"$RUN_DIR/command.stderr.log" &
    command_pid=$!
    set -e
    sample_metrics "$command_pid" & SAMPLER_PID=$!
    set +e
    wait "$command_pid"
    command_exit=$?
    set -e
    stop_sampler
    end_epoch="$(date +%s)"
    {
      echo "command_exit_code=$command_exit"
      echo "duration_seconds=$((end_epoch - start_epoch))"
      echo "timeout_seconds=$TIMEOUT_SECONDS"
      echo "timed_out=$([[ $command_exit -eq 124 || $command_exit -eq 137 ]] && echo true || echo false)"
    } >"$SUMMARY"
    record_proof_server_state
    FINAL_EXIT=$command_exit
    ;;
esac

if [[ "$SCENARIO" != "command" ]]; then
  {
    echo "scenario=$SCENARIO"
    echo "profile=$PROFILE"
    echo "duration_seconds=$([[ "$SCENARIO" == "inventory" ]] && echo 0 || echo "$DURATION_SECONDS")"
  } >>"$SUMMARY"
fi

node scripts/summarize-midnight-benchmark.mjs "$RUN_DIR"

echo "Benchmark complete: $RUN_DIR"
exit "$FINAL_EXIT"
