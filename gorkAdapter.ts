/**
 * Gork AI Adapter
 *
 * Communicates with the xAI / Grok API to get a distribution recommendation.
 * The AI NEVER has access to private keys and NEVER signs transactions.
 * All guardrails (caps, pause checks) are enforced on-chain and in the keeper
 * independently of whatever the API returns.
 */

import axios, { AxiosError } from "axios";
import { logger } from "./logger";

export type GorkAction = "DISTRIBUTE" | "HOLD" | "PAUSE";

export interface GorkRecommendation {
  action: GorkAction;
  usdc_amount: number;
  confidence: number;
  reason: string;
}

interface GorkApiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const VALID_ACTIONS: GorkAction[] = ["DISTRIBUTE", "HOLD", "PAUSE"];

function isValidRecommendation(obj: unknown): obj is GorkRecommendation {
  if (typeof obj !== "object" || obj === null) return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.action === "string" &&
    VALID_ACTIONS.includes(r.action as GorkAction) &&
    typeof r.usdc_amount === "number" &&
    r.usdc_amount >= 0 &&
    typeof r.confidence === "number" &&
    r.confidence >= 0 &&
    r.confidence <= 1 &&
    typeof r.reason === "string"
  );
}

export interface MarketContext {
  currentGlobalIndex: string;
  vaultBalance: number;
  dailyDistributed: number;
  maxPerMinute: number;
  maxPerDay: number;
  lastUpdateTs: number;
}

export async function getGorkRecommendation(
  ctx: MarketContext,
  defaultAmount: number
): Promise<GorkRecommendation> {
  const apiKey = process.env.GORK_API_KEY;
  const apiUrl = process.env.GORK_API_URL ?? "https://api.x.ai/v1";

  // If no API key is configured, fall back to deterministic default strategy.
  if (!apiKey) {
    logger.info("GORK_API_KEY not set — using default distribution strategy");
    return buildDefaultRecommendation(ctx, defaultAmount);
  }

  const systemPrompt = `You are Gorkwheel's treasury advisor. Your sole job is to recommend
how much USDC to distribute to token holders each minute from the reward vault.
Respond ONLY with a valid JSON object matching this exact schema (no markdown, no extra text):
{
  "action": "DISTRIBUTE" | "HOLD" | "PAUSE",
  "usdc_amount": <integer in micro-USDC, 0 if HOLD/PAUSE>,
  "confidence": <float 0.0–1.0>,
  "reason": "<single sentence>"
}
Safety: never recommend above max_per_minute. If vault_balance is low, recommend HOLD.`;

  const userPrompt = `Current state:
- global_reward_index: ${ctx.currentGlobalIndex}
- vault_balance_usdc: ${(ctx.vaultBalance / 1_000_000).toFixed(6)}
- daily_distributed_usdc: ${(ctx.dailyDistributed / 1_000_000).toFixed(6)}
- max_per_minute_usdc: ${(ctx.maxPerMinute / 1_000_000).toFixed(6)}
- max_per_day_usdc: ${(ctx.maxPerDay / 1_000_000).toFixed(6)}
- last_update_ts: ${ctx.lastUpdateTs}
Provide your distribution recommendation.`;

  const messages: GorkApiMessage[] = [{ role: "user", content: userPrompt }];

  try {
    const response = await axios.post(
      `${apiUrl}/messages`,
      {
        model: "grok-2-latest",
        max_tokens: 256,
        system: systemPrompt,
        messages,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        timeout: 10_000,
      }
    );

    const raw: string =
      response.data?.content?.[0]?.text ?? response.data?.choices?.[0]?.message?.content ?? "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      logger.warn(`Gork API returned non-JSON: ${raw.slice(0, 200)}`);
      return buildDefaultRecommendation(ctx, defaultAmount);
    }

    if (!isValidRecommendation(parsed)) {
      logger.warn("Gork API returned invalid schema — falling back to default");
      return buildDefaultRecommendation(ctx, defaultAmount);
    }

    logger.info(
      `Gork recommendation: action=${parsed.action} amount=${parsed.usdc_amount} ` +
        `confidence=${parsed.confidence.toFixed(2)} reason="${parsed.reason}"`
    );

    return parsed;
  } catch (err) {
    const ae = err as AxiosError;
    logger.error(
      `Gork API request failed: ${ae.message ?? String(err)} — falling back to default`
    );
    return buildDefaultRecommendation(ctx, defaultAmount);
  }
}

/**
 * Deterministic fallback when AI is unavailable.
 * Distributes the default amount unless the vault is nearly empty.
 */
function buildDefaultRecommendation(
  ctx: MarketContext,
  defaultAmount: number
): GorkRecommendation {
  // Hold if vault cannot cover two more minutes.
  if (ctx.vaultBalance < defaultAmount * 2) {
    return {
      action: "HOLD",
      usdc_amount: 0,
      confidence: 1.0,
      reason: "Vault balance is too low for safe distribution",
    };
  }

  // Hold if daily cap would be exceeded.
  if (ctx.dailyDistributed + defaultAmount > ctx.maxPerDay) {
    return {
      action: "HOLD",
      usdc_amount: 0,
      confidence: 1.0,
      reason: "Daily distribution cap reached",
    };
  }

  return {
    action: "DISTRIBUTE",
    usdc_amount: Math.min(defaultAmount, ctx.maxPerMinute),
    confidence: 0.9,
    reason: "Default deterministic distribution strategy",
  };
}
