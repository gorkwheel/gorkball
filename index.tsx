import type { NextPage } from "next";
import Head from "next/head";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import AccruingIndicator from "../components/AccruingIndicator";
import { useGlobalState } from "../hooks/useGlobalState";
import { formatUsdc } from "../lib/constants";

const Home: NextPage = () => {
  const { state, loading, error } = useGlobalState();

  const lastUpdateDate = state
    ? new Date(state.lastUpdateTs * 1000).toLocaleString()
    : "—";

  const totalDistributed = state
    ? formatUsdc(state.dailyDistributed) + " USDC today"
    : "—";

  const rewardPerMinute = state
    ? formatUsdc(state.maxPerMinute) + " USDC max"
    : "—";

  return (
    <>
      <Head>
        <title>Gorkwheel — Flywheel Rewards</title>
        <meta
          name="description"
          content="Solana flywheel token with 1-minute reward accrual, AI-guided treasury logic, and strict on-chain guardrails."
        />
      </Head>

      <div className="min-h-screen bg-gork-bg">
        <Navbar />

        <main className="max-w-6xl mx-auto px-6 py-16">
          {/* Hero */}
          <div className="mb-16 max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs border border-gork-accent/30 text-gork-accent px-2 py-0.5 rounded">
                LIVE
              </span>
              {state?.paused && (
                <span className="text-xs border border-gork-yellow/30 text-gork-yellow px-2 py-0.5 rounded">
                  PAUSED
                </span>
              )}
            </div>
            <h1 className="text-3xl font-semibold text-gork-text mb-3 leading-tight">
              Rewards that accrue{" "}
              <span className="text-gork-accent">every minute.</span>
            </h1>
            <p className="text-gork-text-dim text-sm leading-relaxed max-w-lg">
              Gorkwheel distributes USDC to token holders via a reward index —
              no iteration over holders, no gas cliffs. One keeper transaction
              per minute advances the global index. Claim whenever you want.
            </p>
          </div>

          {/* Error state */}
          {error && (
            <div className="mb-8 border border-gork-red/30 bg-gork-red/10 rounded-lg p-4 text-gork-red text-sm">
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && !state && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="border border-gork-border bg-gork-surface rounded-lg p-5 h-24 animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Stats grid */}
          {state && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard
                  label="Today's Distribution"
                  value={totalDistributed}
                  accent
                />
                <StatCard
                  label="Max per Minute"
                  value={rewardPerMinute}
                />
                <StatCard
                  label="Last Update"
                  value={lastUpdateDate}
                />
                <StatCard
                  label="Status"
                  value={state.paused ? "Paused" : "Active"}
                  sub={state.paused ? "Admin intervention required" : "Keeper running"}
                  accent={!state.paused}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="md:col-span-2">
                  <AccruingIndicator
                    lastUpdateTs={state.lastUpdateTs}
                    paused={state.paused}
                  />
                </div>
                <StatCard
                  label="Global Reward Index"
                  value={state.globalRewardIndex.toString()}
                  sub="Monotonically increasing"
                  mono
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard
                  label="Daily Cap"
                  value={formatUsdc(state.maxPerDay) + " USDC"}
                  sub={`${((state.dailyDistributed / state.maxPerDay) * 100).toFixed(1)}% used today`}
                />
                <StatCard
                  label="Reward Vault"
                  value={state.rewardVault.slice(0, 8) + "..." + state.rewardVault.slice(-8)}
                  sub="PDA-owned USDC account"
                  mono
                />
              </div>
            </>
          )}

          {/* Bottom explainer */}
          <div className="mt-16 border-t border-gork-border pt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Scalable Index Model",
                body: "The global reward index advances once per minute. Each user stores only their last-seen index. On claim, the difference is multiplied by their balance. Zero holder iteration.",
              },
              {
                title: "AI-Guided, Human-Controlled",
                body: "The Gork AI advisor suggests distribution amounts. The keeper enforces hard caps before signing. The program enforces caps again on-chain. The AI never touches keys.",
              },
              {
                title: "On-Chain Guardrails",
                body: "Max per minute, daily caps, 60-second intervals, and pause switches are enforced in the deployed program. No off-chain trust required.",
              },
            ].map(({ title, body }) => (
              <div key={title}>
                <h3 className="text-sm font-semibold text-gork-text mb-2">{title}</h3>
                <p className="text-xs text-gork-text-dim leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </>
  );
};

export default Home;
