/**
 * Read-only end-to-end smoke check for midnight-chain.
 *
 * Validates that the deployed contract exists in the public indexer. This avoids
 * wallet synchronization for the post-deploy check, so it does not submit
 * transactions, consume DUST, or depend on the most fragile Preview wallet path.
 */
import { WebSocket } from 'ws';

import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { resolveNetwork, getDeployment } from '../src/network';

// @ts-expect-error indexer subscriptions require WebSocket in Node.
globalThis.WebSocket = WebSocket;

const { network, config: networkConfig } = resolveNetwork();

function fail(msg: string): never {
  console.error(`e2e-check failed: ${msg}`);
  process.exit(1);
}

function isHexAddress(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s) && s.length >= 32;
}

async function main() {
  const deployment = getDeployment(network);
  if (!deployment) {
    fail(`No deploy on file for network ${network}.`);
  }
  if (!isHexAddress(deployment.address)) {
    fail(`Deployment address missing or invalid: ${JSON.stringify(deployment, null, 2)}`);
  }

  const publicDataProvider = indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS);
  const attempts = 8;
  const attemptTimeoutMs = 15_000;
  let onChainState: Awaited<ReturnType<typeof publicDataProvider.queryContractState>> = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    process.stdout.write(`e2e-check: querying indexer (${attempt}/${attempts})...\n`);
    try {
      onChainState = await Promise.race([
        publicDataProvider.queryContractState(deployment.address),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`indexer query timed out after ${attemptTimeoutMs}ms`)),
            attemptTimeoutMs,
          ),
        ),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`e2e-check: attempt ${attempt} failed: ${message}\n`);
    }
    if (onChainState) break;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  if (!onChainState) {
    fail(`queryContractState returned null for ${deployment.address}`);
  }

  console.log('e2e-check passed');
  console.log(`  contractAddress: ${deployment.address}`);
  console.log(`  network:         ${network}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
