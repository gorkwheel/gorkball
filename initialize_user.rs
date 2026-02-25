use anchor_lang::prelude::*;
use crate::state::{GlobalState, UserState};

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"global_state"],
        bump = global_state.bump,
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        init,
        payer = user,
        space = UserState::LEN,
        seeds = [b"user_state", user.key().as_ref()],
        bump,
    )]
    pub user_state: Account<'info, UserState>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeUser>) -> Result<()> {
    let us = &mut ctx.accounts.user_state;
    let gs = &ctx.accounts.global_state;

    us.owner = ctx.accounts.user.key();
    // Sync to current global index so the user doesn't claim rewards that
    // accrued before they registered.
    us.user_index = gs.global_reward_index;
    us.pending_rewards = 0;
    us.bump = ctx.bumps.user_state;

    msg!("UserState initialized for {}", us.owner);
    Ok(())
}
