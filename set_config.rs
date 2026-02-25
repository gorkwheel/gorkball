use anchor_lang::prelude::*;
use crate::state::GlobalState;
use crate::errors::GorkError;

#[derive(Accounts)]
pub struct SetConfig<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump,
        has_one = admin @ GorkError::NotAdmin,
    )]
    pub global_state: Account<'info, GlobalState>,
}

pub fn handler(
    ctx: Context<SetConfig>,
    max_per_minute: u64,
    max_per_day: u64,
) -> Result<()> {
    require!(max_per_minute > 0, GorkError::ZeroAmount);
    require!(max_per_day >= max_per_minute, GorkError::ZeroAmount);

    let gs = &mut ctx.accounts.global_state;
    gs.max_per_minute = max_per_minute;
    gs.max_per_day = max_per_day;

    msg!(
        "set_config: max_per_minute={} max_per_day={}",
        max_per_minute,
        max_per_day,
    );
    Ok(())
}
