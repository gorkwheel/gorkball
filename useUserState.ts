import { useEffect, useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, GORK_MINT, computeClaimable } from "../lib/constants";
import { GlobalState } from "./useGlobalState";

export interface UserState {
  userIndex: bigint;
  pendingRewards: bigint;
  claimable: bigint;
  gorkBalance: bigint;
}

function parseUserState(data: Buffer): { userIndex: bigint; pendingRewards: bigint } {
  let offset = 8; // discriminator
  offset += 32; // owner
  const userIndex = data.readBigUInt64LE(offset) +
    data.readBigUInt64LE(offset + 8) * BigInt("18446744073709551616");
  offset += 16;
  const pendingRewards = data.readBigUInt64LE(offset);
  return { userIndex, pendingRewards };
}

export function useUserState(globalState: GlobalState | null) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [state, setState] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey || !globalState) {
      setState(null);
      return;
    }
    setLoading(true);
    try {
      const [userStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_state"), publicKey.toBuffer()],
        PROGRAM_ID
      );

      const [userAccount, gorkAccountList] = await Promise.all([
        connection.getAccountInfo(userStatePda),
        connection.getTokenAccountsByOwner(publicKey, { mint: GORK_MINT }),
      ]);

      let userIndex = BigInt(0);
      let pendingRewards = BigInt(0);

      if (userAccount) {
        const parsed = parseUserState(Buffer.from(userAccount.data));
        userIndex = parsed.userIndex;
        pendingRewards = parsed.pendingRewards;
      }

      let gorkBalance = BigInt(0);
      if (gorkAccountList.value.length > 0) {
        const raw = gorkAccountList.value[0].account.data;
        // SPL token account: amount at offset 64
        gorkBalance = Buffer.from(raw).readBigUInt64LE(64);
      }

      const claimable = computeClaimable(
        globalState.globalRewardIndex,
        userIndex,
        pendingRewards,
        gorkBalance
      );

      setState({ userIndex, pendingRewards, claimable, gorkBalance });
    } finally {
      setLoading(false);
    }
  }, [publicKey, globalState, connection]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { state, loading, refresh };
}
