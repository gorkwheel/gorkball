use anchor_lang::prelude::*;
use crate::state::{GlobalState, INDEX_SCALE};
use crate::errors::GorkError;

/// Minimum seconds between index updates.
pub const MIN_UPDATE_INTERVAL: i64 = 60;
/// Seconds in a day.
pub const DAY_SECONDS: i64 = 86_400;

#[derive(Accounts)]
pub struct UpdateIndex<'info> {
    /// Must be keeper or admin.
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump,
    )]
    pub global_state: Account<'info, GlobalState>,

    /// The SPL token supply account for the gork token.
    /// We read `supply` from this to compute per-token index delta.
    /// CHECK: We only read the parsed mint data; Anchor validates the address
    /// matches global_state.usdc_mint is NOT required here — this is the
    /// GORK mint whose supply we distribute rewards against.
    /// In production, store gork_mint in GlobalState.
    pub gork_mint: AccountInfo<'info>,
}

pub fn handler(ctx: Context<UpdateIndex>, amount_usdc: u64) -> Result<()> {
    let gs = &mut ctx.accounts.global_state;
    let caller = ctx.accounts.caller.key();

    // --- Auth ---
    require!(
        caller == gs.keeper || caller == gs.admin,
        GorkError::NotKeeper
    );

    // --- Pause guard ---
    require!(!gs.paused, GorkError::Paused);

    // --- Zero amount guard ---
    require!(amount_usdc > 0, GorkError::ZeroAmount);

    // --- Time guard: enforce 60-second minimum ---
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    require!(
        now >= gs.last_update_ts
            .checked_add(MIN_UPDATE_INTERVAL)
            .ok_or(GorkError::MathOverflow)?,
        GorkError::TooEarly
    );

    // --- Per-minute cap ---
    require!(amount_usdc <= gs.max_per_minute, GorkError::ExceedsMinuteCap);

    // --- Daily rolling window reset ---
    let day_elapsed = now
        .checked_sub(gs.day_start_ts)
        .ok_or(GorkError::MathOverflow)?;
    if day_elapsed >= DAY_SECONDS {
        gs.daily_distributed = 0;
        gs.day_start_ts = now;
    }

    // --- Daily cap check ---
    let new_daily = gs
        .daily_distributed
        .checked_add(amount_usdc)
        .ok_or(GorkError::MathOverflow)?;
    require!(new_daily <= gs.max_per_day, GorkError::ExceedsDailyCap);
    gs.daily_distributed = new_daily;

    // --- Read circulating supply from gork_mint account ---
    // We parse the raw mint data to get the supply field (u64 at offset 36).
    // This avoids importing a full Mint account and keeps the instruction
    // lightweight. In production, you would use anchor_spl::token::Mint.
    let mint_data = ctx.accounts.gork_mint.try_borrow_data()?;
    // SPL Mint layout: option<freeze_authority> isn't fixed offset — use
    // anchor_spl layout: supply is at bytes 36..44.
    let supply = u64::from_le_bytes(
        mint_data[36..44]
            .try_into()
            .map_err(|_| GorkError::MathOverflow)?,
    );
    require!(supply > 0, GorkError::ZeroBalance);

    // --- Compute index delta ---
    // delta = (amount_usdc * INDEX_SCALE) / supply
    // This is the increase in rewards per 1 token of supply.
    let delta = (amount_usdc as u128)
        .checked_mul(INDEX_SCALE)
        .ok_or(GorkError::MathOverflow)?
        .checked_div(supply as u128)
        .ok_or(GorkError::MathOverflow)?;

    // --- Advance global index ---
    gs.global_reward_index = gs
        .global_reward_index
        .checked_add(delta)
        .ok_or(GorkError::MathOverflow)?;

    gs.last_update_ts = now;

    msg!(
        "update_index: amount={} delta={} new_index={} daily_distributed={}",
        amount_usdc,
        delta,
        gs.global_reward_index,
        gs.daily_distributed,
    );

    Ok(())
}
