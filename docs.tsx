import type { NextPage } from "next";
import Head from "next/head";
import Navbar from "../components/Navbar";

interface Section {
  title: string;
  content: string;
  code?: string;
}

const sections: Section[] = [
  {
    title: "How the Reward Index Works",
    content: `Gorkwheel uses a global reward index to distribute USDC to all token holders without iterating over them.

The global_reward_index is a u128 value stored on-chain. Once per minute, the keeper bot calls update_index(amount), which increases the index by:

    delta = (amount * SCALE) / total_supply

Each user account stores user_index — the last global index they interacted with — and pending_rewards, already-settled USDC.

When a user claims (or any future interaction triggers settlement):

    earned = balance × (global_index − user_index) / SCALE
    pending_rewards += earned
    user_index = global_index

Then pending_rewards is transferred from the vault to the user's USDC ATA and zeroed.`,
    code: `// On-chain Rust (simplified)
let delta = (amount as u128)
    .checked_mul(INDEX_SCALE)?
    .checked_div(supply as u128)?;

global_state.global_reward_index += delta;

// On claim
let earned = (balance as u128)
    .checked_mul(index_delta)?
    .checked_div(INDEX_SCALE)? as u64;

user_state.pending_rewards += earned;
user_state.user_index = global_reward_index;`,
  },
  {
    title: "Why Not Iterate Over Holders?",
    content: `A naive distribution loop iterates over every holder account in a single transaction. On Solana, this runs into compute unit limits around 200–400 holders and fails catastrophically beyond that.

The index model is O(1) for the keeper (one transaction regardless of holder count) and O(1) for each user claim. There is no upper bound on the number of holders the protocol can serve.`,
  },
  {
    title: "Safety Model",
    content: `Three independent layers of protection enforce distribution limits:

1. The Gork AI advisor suggests an amount based on vault balance and recent activity. It has no keys and cannot sign transactions.

2. The keeper bot applies hard caps before building any transaction: max_per_minute and max_per_day are read from the on-chain GlobalState and enforced locally.

3. The on-chain program enforces the same caps a second time, plus a 60-second interval guard. No off-chain actor can exceed these limits.

The pause switch can be triggered by admin only. When paused, update_index and claim_rewards both reject with an error code.`,
  },
  {
    title: "AI Guardrails Explanation",
    content: `The Gork AI integration calls the xAI / Grok API and receives a JSON recommendation:

{ "action": "DISTRIBUTE" | "HOLD" | "PAUSE", "usdc_amount": ..., "confidence": ..., "reason": "..." }

The keeper validates this schema strictly. Any non-conforming response triggers the deterministic fallback strategy. The AI amount is capped to max_per_minute regardless of what the API returns.

If the API is unreachable or returns invalid JSON, the keeper falls back to a safe default: distribute the default amount if the vault is healthy, otherwise HOLD.

Critically: the AI never holds or knows the keeper private key. It cannot sign anything. It is purely advisory.`,
    code: `// Keeper guardrail enforcement
let amount = recommendation.usdc_amount;
amount = Math.min(amount, gs.maxPerMinute);        // never exceed on-chain cap
amount = Math.min(amount, remainingDaily);          // never exceed daily budget
if (vaultBalance < amount) return;                  // never drain vault`,
  },
  {
    title: "Security Notes",
    content: `- All arithmetic in the Rust program uses checked_add, checked_mul, checked_div, and checked_sub. Overflow causes a clean program error rather than silent wrap-around.
- The reward vault is a PDA-owned token account. Only the program can sign transfers out of it via CPI.
- user_state has_one = owner enforces that only the registered owner can claim.
- update_index requires the caller to be keeper or admin — enforced on-chain.
- Daily counter resets based on a stored day_start_ts, not a per-day flag, making it robust across restarts.`,
  },
  {
    title: "Known Limitations",
    content: `- The user must call initialize_user before accruing rewards. Rewards earned before that call are not retroactively credited (user_index is set to current global_index at init time).
- The daily cap is a rolling 24-hour window from day_start_ts, not a UTC calendar day.
- This is an MVP. For production, add: governance for admin transitions, time-locked upgrades, formal audit, oracle-based supply reads, and multi-sig admin.
- The keeper bot is single-instance. For high availability, run a hot standby with leader election.`,
  },
];

const Docs: NextPage = () => {
  return (
    <>
      <Head>
        <title>Docs — Gorkwheel</title>
      </Head>
      <div className="min-h-screen bg-gork-bg">
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-12">
          <div className="mb-10">
            <h1 className="text-2xl font-semibold text-gork-text mb-2">Protocol Docs</h1>
            <p className="text-sm text-gork-text-dim">
              How the flywheel works, why it scales, and how we keep it safe.
            </p>
          </div>

          <div className="space-y-12">
            {sections.map(({ title, content, code }) => (
              <section key={title}>
                <h2 className="text-base font-semibold text-gork-accent mb-3 pb-2 border-b border-gork-border">
                  {title}
                </h2>
                <div className="text-sm text-gork-text-dim leading-relaxed whitespace-pre-line mb-4">
                  {content}
                </div>
                {code && (
                  <pre className="bg-gork-surface border border-gork-border rounded-lg p-4 text-xs font-mono text-gork-text overflow-x-auto">
                    {code}
                  </pre>
                )}
              </section>
            ))}
          </div>
        </main>
      </div>
    </>
  );
};

export default Docs;
