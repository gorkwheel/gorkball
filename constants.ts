import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "GrkW1111111111111111111111111111111111111111"
);

export const USDC_MINT = new PublicKey(
  // Devnet USDC
  process.env.NEXT_PUBLIC_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

export const GORK_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_GORK_MINT ?? "GrkW1111111111111111111111111111111111111111"
);

export const INDEX_SCALE = BigInt("1000000000000"); // 1e12

export const USDC_DECIMALS = 6;

export function formatUsdc(amount: bigint | number): string {
  const n = typeof amount === "bigint" ? Number(amount) : amount;
  return (n / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export function formatIndex(index: bigint): string {
  return index.toString();
}

export function computeClaimable(
  globalIndex: bigint,
  userIndex: bigint,
  pendingRewards: bigint,
  userTokenBalance: bigint
): bigint {
  if (globalIndex <= userIndex) return pendingRewards;
  const delta = globalIndex - userIndex;
  const earned = (userTokenBalance * delta) / INDEX_SCALE;
  return pendingRewards + earned;
}
