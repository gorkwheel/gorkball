use anchor_lang::prelude::*;

/// Global program state — one PDA per deployment.
#[account]
#[derive(Default)]
pub struct GlobalState {
    /// Admin pubkey — can call pause/unpause and set_config.
    pub admin: Pubkey,
    /// Keeper pubkey — the only wallet allowed to call update_index.
    pub keeper: Pubkey,
    /// When true, update_index and claim_rewards are blocked.
    pub paused: bool,
    /// Unix timestamp of the last successful update_index call.
    pub last_update_ts: i64,
    /// Monotonically-increasing reward index (scaled by INDEX_SCALE).
    /// Represents cumulative USDC distributed per 1 token of supply.
    pub global_reward_index: u128,
    /// USDC SPL mint address.
    pub usdc_mint: Pubkey,
    /// PDA-owned USDC vault token account.
    pub reward_vault: Pubkey,
    /// Maximum USDC (in lamports/micro-USDC) distributable per minute.
    pub max_per_minute: u64,
    /// Maximum USDC distributable per 24-hour rolling window.
    pub max_per_day: u64,
    /// How much has been distributed today (resets each UTC day).
    pub daily_distributed: u64,
    /// Unix timestamp of the start of the current accounting day.
    pub day_start_ts: i64,
    /// PDA bump.
    pub bump: u8,
}

impl GlobalState {
    pub const LEN: usize = 8  // discriminator
        + 32  // admin
        + 32  // keeper
        + 1   // paused
        + 8   // last_update_ts
        + 16  // global_reward_index
        + 32  // usdc_mint
        + 32  // reward_vault
        + 8   // max_per_minute
        + 8   // max_per_day
        + 8   // daily_distributed
        + 8   // day_start_ts
        + 1;  // bump
}

/// Per-user reward tracking state.
#[account]
#[derive(Default)]
pub struct UserState {
    /// Wallet that owns this state.
    pub owner: Pubkey,
    /// Snapshot of global_reward_index at last interaction.
    pub user_index: u128,
    /// Accrued USDC not yet transferred to the user.
    pub pending_rewards: u64,
    /// PDA bump.
    pub bump: u8,
}

impl UserState {
    pub const LEN: usize = 8  // discriminator
        + 32  // owner
        + 16  // user_index
        + 8   // pending_rewards
        + 1;  // bump
}

/// Scaling factor for reward index arithmetic.
/// Using 1e12 gives precision while staying well within u128.
pub const INDEX_SCALE: u128 = 1_000_000_000_000;
