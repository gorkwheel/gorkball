use anchor_lang::prelude::*;

#[error_code]
pub enum GorkError {
    #[msg("Program is currently paused")]
    Paused,

    #[msg("Unauthorized: caller is not admin")]
    NotAdmin,

    #[msg("Unauthorized: caller is not keeper or admin")]
    NotKeeper,

    #[msg("Update interval not elapsed: must wait at least 60 seconds")]
    TooEarly,

    #[msg("Amount exceeds max_per_minute cap")]
    ExceedsMinuteCap,

    #[msg("Amount exceeds daily distribution cap")]
    ExceedsDailyCap,

    #[msg("No rewards available to claim")]
    NothingToClaim,

    #[msg("Arithmetic overflow")]
    MathOverflow,

    #[msg("Vault has insufficient funds")]
    InsufficientVaultBalance,

    #[msg("Invalid amount: must be greater than zero")]
    ZeroAmount,

    #[msg("User token balance is zero; cannot accrue rewards")]
    ZeroBalance,
}
