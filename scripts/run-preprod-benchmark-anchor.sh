#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${PROOFRAIL_BENCHMARK_ALLOW_PREPROD:-}" != "1" ]]; then
  echo "Refusing to submit: set PROOFRAIL_BENCHMARK_ALLOW_PREPROD=1 explicitly." >&2
  exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
CHAIN_ROOT="$PROJECT_ROOT/midnight-chain"

[[ -s "$HOME/.nvm/nvm.sh" ]] && source "$HOME/.nvm/nvm.sh"
command -v node >/dev/null || { echo "Node.js is required." >&2; exit 1; }
[[ -f "$CHAIN_ROOT/.midnight-state.json" ]] || { echo "Midnight state is missing." >&2; exit 1; }
[[ -f "$CHAIN_ROOT/contracts/managed/hello-world/contract/index.js" ]] || {
  echo "Compiled contract assets are missing." >&2
  exit 1
}

random_hex() {
  node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
}

evidence_root="$(random_hex)"
policy_commitment="$(random_hex)"
action_commitment="$(random_hex)"
valid_until="$(( $(date +%s) + 1800 ))"

cd "$CHAIN_ROOT"
exec npm run cli -- \
  anchor \
  "$evidence_root" \
  "$policy_commitment" \
  1 \
  "$action_commitment" \
  ALLOW \
  "$valid_until" \
  2 \
  2 \
  0 \
  --network preprod
