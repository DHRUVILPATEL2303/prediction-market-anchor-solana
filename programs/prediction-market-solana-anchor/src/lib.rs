pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use events::*;
use instructions::*;
pub use state::*; // NOTE: private use of instructions::*; to bring Context structs into scope

declare_id!("96GMnsCYX1oHM2fJoD7QMZqWT7TDLc6mq8soGJKVDggs");

#[program]
pub mod prediction_market_solana_anchor {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        market_id: u64,
        question: String,
        end_time: i64,
        fee_bps: u16,
    ) -> Result<()> {
        instructions::initialize_market::initialize_market(
            ctx, market_id, question, end_time, fee_bps,
        )
    }

    pub fn claim_amm_winnings(ctx: Context<ClaimAmmWinnings>) -> Result<()> {
        instructions::claim_amm_winnings::claim_amm_winnings(ctx)
    }

    pub fn resolve_market(ctx: Context<ResolveMarket>, outcome: Outcome) -> Result<()> {
        instructions::resolve_market::resolve_market(ctx, outcome)
    }

    pub fn cancel_market(ctx: Context<CancelMarket>) -> Result<()> {
        instructions::cancel_market::cancel_market(ctx)
    }

    pub fn initialize_amm(ctx: Context<InitializeAmm>, fee_bps: u16) -> Result<()> {
        instructions::initialize_amm::initialize_amm(ctx, fee_bps)
    }

    pub fn initialize_amm_vaults(ctx: Context<InitializeAmmVaults>) -> Result<()> {
        instructions::initialize_amm_vaults::initialize_amm_vaults(ctx)
    }

    pub fn mint_complete_set(ctx: Context<MintCompleteSet>, amount: u64) -> Result<()> {
        instructions::mint_complete_set::mint_complete_set(ctx, amount)
    }

    pub fn redeem_complete_set(ctx: Context<RedeemCompleteSet>, amount: u64) -> Result<()> {
        instructions::redeem_complete_set::redeem_complete_set(ctx, amount)
    }

    pub fn add_liquidity(ctx: Context<AddLiquidity>, payment_amount: u64) -> Result<()> {
        instructions::add_liquidity::add_liquidity(ctx, payment_amount)
    }

    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        min_amount_out: u64,
        direction: SwapDirection,
    ) -> Result<()> {
        instructions::swap::swap(ctx, amount_in, min_amount_out, direction)
    }

    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, shares: u64) -> Result<()> {
        instructions::remove_liquidity::remove_liquidity(ctx, shares)
    }
}
