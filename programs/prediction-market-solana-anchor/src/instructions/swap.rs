use crate::{AmmPool, Market, Outcome, PredictionMarketError, SwapDirection};
use anchor_lang::prelude::*;
use anchor_spl::token::{
    mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer,
};

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

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
        constraint = user_payment_account.owner == user.key()
            @ PredictionMarketError::Unauthorized,
        constraint = user_payment_account.mint == market.payment_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub user_payment_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_yes_account.owner == user.key()
            @ PredictionMarketError::Unauthorized,
        constraint = user_yes_account.mint == amm.yes_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub user_yes_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_no_account.owner == user.key()
            @ PredictionMarketError::Unauthorized,
        constraint = user_no_account.mint == amm.no_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub user_no_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn swap(
    mut ctx: Context<Swap>,
    amount_in: u64,
    min_amount_out: u64,
    direction: SwapDirection,
) -> Result<()> {
    require!(amount_in > 0, PredictionMarketError::InvalidAmount);

    let market = &ctx.accounts.market;

    require!(
        market.outcome == Outcome::Unresolved,
        PredictionMarketError::MarketAlreadyResolved
    );

    let now = Clock::get()?.unix_timestamp;

    require!(now < market.end_time, PredictionMarketError::MarketClosed);

    let fee = (amount_in as u128)
        .checked_mul(ctx.accounts.amm.fee_bps as u128)
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let amount_in_after_fee = (amount_in as u128)
        .checked_sub(fee)
        .ok_or(PredictionMarketError::MathOverflow)?;

    require!(
        amount_in_after_fee > 0,
        PredictionMarketError::InvalidAmount
    );

    match direction {
        SwapDirection::UsdcToYes => {
            transfer_usdc_to_vault(&ctx, amount_in)?;
            mint_complete_set_to_user(&ctx, amount_in)?;
            swap_outcome_tokens(
                &mut ctx,
                amount_in,
                amount_in_after_fee,
                min_amount_out,
                true,
            )?;
        }
        SwapDirection::UsdcToNo => {
            transfer_usdc_to_vault(&ctx, amount_in)?;
            mint_complete_set_to_user(&ctx, amount_in)?;
            swap_outcome_tokens(
                &mut ctx,
                amount_in,
                amount_in_after_fee,
                min_amount_out,
                false,
            )?;
        }
        SwapDirection::YesToNo => {
            swap_outcome_tokens(
                &mut ctx,
                amount_in,
                amount_in_after_fee,
                min_amount_out,
                false,
            )?;
        }
        SwapDirection::NoToYes => {
            swap_outcome_tokens(
                &mut ctx,
                amount_in,
                amount_in_after_fee,
                min_amount_out,
                true,
            )?;
        }
    }

    Ok(())
}

fn transfer_usdc_to_vault<'info>(ctx: &Context<'_, Swap<'info>>, amount: u64) -> Result<()> {
    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info().key(),
            Transfer {
                from: ctx.accounts.user_payment_account.to_account_info(),
                to: ctx.accounts.payment_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;
    Ok(())
}

fn mint_complete_set_to_user<'info>(ctx: &Context<'_, Swap<'info>>, amount: u64) -> Result<()> {
    let market_key = ctx.accounts.market.key();
    let outcome_bump = [ctx.bumps.outcome_authority];
    let outcome_signer_seeds: &[&[u8]] =
        &[b"outcome-authority", market_key.as_ref(), &outcome_bump];
    let outcome_signer: &[&[&[u8]]] = &[outcome_signer_seeds];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().key(),
            MintTo {
                mint: ctx.accounts.yes_mint.to_account_info(),
                to: ctx.accounts.user_yes_account.to_account_info(),
                authority: ctx.accounts.outcome_authority.to_account_info(),
            },
            outcome_signer,
        ),
        amount,
    )?;

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().key(),
            MintTo {
                mint: ctx.accounts.no_mint.to_account_info(),
                to: ctx.accounts.user_no_account.to_account_info(),
                authority: ctx.accounts.outcome_authority.to_account_info(),
            },
            outcome_signer,
        ),
        amount,
    )?;

    Ok(())
}


fn calculate_amount_out(
    reserve_in: u64,
    reserve_out: u64,
    amount_in_after_fee: u128,
) -> Result<u64> {
    require!(
        reserve_in > 0 && reserve_out > 0,
        PredictionMarketError::InvalidLiquidity
    );

    let reserve_in = reserve_in as u128;
    let reserve_out = reserve_out as u128;

    let k = reserve_in
        .checked_mul(reserve_out)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let new_reserve_in = reserve_in
        .checked_add(amount_in_after_fee)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let new_reserve_out = k
        .checked_div(new_reserve_in)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let amount_out = reserve_out
        .checked_sub(new_reserve_out)
        .ok_or(PredictionMarketError::InsufficientLiquidity)?;

    require!(amount_out > 0, PredictionMarketError::InsufficientLiquidity);

    u64::try_from(amount_out).map_err(|_| PredictionMarketError::MathOverflow.into())
}

fn swap_outcome_tokens<'info>(
    ctx: &mut Context<'_, Swap<'info>>,
    amount_in: u64,
    amount_in_after_fee: u128,
    min_amount_out: u64,
    is_no_for_yes: bool,
) -> Result<u64> {
    let amm = &mut ctx.accounts.amm;

    let (reserve_in, reserve_out) = if is_no_for_yes {
        (amm.no_reserve, amm.yes_reserve)
    } else {
        (amm.yes_reserve, amm.no_reserve)
    };

    let amount_out = calculate_amount_out(reserve_in, reserve_out, amount_in_after_fee)?;

    require!(
        amount_out >= min_amount_out,
        PredictionMarketError::SlippageExceeded
    );

    if is_no_for_yes {
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info().key(),
                Transfer {
                    from: ctx.accounts.user_no_account.to_account_info(),
                    to: ctx.accounts.no_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_in,
        )?;
    } else {
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info().key(),
                Transfer {
                    from: ctx.accounts.user_yes_account.to_account_info(),
                    to: ctx.accounts.yes_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_in,
        )?;
    }

    let market_key = ctx.accounts.market.key();
    let bump = [ctx.bumps.amm_authority];
    let signer_seeds: &[&[u8]] = &[b"amm-authority", market_key.as_ref(), &bump];

    if is_no_for_yes {
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().key(),
                Transfer {
                    from: ctx.accounts.yes_vault.to_account_info(),
                    to: ctx.accounts.user_yes_account.to_account_info(),
                    authority: ctx.accounts.amm_authority.to_account_info(),
                },
                &[signer_seeds],
            ),
            amount_out,
        )?;

        amm.no_reserve = amm
            .no_reserve
            .checked_add(amount_in)
            .ok_or(PredictionMarketError::MathOverflow)?;
        amm.yes_reserve = amm
            .yes_reserve
            .checked_sub(amount_out)
            .ok_or(PredictionMarketError::MathOverflow)?;
    } else {
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().key(),
                Transfer {
                    from: ctx.accounts.no_vault.to_account_info(),
                    to: ctx.accounts.user_no_account.to_account_info(),
                    authority: ctx.accounts.amm_authority.to_account_info(),
                },
                &[signer_seeds],
            ),
            amount_out,
        )?;

        amm.yes_reserve = amm
            .yes_reserve
            .checked_add(amount_in)
            .ok_or(PredictionMarketError::MathOverflow)?;
        amm.no_reserve = amm
            .no_reserve
            .checked_sub(amount_out)
            .ok_or(PredictionMarketError::MathOverflow)?;
    }

    Ok(amount_out)
}
