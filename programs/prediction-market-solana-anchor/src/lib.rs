pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod events;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;
pub use events::*;
declare_id!("4wgX7snLPQYehm7HtbPHswyTfoc4uRFFpWDVSNQyvX7B");

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
}

