use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use anchor_spl::token::transfer;
use crate::{Market, Outcome, Position, PredictionMarketError, RefundIssued};

#[derive(Accounts)]
pub struct Refund<'info> {
    pub refunder: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut,
        seeds =[b"position",refunder.key().as_ref(),market.key().as_ref()],
        bump = position.bump,
        constraint = position.owner==refunder.key() @PredictionMarketError::InvalidPosition ,
        constraint = position.market==market.key() @PredictionMarketError::InvalidPosition,
    )]
    pub position: Account<'info, Position>,



    /// CHECK: PDA authority for the vault. No data is read from this account.
    /// Its address is cryptographically verified by the seeds constraint below.
    #[account(seeds = [b"vault-authority",market.key().as_ref()],
        bump)]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"vault",market.key().as_ref()],
        bump = market.vault_bump,
        constraint = vault.owner==vault_authority.key() @PredictionMarketError::Unauthorized,
        constraint = vault.mint==market.payment_mint @PredictionMarketError::InvalidMint,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        constraint = payment_mint.key() == market.payment_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub payment_mint: Account<'info, Mint>,

    #[account(
          mut,
          token::authority = refunder,
          token::mint = payment_mint
      )]
    pub refunder_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}


pub fn refund(ctx: Context<Refund>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    require!(
        market.outcome == Outcome::Cancelled,
        PredictionMarketError::MarketNotCancelled
    );

    require!(
        !position.claimed,
        PredictionMarketError::AlreadyClaimed
    );

    require!(
        !position.refunded,
        PredictionMarketError::AlreadyRefunded
    );

    let refund_amount = position
        .yes_shares
        .checked_add(position.no_shares)
        .ok_or(PredictionMarketError::MathOverflow)?;

    require!(
        refund_amount > 0,
        PredictionMarketError::NoRefundAvailable
    );

    require!(
        ctx.accounts.vault.amount >= refund_amount,
        PredictionMarketError::InsufficientVaultFunds
    );

    let market_key = market.key();
    let vault_authority_bump = [ctx.bumps.vault_authority];

    let signer_seeds: &[&[u8]] = &[
        b"vault-authority",
        market_key.as_ref(),
        &vault_authority_bump,
    ];

    let signer = &[signer_seeds];

    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.refunder_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().key(),
        cpi_accounts,
        signer,
    );

    transfer(cpi_ctx, refund_amount)?;

    position.refunded = true;

    emit!(RefundIssued {
        refunder: ctx.accounts.refunder.key(),
        market: market.key(),
        amount: refund_amount,
    });

    Ok(())
}
