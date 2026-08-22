#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-local}"
CHAIN_DIR="${2:-}"

export MIDNIGHT_MODE="$MODE"
if [[ -n "$CHAIN_DIR" ]]; then
  export MIDNIGHT_CHAIN_DIR="$CHAIN_DIR"
fi

cleanup() {
  local status=$?
  if [[ -n "${API_PID:-}" ]]; then kill -TERM -- "-$API_PID" 2>/dev/null || true; fi
  if [[ -n "${WEB_PID:-}" ]]; then kill -TERM -- "-$WEB_PID" 2>/dev/null || true; fi
  wait 2>/dev/null || true
  exit "$status"
}
trap cleanup EXIT INT TERM

if [[ "$MODE" == "cli" ]]; then
  npm run store:migrate --workspace @rational/api
fi

if [[ "${PROOFRAIL_LOG_FORMAT:-pretty}" == "json" ]]; then
  setsid bash -lc 'npm run dev:api 2>&1 | sed -u "s/^/[API] /"' &
else
  setsid bash -lc 'npm run dev:api 2>&1 | node scripts/format-api-log.mjs' &
fi
API_PID=$!

API_READY=0
for _ in $(seq 1 120); do
  if node -e "fetch('http://127.0.0.1:3333/api/health').then((r)=>process.exit(r.ok ? 0 : 1)).catch(()=>process.exit(1))"; then
    API_READY=1
    break
  fi
  sleep 1
done

if [[ "$API_READY" != "1" ]]; then
  echo "[API] API did not become healthy at http://127.0.0.1:3333/api/health" >&2
  exit 1
fi

echo "[API] API health check passed; starting web server"
setsid bash -lc 'npm run dev:web 2>&1 | sed -u "s/^/[WEB] /"' &
WEB_PID=$!

wait -n "$API_PID" "$WEB_PID"
