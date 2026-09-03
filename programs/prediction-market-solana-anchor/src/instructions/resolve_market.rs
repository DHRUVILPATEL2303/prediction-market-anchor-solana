use anchor_lang::prelude::*;

use crate::{Market, MarketResolved, Outcome, PredictionMarketError};

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
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

pub fn resolve_market(ctx: Context<ResolveMarket>, outcome: Outcome) -> Result<()> {
    let market = &mut ctx.accounts.market;

    require!(
        market.outcome == Outcome::Unresolved,
        PredictionMarketError::MarketAlreadyResolved
    );

    let now = Clock::get()?.unix_timestamp;

    require!(
        now >= market.end_time,
        PredictionMarketError::MarketNotEnded
    );

    match outcome {
        Outcome::Yes | Outcome::No => {}
        Outcome::Unresolved | Outcome::Cancelled => {
            return err!(PredictionMarketError::InvalidOutcome);
        }
    }

    market.outcome = outcome;

    emit!(MarketResolved {
        market: market.key(),
        authority: ctx.accounts.authority.key(),
        outcome,
    });

    Ok(())
}
