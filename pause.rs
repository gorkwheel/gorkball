use anchor_lang::prelude::*;
use crate::state::GlobalState;
use crate::errors::GorkError;

#[derive(Accounts)]
pub struct Pause<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump,
        has_one = admin @ GorkError::NotAdmin,
    )]
    pub global_state: Account<'info, GlobalState>,
}

pub fn pause_handler(ctx: Context<Pause>) -> Result<()> {
    ctx.accounts.global_state.paused = true;
    msg!("Gorkwheel paused by {}", ctx.accounts.admin.key());
    Ok(())
}

pub fn unpause_handler(ctx: Context<Pause>) -> Result<()> {
    ctx.accounts.global_state.paused = false;
    msg!("Gorkwheel unpaused by {}", ctx.accounts.admin.key());
    Ok(())
}
