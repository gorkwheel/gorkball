/**
 * Gorkwheel Keeper Bot
 *
 * Submits one update_index transaction per minute.
 * Uses the Gork/xAI API (or a deterministic fallback) to decide the
 * distribution amount, then enforces all guardrails before sending.
 *
 * Security guarantees:
 *  - The AI API has no access to the keeper private key.
 *  - AI output is validated and capped before any transaction is built.
 *  - On-chain program provides a second layer of cap/interval enforcement.
 *  - DRY_RUN=true mode logs actions without signing or submitting.
 */

import "dotenv/config";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { logger } from "./logger";
import { GorkwheelClient } from "./client";
import { getGorkRecommendation, MarketContext } from "./gorkAdapter";
import { startHealthServer, recordSuccess, recordFailure } from "./health";

// ── Config ──────────────────────────────────────────────────────────────────

const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY ?? "";
const PROGRAM_ID = process.env.PROGRAM_ID ?? "GrkW1111111111111111111111111111111111111111";
const GORK_MINT = process.env.GORK_MINT ?? "";
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT ?? "3001", 10);
const DRY_RUN = process.env.DRY_RUN === "true";
const DEFAULT_DISTRIBUTE_AMOUNT = parseInt(
  process.env.DEFAULT_DISTRIBUTE_AMOUNT ?? "1000000",
  10
);
const INTERVAL_MS = 60_000; // 1 minute
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;

// ── Bootstrap ────────────────────────────────────────────────────────────────

function loadKeypair(): Keypair {
  if (!KEEPER_PRIVATE_KEY) {
    throw new Error("KEEPER_PRIVATE_KEY is not set in environment");
  }
  try {
    const bytes = bs58.decode(KEEPER_PRIVATE_KEY);
    return Keypair.fromSecretKey(bytes);
  } catch {
    // Try JSON array format
    const arr = JSON.parse(KEEPER_PRIVATE_KEY) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Core tick ────────────────────────────────────────────────────────────────

async function tick(client: GorkwheelClient, gorkMint: PublicKey): Promise<void> {
  logger.info("─── Keeper tick starting ───");

  // 1. Fetch on-chain state.
  const gs = await client.fetchGlobalState();

  if (gs.paused) {
    logger.warn("Program is paused — skipping this tick");
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const secondsSinceLast = now - gs.lastUpdateTs;

  if (secondsSinceLast < 60) {
    logger.info(
      `Only ${secondsSinceLast}s since last update — too early, skipping`
    );
    return;
  }

  // 2. Fetch vault balance.
  const vaultBalance = await client.getVaultBalance(gs.rewardVault);

  // 3. Build context for AI advisor.
  const ctx: MarketContext = {
    currentGlobalIndex: gs.globalRewardIndex.toString(),
    vaultBalance,
    dailyDistributed: gs.dailyDistributed,
    maxPerMinute: gs.maxPerMinute,
    maxPerDay: gs.maxPerDay,
    lastUpdateTs: gs.lastUpdateTs,
  };

  // 4. Ask Gork AI for a recommendation.
  const recommendation = await getGorkRecommendation(ctx, DEFAULT_DISTRIBUTE_AMOUNT);

  if (recommendation.action !== "DISTRIBUTE") {
    logger.info(
      `Gork recommends ${recommendation.action}: "${recommendation.reason}" — skipping`
    );
    if (recommendation.action === "PAUSE") {
      logger.warn("AI recommended PAUSE but keeper cannot autonomously pause; human review needed");
    }
    return;
  }

  // 5. Enforce guardrails on AI output (never trust AI blindly).
  let amount = recommendation.usdc_amount;

  if (!Number.isFinite(amount) || amount <= 0) {
    logger.warn(`Invalid AI amount ${amount} — skipping`);
    return;
  }

  // Cap to on-chain limits (on-chain will also enforce, but belt-and-suspenders).
  amount = Math.min(amount, gs.maxPerMinute);

  const remainingDaily = gs.maxPerDay - gs.dailyDistributed;
  amount = Math.min(amount, remainingDaily);

  if (amount <= 0) {
    logger.info("After cap enforcement, amount is 0 — skipping");
    return;
  }

  // Cap to vault balance.
  if (vaultBalance < amount) {
    logger.warn(
      `Vault balance (${vaultBalance}) < requested amount (${amount}) — skipping`
    );
    return;
  }

  logger.info(
    `Submitting update_index: amount=${amount} (confidence=${recommendation.confidence.toFixed(2)})`
  );

  // 6. Submit with retry.
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const sig = await client.updateIndex(amount, gorkMint, DRY_RUN);
      if (sig) {
        logger.info(`✓ update_index confirmed: ${sig}`);
      }
      recordSuccess(now);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Attempt ${attempt}/${MAX_RETRIES} failed: ${msg}`);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  recordFailure();
  logger.error("All retry attempts exhausted for this tick");
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  logger.info("Gorkwheel Keeper starting up");
  logger.info(`  RPC:        ${RPC_URL}`);
  logger.info(`  Program:    ${PROGRAM_ID}`);
  logger.info(`  Dry run:    ${DRY_RUN}`);

  if (!GORK_MINT) {
    throw new Error("GORK_MINT is not set in environment");
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const keeperKeypair = loadKeypair();
  const programId = new PublicKey(PROGRAM_ID);
  const gorkMint = new PublicKey(GORK_MINT);

  logger.info(`  Keeper:     ${keeperKeypair.publicKey.toBase58()}`);

  const client = new GorkwheelClient(connection, keeperKeypair, programId);

  // Start health check HTTP server.
  startHealthServer(HEALTH_PORT);

  // Run first tick immediately.
  try {
    await tick(client, gorkMint);
  } catch (err) {
    logger.error(`Initial tick error: ${err instanceof Error ? err.message : err}`);
    recordFailure();
  }

  // Schedule recurring ticks.
  const interval = setInterval(async () => {
    try {
      await tick(client, gorkMint);
    } catch (err) {
      logger.error(`Tick error: ${err instanceof Error ? err.message : err}`);
      recordFailure();
    }
  }, INTERVAL_MS);

  // Graceful shutdown.
  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal} — shutting down gracefully`);
    clearInterval(interval);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  logger.info(`Keeper running — tick every ${INTERVAL_MS / 1000}s`);
}

main().catch((err) => {
  logger.error(`Fatal: ${err instanceof Error ? err.stack : String(err)}`);
  process.exit(1);
});
