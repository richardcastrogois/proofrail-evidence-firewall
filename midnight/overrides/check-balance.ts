/**
 * Check wallet balance on the selected Midnight network.
 */
import { WebSocket } from 'ws';

import { resolveNetwork, getOrCreateSeed } from './network';
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from './wallet';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

const { network, config: networkConfig } = resolveNetwork();
const SEED = getOrCreateSeed(network);

const MAX_SYNC_ATTEMPTS = Number(process.env.MIDNIGHT_BALANCE_SYNC_ATTEMPTS ?? '3');
const SYNC_TIMEOUT_MS = Number(process.env.MIDNIGHT_BALANCE_SYNC_TIMEOUT_MS ?? '120000');

async function stopWallet(ctx: WalletContext | undefined): Promise<void> {
  if (!ctx) return;
  try {
    await ctx.wallet.stop();
  } catch {
    // Best-effort cleanup after transient Preview disconnects.
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Wallet sync timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function syncWalletWithRetry(): Promise<{
  ctx: WalletContext;
  state: Awaited<ReturnType<WalletContext['wallet']['waitForSyncedState']>>;
}> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt++) {
    let ctx: WalletContext | undefined;
    try {
      console.log(`  Building wallet (attempt ${attempt}/${MAX_SYNC_ATTEMPTS})...`);
      ctx = await createWallet({ network, networkConfig, seed: SEED });
      const restoredCount = Object.values(ctx.restored).filter(Boolean).length;
      if (restoredCount > 0) {
        console.log(`  Restored ${restoredCount}/3 child wallets from .midnight-wallet-state; sync will resume from saved point.`);
      }

      console.log('  Syncing with network...');
      console.log('  This may take several minutes depending on network size.');
      console.log('  RPC disconnection messages during sync are normal; this command retries short failures.\n');
      const syncStart = Date.now();
      const syncInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - syncStart) / 1000);
        process.stdout.write(`\r  Still syncing... (${elapsed}s elapsed)   `);
      }, 5000);
      try {
        const state = await withTimeout(ctx.wallet.waitForSyncedState(), SYNC_TIMEOUT_MS);
        clearInterval(syncInterval);
        process.stdout.write('\r  Synced with network.                                      \n');
        return { ctx, state };
      } catch (err) {
        clearInterval(syncInterval);
        throw err;
      }
    } catch (err) {
      lastError = err;
      await stopWallet(ctx);
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`\n  Sync attempt ${attempt} failed: ${msg}`);
      if (attempt < MAX_SYNC_ATTEMPTS) {
        const delayMs = Math.min(10_000 * attempt, 30_000);
        console.log(`  Retrying balance sync in ${Math.round(delayMs / 1000)}s...\n`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function main() {
  console.log('\nWallet Balance Checker\n');

  let walletCtx: WalletContext | undefined;
  try {
    const synced = await syncWalletWithRetry();
    walletCtx = synced.ctx;
    const state = synced.state;

    const address = walletCtx.unshieldedKeystore.getBech32Address();
    const tNightBalance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
    const dustBalance = state.dust.balance(new Date());

    console.log('\nWallet Details\n');
    console.log(`  Address: ${address}`);
    console.log(`  Network: ${networkConfig.networkId}\n`);

    console.log('Balances\n');
    console.log(`  tNight: ${tNightBalance.toLocaleString()}`);
    console.log(`  DUST:   ${dustBalance.toLocaleString()}\n`);

    if (tNightBalance === 0n) {
      if (network === 'undeployed') {
        console.log('  Wallet has no tNight. Make sure the local devnet is running.');
      } else if (networkConfig.faucet) {
        console.log('  Wallet has no tNight. Fund it from the faucet:');
        console.log(`  ${networkConfig.faucet}`);
        console.log(`  Wallet address: ${address}`);
      } else {
        console.log('  Wallet has no tNight.');
      }
    } else {
      console.log('  Wallet is funded.');
    }

    await persistWalletState(network, walletCtx);
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await stopWallet(walletCtx);
  }
}

main();
