use anchor_lang::prelude::*;
use anchor_spl::token::{burn, transfer, Burn, Mint, Token, TokenAccount, Transfer};

use crate::{AmmPool, Market, Outcome, PredictionMarketError};

#[derive(Accounts)]
pub struct ReedemClompleteSet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"market",market.authority.as_ref(),&market.market_id.to_le_bytes()],bump=market.bump)]
    pub market: Account<'info, Market>,

    #[account(seeds=[b"amm",market.key().as_ref()],bump=amm.bump, constraint = amm.market==market.key() @PredictionMarketError::InvalidMarket)]
    pub amm: Account<'info, AmmPool>,

    ///CHECK : PDA used only as authority for the outcome mints
    #[account(seeds = [b"outcome-authority",market.key().as_ref()],bump)]
    pub outcome_authority: UncheckedAccount<'info>,

    ///CHECK : PDA used only as authority for the amm
    #[account(seeds = [b"amm-authority",market.key().as_ref()],bump)]
    pub amm_authority: UncheckedAccount<'info>,

    #[account(mut,address = amm.payment_vault,
        constraint = payment_vault.mint==market.payment_mint @PredictionMarketError::InvalidMint,
        constraint = payment_vault.owner==amm_authority.key() @PredictionMarketError::Unauthorized)]
    pub payment_vault: Account<'info, TokenAccount>,

    #[account(mut, address=amm.yes_mint)]
    pub yes_mint: Account<'info, Mint>,

    #[account(mut, address=amm.no_mint)]
    pub no_mint: Account<'info, Mint>,

    #[account(mut, constraint = user_yes_account.owner==user.key() @PredictionMarketError::Unauthorized, constraint = user_yes_account.mint==yes_mint.key() @PredictionMarketError::InvalidMint)]
    pub user_yes_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = user_no_account.owner==user.key() @PredictionMarketError::Unauthorized, constraint = user_no_account.mint==no_mint.key() @PredictionMarketError::InvalidMint)]
    pub user_no_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = user_payment_account.owner==user.key() @PredictionMarketError::Unauthorized, constraint = user_payment_account.mint==market.payment_mint @PredictionMarketError::InvalidMint)]
    pub user_payment_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn redeem_complete_set(ctx: Context<ReedemClompleteSet>, amount: u64) -> Result<()> {
    require!(amount > 0, PredictionMarketError::InvalidAmount);

    let market = &ctx.accounts.market;

    require!(
        market.outcome == Outcome::Unresolved,
        PredictionMarketError::MarketAlreadyResolved
    );

    let now = Clock::get()?.unix_timestamp;

    require!(now < market.end_time, PredictionMarketError::MarketClosed);

    require!(
        ctx.accounts.user_yes_account.amount >= amount,
        PredictionMarketError::InsufficientBalance
    );

    require!(
        ctx.accounts.user_no_account.amount >= amount,
        PredictionMarketError::InsufficientBalance
    );

    let yes_burn_accounts = Burn {
        mint: ctx.accounts.yes_mint.to_account_info(),
        from: ctx.accounts.user_yes_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };

    let yes_burn_ctx = CpiContext::new(ctx.accounts.token_program.key(), yes_burn_accounts);

    burn(yes_burn_ctx, amount);

    let no_burn_accounts = Burn {
        mint: ctx.accounts.no_mint.to_account_info(),
        from: ctx.accounts.user_no_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };

    let no_burn_ctx = CpiContext::new(ctx.accounts.token_program.key(), no_burn_accounts);
    burn(no_burn_ctx, amount);

    let market_key = market.key();
    let amm_bump = [ctx.bumps.amm_authority];

    let amm_signer_seeds: &[&[u8]] = &[b"amm-authority", market_key.as_ref(), &amm_bump];

    let signer_seeds = &[amm_signer_seeds];

    require!(ctx.accounts.payment_vault.amount >= amount, PredictionMarketError::InsufficientVaultFunds);

    let transfer_accounts = Transfer{
        from : ctx.accounts.payment_vault.to_account_info(),
        to : ctx.accounts.user_payment_account.to_account_info(),
        authority : ctx.accounts.amm_authority.to_account_info(),
    };

    let transfer_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.key(), transfer_accounts, signer_seeds);
    transfer(transfer_ctx, amount)?;
    Ok(())
}
