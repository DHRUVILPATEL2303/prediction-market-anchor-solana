pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use state::*;
declare_id!("96GMnsCYX1oHM2fJoD7QMZqWT7TDLc6mq8soGJKVDggs");

#[program]
pub mod prediction_market_solana_anchor {
    use super::*;

    pub fn initialize_market_anchor(
        ctx: Context<InitializeMarket>,
        market_id: u64,
        question: String,
        end_time: i64,
        fee_bps: u16,
    ) -> Result<()> {
        initialize_market(ctx, market_id, question, end_time, fee_bps)?;
        Ok(())
    }

    pub fn buy_anchor(ctx: Context<Buy>, side: Side, amount: u64) -> Result<()> {
        buy(ctx, side, amount)?;
        Ok(())
    }

    pub fn resolve_market_anchor(ctx: Context<ResolveMarket>, outcome: Outcome) -> Result<()> {
        resolve_market(ctx, outcome)?;
        Ok(())
    }

    pub fn claim_anchor(ctx: Context<Claim>) -> Result<()> {
        claim_winnings(ctx)?;
        Ok(())
    }

    pub fn cancel_market_anchor(ctx: Context<CancelMarket>) -> Result<()> {
        cancel_market(ctx)?;
        Ok(())
    }

    pub fn refund_anchor(ctx: Context<Refund>) -> Result<()> {
        refund(ctx)?;
        Ok(())
    }
}
