# Gorkwheel

> **Gorkwheel — a Solana flywheel token with 1-minute reward accrual, AI-guided treasury logic, and strict on-chain guardrails.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Gorkwheel System                        │
│                                                                 │
│  ┌──────────────┐     ┌──────────────────┐                     │
│  │  Gork AI API │────▶│   Keeper Bot      │                     │
│  │  (xAI/Grok)  │     │  (TypeScript)     │                     │
│  │              │     │                   │                     │
│  │ Advisory     │     │  • Validates AI   │                     │
│  │ only. No     │     │    output         │                     │
│  │ keys. No     │     │  • Enforces caps  │                     │
│  │ signing.     │     │  • Retries        │                     │
│  └──────────────┘     │  • Health check   │                     │
│                       └────────┬─────────┘                     │
│                                │ update_index(amount)           │
│                                │ (1 tx per minute)              │
│                                ▼                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Solana Program (Anchor / Rust)               │   │
│  │                                                          │   │
│  │  GlobalState PDA                 UserState PDA           │   │
│  │  ┌──────────────────────┐       ┌────────────────────┐  │   │
│  │  │ global_reward_index  │       │ user_index         │  │   │
│  │  │ last_update_ts       │       │ pending_rewards    │  │   │
│  │  │ max_per_minute       │       │ owner              │  │   │
│  │  │ max_per_day          │       └────────────────────┘  │   │
│  │  │ daily_distributed    │                               │   │
│  │  │ paused               │       RewardVault PDA         │   │
│  │  │ usdc_mint            │       ┌────────────────────┐  │   │
│  │  │ reward_vault         │       │ PDA-owned USDC     │  │   │
│  │  └──────────────────────┘       │ SPL token account  │  │   │
│  │                                 └────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                ▲                                │
│                                │ claim_rewards()                │
│                                │ (user-triggered, anytime)      │
│  ┌─────────────────────────────┴──────────────┐                 │
│  │           Next.js Frontend (app/)           │                 │
│  │                                            │                 │
│  │  • Wallet connect (Phantom / Solflare)     │                 │
│  │  • Real-time index display                 │                 │
│  │  • Claimable USDC computed client-side     │                 │
│  │  • Accruing progress indicator             │                 │
│  └────────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Reward Index Model

The core invariant (O(1) per keeper tx, O(1) per user claim, unlimited holders):

```
# Each minute:
delta = (usdc_amount * SCALE) / total_supply
global_reward_index += delta

# On claim (or any user interaction):
earned = user_gork_balance × (global_reward_index − user_index) / SCALE
pending_rewards += earned
user_index = global_reward_index

# Transfer:
transfer(vault → user_ata, pending_rewards)
pending_rewards = 0
```

`SCALE = 1e12`. The index is a u128 — it will not overflow for centuries at any realistic distribution rate.

---

## File Tree

```
gorkwheel/
├── Anchor.toml
├── Cargo.toml
├── package.json
├── tsconfig.json
├── README.md
│
├── programs/
│   └── gorkwheel_program/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs                    # Program entrypoint
│           ├── state.rs                  # GlobalState + UserState accounts
│           ├── errors.rs                 # Custom error codes
│           └── instructions/
│               ├── mod.rs
│               ├── initialize.rs         # initialize_global
│               ├── initialize_user.rs    # initialize_user
│               ├── update_index.rs       # update_index (keeper call)
│               ├── claim.rs              # claim_rewards
│               ├── set_config.rs         # set_config
│               └── pause.rs              # pause / unpause
│
├── keeper/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── index.ts                      # Main loop + graceful shutdown
│       ├── client.ts                     # Anchor program client
│       ├── gorkAdapter.ts                # Gork/xAI AI advisory adapter
│       ├── health.ts                     # Express health check server
│       └── logger.ts                     # Winston logger
│
├── app/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── .env.example
│   └── src/
│       ├── styles/globals.css
│       ├── lib/constants.ts              # Program IDs, formatters, math
│       ├── hooks/
│       │   ├── useGlobalState.ts
│       │   └── useUserState.ts
│       ├── components/
│       │   ├── Navbar.tsx
│       │   ├── StatCard.tsx
│       │   └── AccruingIndicator.tsx
│       └── pages/
│           ├── _app.tsx
│           ├── _document.tsx
│           ├── index.tsx                 # Home / overview
│           ├── dashboard.tsx             # User rewards dashboard
│           └── docs.tsx                 # Protocol documentation
│
└── tests/
    └── gorkwheel.ts                      # Anchor test suite
```

---

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) + `rustup`
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) ≥ 1.18
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) ≥ 0.29
- Node.js ≥ 18 + yarn or npm
- A funded Solana keypair

---

## Setup — Localnet

```bash
# 1. Clone and install root deps
git clone <repo> && cd gorkwheel
yarn install

# 2. Start local validator
solana-test-validator --reset &

# 3. Build the program
anchor build

# 4. Run tests
anchor test --skip-local-validator
```

---

## Setup — Devnet Deploy

```bash
# 1. Configure Solana CLI
solana config set --url devnet
solana airdrop 2

# 2. Build
anchor build

# 3. Deploy
anchor deploy --provider.cluster devnet

# 4. Note the program ID, update Anchor.toml + .env files

# 5. Initialize global state (run once)
# Use scripts/initialize.ts (write per your setup) or Anchor CLI:
anchor run initialize
```

---

## Run Keeper Bot

```bash
cd keeper

# Copy and fill in env
cp .env.example .env
# Edit .env: RPC_URL, KEEPER_PRIVATE_KEY, PROGRAM_ID, GORK_MINT, USDC_MINT

# Install deps
yarn install

# Development (ts-node)
yarn dev

# Production
yarn build && yarn start

# Dry run (no transactions submitted)
DRY_RUN=true yarn dev
```

Health check endpoint: `http://localhost:3001/health`

---

## Run Frontend

```bash
cd app

# Copy and fill in env
cp .env.example .env.local
# Edit NEXT_PUBLIC_PROGRAM_ID, NEXT_PUBLIC_GORK_MINT

# Install deps
yarn install

# Development
yarn dev

# Production build
yarn build && yarn start
```

---

## Security Notes

**On-chain guarantees (cannot be bypassed by any off-chain actor):**
- `update_index` enforces 60-second minimum interval via `last_update_ts`
- `update_index` enforces `max_per_minute` and `max_per_day` caps
- Only `keeper` or `admin` pubkeys may call `update_index`
- Only account `owner` may claim their rewards (`has_one = owner`)
- All arithmetic uses `checked_*` methods — overflow causes a clean error
- The vault is a PDA-owned token account; only the program can transfer from it

**AI guardrails:**
- The Gork AI API is advisory only and never has access to any private key
- Keeper applies caps to AI output before building any transaction
- On-chain program enforces caps independently regardless of keeper behavior
- AI `PAUSE` recommendations are logged but require human admin action

**Operational:**
- Use a dedicated keeper keypair with minimal SOL balance
- Use a hardware wallet or KMS for the admin keypair
- Monitor the health endpoint; page on `consecutiveFailures ≥ 3`
- The vault should be funded well in advance; add monitoring on vault balance

---

## Known Limitations

1. Users must call `initialize_user` before their rewards accrue. Rewards distributed before registration are not retroactively credited — `user_index` is set to the current global index at init time.

2. The daily cap resets from `day_start_ts` (rolling 24h window), not a UTC calendar day. This is intentional for simplicity but differs from conventional daily resets.

3. The keeper is single-instance. For production high availability, add leader election (e.g., via Redis SETNX) so only one keeper signs per minute.

4. The frontend claim instruction uses a stub discriminator for illustration. Replace with the generated Anchor IDL client in production.

5. `gork_mint` is passed as an unchecked `AccountInfo` to `update_index` for supply reading. In production, add an additional check that this matches a `gork_mint` field stored in `GlobalState`.

6. This is an unaudited MVP. Do not deploy to mainnet with real funds without a professional security audit.

---

## License

MIT
