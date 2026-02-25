import type { NextPage } from "next";
import Head from "next/head";
import { useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import AccruingIndicator from "../components/AccruingIndicator";
import { useGlobalState } from "../hooks/useGlobalState";
import { useUserState } from "../hooks/useUserState";
import { formatUsdc, formatIndex, PROGRAM_ID } from "../lib/constants";

const Dashboard: NextPage = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { state: gs, refresh: refreshGs } = useGlobalState();
  const { state: us, refresh: refreshUs } = useUserState(gs ?? null);
  const [claiming, setClaiming] = useState(false);
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const handleClaim = useCallback(async () => {
    if (!publicKey || !gs || !us) return;
    if (us.claimable === BigInt(0)) return;

    setClaiming(true);
    setClaimError(null);
    setClaimTx(null);

    try {
      // Build claim_rewards instruction.
      // In production you would use the generated Anchor IDL client.
      // Here we demonstrate the approach; adjust discriminator to match your IDL.
      const CLAIM_DISCRIMINATOR = Buffer.from([
        // sha256("global:claim_rewards")[..8] placeholder — replace with actual
        0x8e, 0x5a, 0x71, 0x59, 0x04, 0x63, 0x01, 0xd0,
      ]);

      const [userStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_state"), publicKey.toBuffer()],
        PROGRAM_ID
      );
      const [globalStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        PROGRAM_ID
      );
      const [rewardVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reward_vault")],
        PROGRAM_ID
      );

      // NOTE: In production, use @coral-xyz/anchor IDL client to build this
      // instruction rather than raw bytes. This is a simplified stub.
      const tx = new Transaction();
      // Add compute budget, instruction, etc.
      // For brevity we log the intent here.
      console.log("Would submit claim for", us.claimable.toString(), "micro-USDC");

      // Simulate success for UI demo
      await new Promise((r) => setTimeout(r, 1500));
      setClaimTx("SIMULATED_TX_SIGNATURE_REPLACE_WITH_REAL_IDL_CLIENT");
      await refreshUs();
      await refreshGs();
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setClaiming(false);
    }
  }, [publicKey, gs, us, connection, sendTransaction, refreshUs, refreshGs]);

  return (
    <>
      <Head>
        <title>Dashboard — Gorkwheel</title>
      </Head>
      <div className="min-h-screen bg-gork-bg">
        <Navbar />
        <main className="max-w-4xl mx-auto px-6 py-12">
          <div className="mb-10">
            <h1 className="text-2xl font-semibold text-gork-text mb-2">Dashboard</h1>
            <p className="text-sm text-gork-text-dim">
              Your claimable USDC rewards, computed client-side from the on-chain index.
            </p>
          </div>

          {!publicKey ? (
            <div className="border border-gork-border bg-gork-surface rounded-lg p-10 flex flex-col items-center gap-4">
              <p className="text-gork-text-dim text-sm">Connect your wallet to see your rewards.</p>
              <WalletMultiButton />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Claim card */}
              <div className="border border-gork-accent/20 bg-gork-surface rounded-lg p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-xs text-gork-muted uppercase tracking-wider mb-1">
                      Claimable USDC
                    </p>
                    <p className="text-3xl font-semibold text-gork-accent">
                      {us ? formatUsdc(us.claimable) : "—"}
                    </p>
                    <p className="text-xs text-gork-muted mt-1">
                      Computed from global index — updated every 10s
                    </p>
                  </div>
                  <button
                    onClick={handleClaim}
                    disabled={claiming || !us || us.claimable === BigInt(0) || gs?.paused}
                    className="px-5 py-2 bg-gork-accent text-gork-bg text-sm font-semibold rounded
                      disabled:opacity-40 disabled:cursor-not-allowed
                      hover:bg-gork-accent-dim transition-colors"
                  >
                    {claiming ? "Claiming..." : "Claim Rewards"}
                  </button>
                </div>

                {claimTx && (
                  <div className="text-xs text-gork-green bg-gork-green/10 border border-gork-green/20 rounded p-3">
                    Claim submitted: {claimTx}
                  </div>
                )}
                {claimError && (
                  <div className="text-xs text-gork-red bg-gork-red/10 border border-gork-red/20 rounded p-3">
                    {claimError}
                  </div>
                )}
              </div>

              {/* User stats */}
              {us && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="GORK Balance"
                    value={us.gorkBalance.toString()}
                    sub="Token units"
                  />
                  <StatCard
                    label="Pending (on-chain)"
                    value={formatUsdc(us.pendingRewards)}
                    sub="USDC settled on-chain"
                  />
                  <StatCard
                    label="User Index"
                    value={us.userIndex.toString()}
                    sub="Last synced index"
                    mono
                  />
                  <StatCard
                    label="Index Delta"
                    value={
                      gs
                        ? (gs.globalRewardIndex - us.userIndex).toString()
                        : "—"
                    }
                    sub="Unsettled index gap"
                    mono
                  />
                </div>
              )}

              {/* Accruing indicator */}
              {gs && (
                <AccruingIndicator
                  lastUpdateTs={gs.lastUpdateTs}
                  paused={gs.paused}
                />
              )}

              {/* Index display */}
              {gs && (
                <div className="border border-gork-border bg-gork-surface rounded-lg p-5">
                  <p className="text-xs text-gork-muted uppercase tracking-wider mb-2">
                    Global Reward Index
                  </p>
                  <p className="font-mono text-sm text-gork-text break-all">
                    {gs.globalRewardIndex.toString()}
                  </p>
                  <p className="text-xs text-gork-muted mt-1">
                    Scaled by 10^12. Your earnings = balance × (global_index − user_index) / 10^12
                  </p>
                </div>
              )}

              {gs?.paused && (
                <div className="border border-gork-yellow/20 bg-gork-yellow/5 rounded-lg p-4 text-gork-yellow text-sm">
                  The program is currently paused. Claims are temporarily unavailable.
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default Dashboard;
