use crate::error::PredictionMarketError::InvalidAmount;
use crate::state::{Market, Position, Side};
use crate::{Outcome, PredictionMarketError};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + Position::INIT_SPACE,
        seeds = [
            b"position",
            buyer.key().as_ref(),
            market.key().as_ref(),
        ],
        bump
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        token::authority = buyer,
        token::mint = payment_mint,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [
            b"vault",
            market.key().as_ref()
        ],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    pub payment_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
}

pub fn buy(ctx: Context<Buy>, side: Side, amount: u64) -> Result<()> {
    require!(amount > 0, PredictionMarketError::InvalidAmount);


    let market =&mut ctx.accounts.market;

    require!(
          market.outcome == Outcome::Unresolved,
          PredictionMarketError::MarketAlreadyResolved
      );
    let now = Clock::get()?.unix_timestamp;

    require!(now < market.end_time, PredictionMarketError::MarketAlreadyResolved);



    
    Ok(())
}
