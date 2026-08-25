use crate::error::PredictionMarketError::InvalidAmount;
use crate::state::{Market, Position, Side};
use crate::{Outcome, PredictionMarketError, SharesPurchased};
use anchor_lang::prelude::*;
use anchor_spl::token::transfer;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};

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
        bump,
        constraint = vault.mint == market.payment_mint
            @ PredictionMarketError::InvalidMint,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(constraint = payment_mint.key()==market.payment_mint @ PredictionMarketError::InvalidMint)]
    pub payment_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
}

pub fn buy(ctx: Context<Buy>, side: Side, amount: u64) -> Result<()> {
    require!(amount > 0, PredictionMarketError::InvalidAmount);

    let market = &mut ctx.accounts.market;

    require!(
        market.outcome == Outcome::Unresolved,
        PredictionMarketError::MarketAlreadyResolved
    );

    let now = Clock::get()?.unix_timestamp;

    require!(now < market.end_time, PredictionMarketError::MarketClosed);

    let cpi_accounts = Transfer {
        from: ctx.accounts.buyer_token_account.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.buyer.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info().key(),
        cpi_accounts,
    );

    transfer(cpi_ctx, amount)?;

    let position = &mut ctx.accounts.position;

    require!(
        position.owner == Pubkey::default() || position.owner == ctx.accounts.buyer.key(),
        PredictionMarketError::InvalidPosition
    );

    require!(
        position.market == Pubkey::default() || position.market == market.key(),
        PredictionMarketError::InvalidPosition
    );

    if position.owner == Pubkey::default() {
        position.owner = ctx.accounts.buyer.key();
        position.market = market.key();
        position.yes_shares = 0;
        position.no_shares = 0;
        position.claimed = false;
        position.refunded = false;
        position.bump = ctx.bumps.position;
    }

    match side {
        Side::Yes => {
            position.yes_shares = position
                .yes_shares
                .checked_add(amount)
                .ok_or(PredictionMarketError::MathOverflow)?;

            market.total_yes = market
                .total_yes
                .checked_add(amount)
                .ok_or(PredictionMarketError::MathOverflow)?;
        }

        Side::No => {
            position.no_shares = position
                .no_shares
                .checked_add(amount)
                .ok_or(PredictionMarketError::MathOverflow)?;

            market.total_no = market
                .total_no
                .checked_add(amount)
                .ok_or(PredictionMarketError::MathOverflow)?;
        }
    }

    market.total_amount = market
        .total_amount
        .checked_add(amount)
        .ok_or(PredictionMarketError::MathOverflow)?;

    emit!(SharesPurchased {
        buyer: ctx.accounts.buyer.key(),
        market: market.key(),
        side,
        amount,
    });

    Ok(())
}
