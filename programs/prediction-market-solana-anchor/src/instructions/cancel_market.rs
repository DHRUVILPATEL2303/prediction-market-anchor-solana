use anchor_lang::prelude::*;

use crate::{Market, MarketCancelled, Outcome, PredictionMarketError};

#[derive(Accounts)]
pub struct CancelMarket<'info> {
    #[account(
        mut,
        seeds = [
            b"market",
            authority.key().as_ref(),
            &market.market_id.to_le_bytes()
        ],
        bump = market.bump,
        has_one = authority @ PredictionMarketError::Unauthorized
    )]
    pub market: Account<'info, Market>,

    pub authority: Signer<'info>,
}



pub fn cancel_market(ctx: Context<CancelMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;

    require!(
        market.outcome == Outcome::Unresolved,
        PredictionMarketError::MarketAlreadyResolved
    );

    market.outcome = Outcome::Cancelled;

    emit!(MarketCancelled {
        market: market.key(),
        authority: ctx.accounts.authority.key(),
    });

    Ok(())
}