use anchor_lang::prelude::*;
use anchor_spl::token::transfer;
use anchor_spl::token::{mint_to, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::{AmmPool, Market, Outcome, PredictionMarketError};

#[derive(Accounts)]
pub struct MintCompleteSet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"market", market.authority.as_ref(), &market.market_id.to_le_bytes()],bump=market.bump)]
    pub market: Account<'info, Market>,

    #[account(seeds=[b"amm",market.key().as_ref()],bump=amm.bump, constraint = amm.market==market.key() @PredictionMarketError::InvalidMarket)]
    pub amm: Account<'info, AmmPool>,

    /// CHECK: PDA used only as authority of YES/NO token mints.
    #[account(
        seeds = [
            b"outcome-authority",
            market.key().as_ref()
        ],
        bump
    )]
    pub outcome_authority: UncheckedAccount<'info>,

    /// CHECK: PDA used only as authority of AMM token vaults.
    #[account(
        seeds = [
            b"amm-authority",
            market.key().as_ref()
        ],
        bump
    )]
    pub amm_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        address = amm.payment_vault,
        constraint = payment_vault.owner == amm_authority.key()
            @ PredictionMarketError::Unauthorized,
        constraint = payment_vault.mint == market.payment_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub payment_vault: Account<'info, TokenAccount>,

    #[account(mut, constraint = user_payment_account.mint==market.payment_mint @PredictionMarketError::InvalidMint, constraint = user_payment_account.owner==user.key() @PredictionMarketError::Unauthorized)]
    pub user_payment_account: Account<'info, TokenAccount>,

    #[account(mut, address = amm.yes_mint)]
    pub yes_mint: Account<'info, Mint>,

    #[account(mut, address = amm.no_mint)]
    pub no_mint: Account<'info, Mint>,

    #[account(init_if_needed, payer=user, token::mint=yes_mint, token::authority=user)]
    pub user_yes_account: Account<'info, TokenAccount>,

    #[account(init_if_needed, payer=user, token::mint=no_mint, token::authority=user)]
    pub user_no_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn mint_complete_set(ctx: Context<MintCompleteSet>, amount: u64) -> Result<()> {
    require!(amount > 0, PredictionMarketError::InvalidAmount);

    let market = &ctx.accounts.market;

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

    Ok(())
}
