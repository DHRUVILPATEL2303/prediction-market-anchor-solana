use anchor_lang::prelude::*;
use anchor_spl::token::transfer;
use anchor_spl::token::{mint_to, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::{Market, Outcome, PredictionMarketError};

#[derive(Accounts)]
pub struct MintCompleteSet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"market",
            market.authority.as_ref(),
            &market.market_id.to_le_bytes()
        ],
        bump = market.bump
    )]
    pub market: Box<Account<'info, Market>>,

    /// CHECK: PDA used as the mint authority for YES/NO outcome mints.
    #[account(
        seeds = [
            b"outcome-authority",
            market.key().as_ref()
        ],
        bump
    )]
    pub outcome_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            b"payment-vault",
            market.key().as_ref()
        ],
        bump,
        constraint = payment_vault.mint == market.payment_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub payment_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_payment_account.owner == user.key()
            @ PredictionMarketError::Unauthorized,
        constraint = user_payment_account.mint == market.payment_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub user_payment_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [
            b"yes-mint",
            market.key().as_ref()
        ],
        bump
    )]
    pub yes_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [
            b"no-mint",
            market.key().as_ref()
        ],
        bump
    )]
    pub no_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = user_yes_account.owner == user.key()
            @ PredictionMarketError::Unauthorized,
        constraint = user_yes_account.mint == yes_mint.key()
            @ PredictionMarketError::InvalidMint
    )]
    pub user_yes_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_no_account.owner == user.key()
            @ PredictionMarketError::Unauthorized,
        constraint = user_no_account.mint == no_mint.key()
            @ PredictionMarketError::InvalidMint
    )]
    pub user_no_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn mint_complete_set(ctx: Context<MintCompleteSet>, amount: u64) -> Result<()> {
    require!(amount > 0, PredictionMarketError::InvalidAmount);

    let market = &mut ctx.accounts.market;

    require!(
        market.outcome == Outcome::Unresolved,
        PredictionMarketError::MarketAlreadyResolved
    );

    let now = Clock::get()?.unix_timestamp;

    require!(now < market.end_time, PredictionMarketError::MarketClosed);

    let transfer_account = Transfer {
        from: ctx.accounts.user_payment_account.to_account_info(),
        to: ctx.accounts.payment_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };

    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info().key(),
        transfer_account,
    );

    transfer(transfer_ctx, amount)?;

    let market_key = market.key();
    let outcome_bump = [ctx.bumps.outcome_authority];
    let outcome_signer_seeds: &[&[u8]] =
        &[b"outcome-authority", market_key.as_ref(), &outcome_bump];

    let outcome_signer: &[&[&[u8]]] = &[outcome_signer_seeds];

    let yes_mint_accounts = MintTo {
        mint: ctx.accounts.yes_mint.to_account_info(),
        to: ctx.accounts.user_yes_account.to_account_info(),
        authority: ctx.accounts.outcome_authority.to_account_info(),
    };

    let yes_mint_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().key(),
        yes_mint_accounts,
        outcome_signer,
    );

    mint_to(yes_mint_ctx, amount)?;

    let no_mint_accounts = MintTo {
        mint: ctx.accounts.no_mint.to_account_info(),
        to: ctx.accounts.user_no_account.to_account_info(),
        authority: ctx.accounts.outcome_authority.to_account_info(),
    };

    let no_mint_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().key(),
        no_mint_accounts,
        outcome_signer,
    );

    mint_to(no_mint_ctx, amount)?;

    market.total_yes = market
        .total_yes
        .checked_add(amount)
        .ok_or(PredictionMarketError::MathOverflow)?;
    market.total_no = market
        .total_no
        .checked_add(amount)
        .ok_or(PredictionMarketError::MathOverflow)?;
    market.total_amount = market
        .total_amount
        .checked_add(amount)
        .ok_or(PredictionMarketError::MathOverflow)?;

    Ok(())
}
