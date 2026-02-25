use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::GlobalState;
use crate::errors::GorkError;

#[derive(Accounts)]
pub struct InitializeGlobal<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = GlobalState::LEN,
        seeds = [b"global_state"],
        bump,
    )]
    pub global_state: Account<'info, GlobalState>,

    pub usdc_mint: Account<'info, Mint>,

    /// PDA-owned vault that holds USDC for rewards.
    #[account(
        init,
        payer = admin,
        token::mint = usdc_mint,
        token::authority = global_state,
        seeds = [b"reward_vault"],
        bump,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<InitializeGlobal>,
    max_per_minute: u64,
    max_per_day: u64,
) -> Result<()> {
    require!(max_per_minute > 0, GorkError::ZeroAmount);
    require!(max_per_day >= max_per_minute, GorkError::ZeroAmount);

    let clock = Clock::get()?;
    let gs = &mut ctx.accounts.global_state;

    gs.admin = ctx.accounts.admin.key();
    // Keeper defaults to admin; operator should call set_config to assign a
    // dedicated keeper wallet before going live.
    gs.keeper = ctx.accounts.admin.key();
    gs.paused = false;
    gs.last_update_ts = clock.unix_timestamp;
    gs.global_reward_index = 0;
    gs.usdc_mint = ctx.accounts.usdc_mint.key();
    gs.reward_vault = ctx.accounts.reward_vault.key();
    gs.max_per_minute = max_per_minute;
    gs.max_per_day = max_per_day;
    gs.daily_distributed = 0;
    gs.day_start_ts = clock.unix_timestamp;
    gs.bump = ctx.bumps.global_state;

    msg!(
        "Gorkwheel initialized. max_per_minute={} max_per_day={}",
        max_per_minute,
        max_per_day
    );

    Ok(())
}
