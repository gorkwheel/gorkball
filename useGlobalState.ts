import { useEffect, useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "../lib/constants";

export interface GlobalState {
  paused: boolean;
  lastUpdateTs: number;
  globalRewardIndex: bigint;
  usdcMint: string;
  rewardVault: string;
  maxPerMinute: number;
  maxPerDay: number;
  dailyDistributed: number;
  dayStartTs: number;
}

const GLOBAL_STATE_PDA = PublicKey.findProgramAddressSync(
  [Buffer.from("global_state")],
  PROGRAM_ID
)[0];

// Minimal account data parser — offsets match the Rust struct layout.
// Discriminator (8) + admin (32) + keeper (32) + paused (1) + last_update_ts (8) +
// global_reward_index (16) + usdc_mint (32) + reward_vault (32) +
// max_per_minute (8) + max_per_day (8) + daily_distributed (8) + day_start_ts (8) + bump (1)
function parseGlobalState(data: Buffer): GlobalState {
  let offset = 8; // skip discriminator
  offset += 32; // admin
  offset += 32; // keeper
  const paused = data[offset] === 1;
  offset += 1;
  const lastUpdateTs = Number(data.readBigInt64LE(offset));
  offset += 8;
  const globalRewardIndex = data.readBigUInt64LE(offset) +
    data.readBigUInt64LE(offset + 8) * BigInt("18446744073709551616");
  offset += 16;
  const usdcMint = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;
  const rewardVault = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;
  const maxPerMinute = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const maxPerDay = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const dailyDistributed = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const dayStartTs = Number(data.readBigInt64LE(offset));

  return {
    paused,
    lastUpdateTs,
    globalRewardIndex,
    usdcMint,
    rewardVault,
    maxPerMinute,
    maxPerDay,
    dailyDistributed,
    dayStartTs,
  };
}

export function useGlobalState() {
  const { connection } = useConnection();
  const [state, setState] = useState<GlobalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const account = await connection.getAccountInfo(GLOBAL_STATE_PDA);
      if (!account) {
        setError("GlobalState account not found — program may not be initialized");
        return;
      }
      setState(parseGlobalState(Buffer.from(account.data)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { state, loading, error, refresh };
}
