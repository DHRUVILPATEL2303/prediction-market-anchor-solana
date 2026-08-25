use crate::{Market, Outcome, Position, PredictionMarketError, WinningsClaimed};

use anchor_lang::prelude::*;

use anchor_spl::token::transfer;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [
            b"position",
            claimer.key().as_ref(),
            market.key().as_ref()
        ],
        bump = position.bump,
        constraint = position.owner == claimer.key()
            @ PredictionMarketError::InvalidPosition,
        constraint = position.market == market.key()
            @ PredictionMarketError::InvalidPosition
    )]
    pub position: Account<'info, Position>,

    /// CHECK: PDA authority for the vault.
    #[account(
        seeds = [
            b"vault-authority",
            market.key().as_ref()
        ],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            b"vault",
            market.key().as_ref()
        ],
        bump = market.vault_bump,
        constraint = vault.mint == market.payment_mint
            @ PredictionMarketError::InvalidMint,
        constraint = vault.owner == vault_authority.key()
            @ PredictionMarketError::Unauthorized
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        constraint = payment_mint.key() == market.payment_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub payment_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::authority = claimer,
        token::mint = payment_mint
    )]
    pub claimer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = payment_mint,
        token::authority = market.treasury
    )]
    pub tresury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn claim_winnings(ctx: Context<Claim>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    require!(
        market.outcome == Outcome::Yes || market.outcome == Outcome::No,
        PredictionMarketError::MarketNotResolved
    );

    require!(!position.claimed, PredictionMarketError::AlreadyClaimed);

    require!(!position.refunded, PredictionMarketError::AlreadyRefunded);

    let winning_shares = match market.outcome {
        Outcome::Yes => position.yes_shares,
        Outcome::No => position.no_shares,
        Outcome::Unresolved | Outcome::Cancelled => 0,
    };

    require!(winning_shares > 0, PredictionMarketError::NoWinningShares);

    let total_winning_shares = match market.outcome {
        Outcome::Yes => market.total_yes,
        Outcome::No => market.total_no,
        Outcome::Unresolved | Outcome::Cancelled => 0,
    };

    require!(
        total_winning_shares > 0,
        PredictionMarketError::NoWinningShares
    );

    let total_pool = market.total_amount;

    let gross_payout = winning_shares
        .checked_mul(total_pool)
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_div(total_winning_shares)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let fee = gross_payout
        .checked_mul(market.fee_bps as u64)
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let user_payout = gross_payout
        .checked_sub(fee)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let total_required = user_payout
        .checked_add(fee)
        .ok_or(PredictionMarketError::MathOverflow)?;

    require!(
        ctx.accounts.vault.amount >= total_required,
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

    if user_payout > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.claimer_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().key(),
            cpi_accounts,
            signer,
        );

        transfer(cpi_ctx, user_payout)?;
    }

    if fee > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.tresury_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().key(),
            cpi_accounts,
            signer,
        );

        transfer(cpi_ctx, fee)?;
    }

    position.claimed = true;
    position.refunded = false;

    emit!(WinningsClaimed {
        claimer: ctx.accounts.claimer.key(),
        market: market.key(),
        shares: winning_shares,
        fee,
        payout: user_payout,
    });

    Ok(())
}
