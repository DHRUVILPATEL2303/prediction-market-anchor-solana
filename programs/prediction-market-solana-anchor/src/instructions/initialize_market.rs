use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    error::PredictionMarketError,
    state::{Market, Outcome},
    MarketCreated,
};

#[derive(Accounts)]
#[instruction(market_id : u64)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(init,payer=owner,space=8 + Market::INIT_SPACE,seeds=[b"market",owner.key().as_ref(),&market_id.to_le_bytes()],bump)]
    pub market: Account<'info, Market>,

    /// CHECK :
    /// PDA AUTHORITY FOR VAULT . NO DATA IS STORED.
    #[account(seeds=[b"vault-authority",market.key().as_ref()],bump)]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer=owner,
        token::mint=payment_mint,
        token::authority=vault_authority,
        seeds=[b"vault", market.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    pub payment_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub treasury: SystemAccount<'info>,
}

pub fn initialize_market(
    ctx: Context<InitializeMarket>,
    market_id: u64,
    question: String,
    end_time: i64,
    fee_bps: u16,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(end_time > now, PredictionMarketError::InValidEndTime);

    require!(fee_bps <= 1000, PredictionMarketError::InValidFeeBps);

    require!(
        !question.trim().is_empty(),
        PredictionMarketError::InValidQuestion
    );

    require!(
        question.len() <= 128,
        PredictionMarketError::QuestionIsTooLong
    );

    let market = &mut ctx.accounts.market;
    let authority = &mut ctx.accounts.owner;
    market.authority = authority.key();
    market.market_id = market_id;
    market.question = question;
    market.end_time = end_time;
    market.fee_bps = fee_bps;
    market.treasury = ctx.accounts.treasury.key();
    market.bump = ctx.bumps.market;
    market.vault_bump = ctx.bumps.vault;
    market.total_no = 0;
    market.total_yes = 0;
    market.payment_mint = ctx.accounts.payment_mint.key();
    market.outcome = Outcome::Unresolved;

    emit!(MarketCreated {
        market: market.key(),
        authority: market.authority,
        market_id: market.market_id,
        question: market.question.clone(),
        end_time: market.end_time,
        fee_bps: market.fee_bps,
    });
    Ok(())
}
