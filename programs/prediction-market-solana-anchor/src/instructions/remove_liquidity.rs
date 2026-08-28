use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};

use crate::{AmmPool, LpPosition, Market, Outcome, PredictionMarketError};

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,

    #[account(
        seeds = [
            b"market",
            market.authority.as_ref(),
            &market.market_id.to_le_bytes()
        ],
        bump = market.bump
    )]
    pub market: Box<Account<'info, Market>>,

    #[account(
        mut,
        seeds = [
            b"amm",
            market.key().as_ref()
        ],
        bump = amm.bump,
        constraint = amm.market == market.key()
            @ PredictionMarketError::InvalidMarket
    )]
    pub amm: Box<Account<'info, AmmPool>>,

    /// CHECK: PDA used only as AMM vault authority.
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
        address = amm.yes_vault,
        constraint = yes_vault.owner == amm_authority.key()
            @ PredictionMarketError::Unauthorized,
        constraint = yes_vault.mint == amm.yes_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub yes_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        address = amm.no_vault,
        constraint = no_vault.owner == amm_authority.key()
            @ PredictionMarketError::Unauthorized,
        constraint = no_vault.mint == amm.no_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub no_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = provider_yes_account.owner == provider.key()
            @ PredictionMarketError::Unauthorized,
        constraint = provider_yes_account.mint == amm.yes_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub provider_yes_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = provider_no_account.owner == provider.key()
            @ PredictionMarketError::Unauthorized,
        constraint = provider_no_account.mint == amm.no_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub provider_no_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [
            b"lp-position",
            provider.key().as_ref(),
            amm.key().as_ref()
        ],
        bump = lp_position.bump,
        constraint = lp_position.owner == provider.key()
            @ PredictionMarketError::Unauthorized,
        constraint = lp_position.amm == amm.key()
            @ PredictionMarketError::InvalidMarket
    )]
    pub lp_position: Box<Account<'info, LpPosition>>,

    pub token_program: Program<'info, Token>,
}

pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, shares: u64) -> Result<()> {
    require!(shares > 0, PredictionMarketError::InvalidAmount);

    let market = &ctx.accounts.market;
    let amm = &mut ctx.accounts.amm;
    let lp_position = &mut ctx.accounts.lp_position;

    require!(
        market.outcome == Outcome::Unresolved,
        PredictionMarketError::MarketAlreadyResolved
    );

    let now = Clock::get()?.unix_timestamp;

    require!(now < market.end_time, PredictionMarketError::MarketClosed);

    require!(amm.lp_supply > 0, PredictionMarketError::InvalidLiquidity);

    require!(
        shares <= lp_position.shares,
        PredictionMarketError::InsufficientLpShares
    );

    let yes_reserve = ctx.accounts.yes_vault.amount;
    let no_reserve = ctx.accounts.no_vault.amount;

    let yes_out = yes_reserve
        .checked_mul(shares)
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_div(amm.lp_supply)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let no_out = no_reserve
        .checked_mul(shares)
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_div(amm.lp_supply)
        .ok_or(PredictionMarketError::MathOverflow)?;

    require!(
        yes_out > 0 || no_out > 0,
        PredictionMarketError::InvalidAmount
    );

    let market_key = market.key();
    let authority_bump = [ctx.bumps.amm_authority];

    let authority_seeds: &[&[u8]] = &[b"amm-authority", market_key.as_ref(), &authority_bump];

    let signer_seeds: &[&[&[u8]]] = &[authority_seeds];

    if yes_out > 0 {
        let accounts = Transfer {
            from: ctx.accounts.yes_vault.to_account_info(),
            to: ctx.accounts.provider_yes_account.to_account_info(),
            authority: ctx.accounts.amm_authority.to_account_info(),
        };

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().key(),
            accounts,
            signer_seeds,
        );

        transfer(transfer_ctx, yes_out)?;
    }

    if no_out > 0 {
        let accounts = Transfer {
            from: ctx.accounts.no_vault.to_account_info(),
            to: ctx.accounts.provider_no_account.to_account_info(),
            authority: ctx.accounts.amm_authority.to_account_info(),
        };

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().key(),
            accounts,
            signer_seeds,
        );

        transfer(transfer_ctx, no_out)?;
    }

    amm.lp_supply = amm
        .lp_supply
        .checked_sub(shares)
        .ok_or(PredictionMarketError::MathOverflow)?;

    amm.yes_reserve = yes_reserve
        .checked_sub(yes_out)
        .ok_or(PredictionMarketError::MathOverflow)?;

    amm.no_reserve = no_reserve
        .checked_sub(no_out)
        .ok_or(PredictionMarketError::MathOverflow)?;

    lp_position.shares = lp_position
        .shares
        .checked_sub(shares)
        .ok_or(PredictionMarketError::MathOverflow)?;

    Ok(())
}
