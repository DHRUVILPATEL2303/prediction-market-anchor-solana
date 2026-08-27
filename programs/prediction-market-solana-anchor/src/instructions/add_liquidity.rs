use anchor_lang::prelude::*;
use anchor_spl::token::{mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::{AmmPool, LpPosition, Market, Outcome, PredictionMarketError};

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

    /// CHECK: PDA used only as authority for YES/NO minting.
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
        address = amm.payment_vault,
        constraint = payment_vault.owner == amm_authority.key()
            @ PredictionMarketError::Unauthorized,
        constraint = payment_vault.mint == market.payment_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub payment_vault: Box<Account<'info, TokenAccount>>,

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
        address = amm.yes_mint
    )]
    pub yes_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        address = amm.no_mint
    )]
    pub no_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        address = amm.yes_vault,
        constraint = yes_vault.owner == amm_authority.key()
            @ PredictionMarketError::Unauthorized,
        constraint = yes_vault.mint == yes_mint.key()
            @ PredictionMarketError::InvalidMint
    )]
    pub yes_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        address = amm.no_vault,
        constraint = no_vault.owner == amm_authority.key()
            @ PredictionMarketError::Unauthorized,
        constraint = no_vault.mint == no_mint.key()
            @ PredictionMarketError::InvalidMint
    )]
    pub no_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = provider,
        space = 8 + LpPosition::INIT_SPACE,
        seeds = [
            b"lp-position",
            provider.key().as_ref(),
            amm.key().as_ref()
        ],
        bump
    )]
    pub lp_position: Box<Account<'info, LpPosition>>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
}

pub fn add_liquidity(ctx: Context<AddLiquidity>, payment_amount: u64) -> Result<()> {
    require!(payment_amount > 0, PredictionMarketError::InvalidAmount);

    let market = &ctx.accounts.market;

    require!(
        market.outcome == Outcome::Unresolved,
        PredictionMarketError::MarketAlreadyResolved
    );

    let now = Clock::get()?.unix_timestamp;

    require!(now < market.end_time, PredictionMarketError::MarketClosed);

    let amm = &mut ctx.accounts.amm;

    let lp_position = &mut ctx.accounts.lp_position;

    if lp_position.owner == Pubkey::default() {
        lp_position.owner = ctx.accounts.provider.key();
        lp_position.amm = amm.key();
        lp_position.shares = 0;
        lp_position.bump = ctx.bumps.lp_position;
    } else {
        require!(
            lp_position.owner == ctx.accounts.provider.key(),
            PredictionMarketError::Unauthorized
        );

        require!(
            lp_position.amm == amm.key(),
            PredictionMarketError::InvalidMarket
        );
    }

    let yes_amount = payment_amount;
    let no_amount = payment_amount;

    let old_yes = ctx.accounts.yes_vault.amount;
    let old_no = ctx.accounts.no_vault.amount;

    let minted_lp = if amm.lp_supply == 0 {
        payment_amount
    } else {
        require!(
            old_yes > 0 && old_no > 0,
            PredictionMarketError::InvalidLiquidity
        );

        require!(
            old_yes == old_no,
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

        lp_from_yes
    };

    require!(minted_lp > 0, PredictionMarketError::InvalidAmount);

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

    let market_key = market.key();

    let outcome_bump = [ctx.bumps.outcome_authority];

    let outcome_signer_seeds: &[&[u8]] =
        &[b"outcome-authority", market_key.as_ref(), &outcome_bump];

    let outcome_signer: &[&[&[u8]]] = &[outcome_signer_seeds];

    let yes_mint_accounts = MintTo {
        mint: ctx.accounts.yes_mint.to_account_info(),
        to: ctx.accounts.yes_vault.to_account_info(),
        authority: ctx.accounts.outcome_authority.to_account_info(),
    };

    let yes_mint_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().key(),
        yes_mint_accounts,
        outcome_signer,
    );

    mint_to(yes_mint_ctx, yes_amount)?;

    let no_mint_accounts = MintTo {
        mint: ctx.accounts.no_mint.to_account_info(),
        to: ctx.accounts.no_vault.to_account_info(),
        authority: ctx.accounts.outcome_authority.to_account_info(),
    };

    let no_mint_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().key(),
        no_mint_accounts,
        outcome_signer,
    );

    mint_to(no_mint_ctx, no_amount)?;

    amm.yes_reserve = old_yes
        .checked_add(yes_amount)
        .ok_or(PredictionMarketError::MathOverflow)?;

    amm.no_reserve = old_no
        .checked_add(no_amount)
        .ok_or(PredictionMarketError::MathOverflow)?;

    amm.lp_supply = amm
        .lp_supply
        .checked_add(minted_lp)
        .ok_or(PredictionMarketError::MathOverflow)?;

    lp_position.shares = lp_position
        .shares
        .checked_add(minted_lp)
        .ok_or(PredictionMarketError::MathOverflow)?;

    Ok(())
}
