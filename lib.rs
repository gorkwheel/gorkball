use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("GrkW1111111111111111111111111111111111111111");

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

#[program]
pub mod gorkwheel_program {
    use super::*;

    /// Initialize global state. Called once by admin.
    pub fn initialize_global(
        ctx: Context<InitializeGlobal>,
        max_per_minute: u64,
        max_per_day: u64,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, max_per_minute, max_per_day)
    }

    /// Called by keeper every ≥60 seconds. Advances global_reward_index.
    pub fn update_index(ctx: Context<UpdateIndex>, amount_usdc: u64) -> Result<()> {
        instructions::update_index::handler(ctx, amount_usdc)
    }

    /// User claims accrued USDC rewards.
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        instructions::claim::handler(ctx)
    }

    /// Admin updates config caps.
    pub fn set_config(
        ctx: Context<SetConfig>,
        max_per_minute: u64,
        max_per_day: u64,
    ) -> Result<()> {
        instructions::set_config::handler(ctx, max_per_minute, max_per_day)
    }

    /// Admin pauses the program.
    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        instructions::pause::pause_handler(ctx)
    }

    /// Admin unpauses the program.
    pub fn unpause(ctx: Context<Pause>) -> Result<()> {
        instructions::pause::unpause_handler(ctx)
    }

    /// Initialize or refresh a user state account.
    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        instructions::initialize_user::handler(ctx)
    }
}
