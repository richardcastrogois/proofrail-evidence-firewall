#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-Local}"

if [[ "$MODE" != "Local" && "$MODE" != "Midnight" ]]; then
  echo "Modo invalido: $MODE. Use Local ou Midnight." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y git curl build-essential ca-certificates unzip

export NVM_DIR="$HOME/.nvm"

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi

# shellcheck disable=SC1090
source "$NVM_DIR/nvm.sh"
nvm install 22
nvm alias default 22
nvm use 22

if [[ "$MODE" == "Midnight" ]]; then
  if [ -s "$HOME/.local/bin/env" ]; then
    # compact-installer 0.5.1 installs the launcher in ~/.local/bin.
    # shellcheck disable=SC1091
    source "$HOME/.local/bin/env"
  fi

  if ! command -v compact >/dev/null 2>&1; then
    curl --proto '=https' --tlsv1.2 -LsSf \
      https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.1/compact-installer.sh | sh
  fi

  export PATH="$HOME/.local/bin:$PATH"
  compact update 0.31.1
fi

echo
echo "Node: $(node --version)"
echo "npm: $(npm --version)"
if [[ "$MODE" == "Midnight" ]]; then
  echo "Compact: $(compact --version)"
  echo "Compiler: $(compact compile --version)"
fi
