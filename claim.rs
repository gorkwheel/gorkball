use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{GlobalState, UserState, INDEX_SCALE};
use crate::errors::GorkError;

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump,
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        mut,
        seeds = [b"user_state", user.key().as_ref()],
        bump = user_state.bump,
        has_one = owner @ GorkError::NotAdmin,
    )]
    pub user_state: Account<'info, UserState>,

    /// User's gork token account — we read the balance to compute accrued rewards.
    #[account(
        constraint = user_gork_account.owner == user.key(),
    )]
    pub user_gork_account: Account<'info, TokenAccount>,

    /// PDA vault that holds USDC for distribution.
    #[account(
        mut,
        seeds = [b"reward_vault"],
        bump,
        constraint = reward_vault.key() == global_state.reward_vault,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    /// User's USDC ATA to receive rewards.
    #[account(
        mut,
        constraint = user_usdc_account.owner == user.key(),
        constraint = user_usdc_account.mint == global_state.usdc_mint,
    )]
    pub user_usdc_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Settle pending rewards for a user without transferring.
/// This helper is reusable for future "deposit/withdraw" flows.
pub fn accrue_rewards(
    global_index: u128,
    user_state: &mut UserState,
    user_token_balance: u64,
) -> Result<()> {
    let index_delta = global_index
        .checked_sub(user_state.user_index)
        .ok_or(GorkError::MathOverflow)?;

    if index_delta > 0 && user_token_balance > 0 {
        // earned = balance * (global_index - user_index) / INDEX_SCALE
        let earned = (user_token_balance as u128)
            .checked_mul(index_delta)
            .ok_or(GorkError::MathOverflow)?
            .checked_div(INDEX_SCALE)
            .ok_or(GorkError::MathOverflow)? as u64;

        user_state.pending_rewards = user_state
            .pending_rewards
            .checked_add(earned)
            .ok_or(GorkError::MathOverflow)?;
    }

    // Always sync index, even if balance was 0, to avoid stale snapshots.
    user_state.user_index = global_index;
    Ok(())
}

pub fn handler(ctx: Context<ClaimRewards>) -> Result<()> {
    let gs = &ctx.accounts.global_state;

    require!(!gs.paused, GorkError::Paused);

    let global_index = gs.global_reward_index;
    let usdc_mint = gs.usdc_mint;
    let reward_vault_key = gs.reward_vault;
    let gs_bump = gs.bump;

    let us = &mut ctx.accounts.user_state;
    let user_balance = ctx.accounts.user_gork_account.amount;

    // Settle any newly accrued rewards.
    accrue_rewards(global_index, us, user_balance)?;

    let claimable = us.pending_rewards;
    require!(claimable > 0, GorkError::NothingToClaim);

    // Verify vault has enough funds.
    require!(
        ctx.accounts.reward_vault.amount >= claimable,
        GorkError::InsufficientVaultBalance
    );

    // Zero out pending before CPI (reentrancy-safe ordering).
    us.pending_rewards = 0;

    // Transfer USDC from vault PDA to user ATA.
    let seeds: &[&[u8]] = &[b"global_state", &[gs_bump]];
    let signer_seeds = &[seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.reward_vault.to_account_info(),
            to: ctx.accounts.user_usdc_account.to_account_info(),
            authority: ctx.accounts.global_state.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(cpi_ctx, claimable)?;

    msg!(
        "claim_rewards: user={} amount={} remaining_vault={}",
        ctx.accounts.user.key(),
        claimable,
        ctx.accounts.reward_vault.amount.saturating_sub(claimable),
    );

    Ok(())
}
