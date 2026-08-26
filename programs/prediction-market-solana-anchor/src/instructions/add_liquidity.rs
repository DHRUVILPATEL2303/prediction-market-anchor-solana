use crate::{AmmPool, Market, Outcome, PredictionMarketError};
use anchor_lang::prelude::*;
use anchor_spl::token::transfer;
use anchor_spl::token::{Token, TokenAccount, Transfer};


#[derive(Accounts)]
pub struct AddLiquidity<'info> {
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
        seeds = [b"amm", market.key().as_ref()],
        bump = amm.bump,
        constraint = amm.market == market.key()
            @ PredictionMarketError::InvalidMarket
    )]
    pub amm: Box<Account<'info, AmmPool>>,

    /// CHECK: PDA used only as AMM vault authority.
    #[account(
        seeds = [b"amm-authority", market.key().as_ref()],
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
    pub payment_vault: Box<Account<'info, TokenAccount>>,

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
        constraint = provider_payment_account.owner == provider.key()
            @ PredictionMarketError::Unauthorized,
        constraint = provider_payment_account.mint == market.payment_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub provider_payment_account: Box<Account<'info, TokenAccount>>,

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

    pub token_program: Program<'info, Token>,
}

pub fn add_liquidity(
    ctx: Context<AddLiquidity>,
    payment_amount: u64,
    yes_amount: u64,
    no_amount: u64,
) -> Result<()> {
    require!(payment_amount > 0, PredictionMarketError::InvalidAmount);

    require!(yes_amount > 0, PredictionMarketError::InvalidAmount);

    require!(no_amount > 0, PredictionMarketError::InvalidAmount);

    let market = &ctx.accounts.market;

    require!(
        market.outcome == Outcome::Unresolved,
        PredictionMarketError::MarketAlreadyResolved
    );

    let now = Clock::get()?.unix_timestamp;

    require!(now < market.end_time, PredictionMarketError::MarketClosed);

    let amm = &mut ctx.accounts.amm;

    let old_yes = ctx.accounts.yes_vault.amount;
    let old_no = ctx.accounts.no_vault.amount;

    if amm.lp_supply == 0 {
        let lp_supply = integer_sqrt(
            yes_amount
                .checked_mul(no_amount)
                .ok_or(PredictionMarketError::MathOverflow)?,
        );

        require!(lp_supply > 0, PredictionMarketError::InvalidAmount);

        amm.lp_supply = lp_supply;
    } else {
        require!(
            old_yes > 0 && old_no > 0,
            PredictionMarketError::InvalidLiquidity
        );

        require!(
            yes_amount
                .checked_mul(old_no)
                .ok_or(PredictionMarketError::MathOverflow)?
                == no_amount
                    .checked_mul(old_yes)
                    .ok_or(PredictionMarketError::MathOverflow)?,
            PredictionMarketError::InvalidLiquidityRatio
        );

        let lp_from_yes = yes_amount
            .checked_mul(amm.lp_supply)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(old_yes)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let lp_from_no = no_amount
            .checked_mul(amm.lp_supply)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(old_no)
            .ok_or(PredictionMarketError::MathOverflow)?;

        require!(
            lp_from_yes == lp_from_no,
            PredictionMarketError::InvalidLiquidityRatio
        );

        require!(lp_from_yes > 0, PredictionMarketError::InvalidAmount);

        amm.lp_supply = amm
            .lp_supply
            .checked_add(lp_from_yes)
            .ok_or(PredictionMarketError::MathOverflow)?;
    }

    let payment_transfer = Transfer {
        from: ctx.accounts.provider_payment_account.to_account_info(),
        to: ctx.accounts.payment_vault.to_account_info(),
        authority: ctx.accounts.provider.to_account_info(),
    };

    let payment_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info().key(),
        payment_transfer,
    );

    transfer(payment_ctx, payment_amount)?;

    let yes_transfer = Transfer {
        from: ctx.accounts.provider_yes_account.to_account_info(),
        to: ctx.accounts.yes_vault.to_account_info(),
        authority: ctx.accounts.provider.to_account_info(),
    };

    let yes_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info().key(),
        yes_transfer,
    );

    transfer(yes_ctx, yes_amount)?;

    let no_transfer = Transfer {
        from: ctx.accounts.provider_no_account.to_account_info(),
        to: ctx.accounts.no_vault.to_account_info(),
        authority: ctx.accounts.provider.to_account_info(),
    };

    let no_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info().key(),
        no_transfer,
    );

    transfer(no_ctx, no_amount)?;

    amm.yes_reserve = old_yes
        .checked_add(yes_amount)
        .ok_or(PredictionMarketError::MathOverflow)?;

    amm.no_reserve = old_no
        .checked_add(no_amount)
        .ok_or(PredictionMarketError::MathOverflow)?;

    Ok(())
}

fn integer_sqrt(value: u64) -> u64 {
    if value == 0 {
        return 0;
    }

    let mut x = value;
    let mut y = (x + 1) / 2;

    while y < x {
        x = y;
        y = (x + value / x) / 2;
    }

    x
}
